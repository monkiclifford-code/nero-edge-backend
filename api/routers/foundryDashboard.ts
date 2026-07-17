import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  foundryNcrs, foundryDefects, foundryNcrImages,
  castingBatches, aiVisualPredictions, jobs, operators,
} from "@db/schema";
import { eq, desc, sql, count, and, gte } from "drizzle-orm";

export const foundryDashboardRouter = createRouter({
  // ─── KPI Summary ───
  getKpis: publicQuery.query(async () => {
    const db = getDb();

    const totalNcrsResult = await db
      .select({ total: count() })
      .from(foundryNcrs);
    const totalNcrs = Number(totalNcrsResult[0]?.total ?? 0);

    const openNcrsResult = await db
      .select({ total: count() })
      .from(foundryNcrs)
      .where(eq(foundryNcrs.status, "open"));
    const openNcrs = Number(openNcrsResult[0]?.total ?? 0);

    const criticalResult = await db
      .select({ total: count() })
      .from(foundryNcrs)
      .where(eq(foundryNcrs.severity, "critical"));
    const criticalCount = Number(criticalResult[0]?.total ?? 0);

    const scrapResult = await db
      .select({ total: sql<number>`COALESCE(SUM(${foundryNcrs.scrapCost}), 0)` })
      .from(foundryNcrs)
      .where(eq(foundryNcrs.scrapQuantified, true));
    const totalScrapCost = Number(scrapResult[0]?.total ?? 0);

    // AI-analyzed images count
    const aiAnalyzedResult = await db
      .select({ total: count() })
      .from(aiVisualPredictions)
      .where(eq(aiVisualPredictions.status, "completed"));
    const aiAnalyzed = Number(aiAnalyzedResult[0]?.total ?? 0);

    return {
      totalNcrs,
      openNcrs,
      criticalCount,
      totalScrapCost,
      aiAnalyzed,
    };
  }),

  // ─── Top Foundry Defects ───
  getTopDefects: publicQuery.query(async () => {
    const db = getDb();
    const results = await db
      .select({
        defectType: foundryNcrs.defectType,
        defectCount: count(),
      })
      .from(foundryNcrs)
      .groupBy(foundryNcrs.defectType)
      .orderBy(desc(count()))
      .limit(10);

    return results.map((r) => ({
      defectType: r.defectType,
      count: Number(r.defectCount),
    }));
  }),

  // ─── Defect Trends Over Time ───
  getDefectTrends: publicQuery.query(async () => {
    const db = getDb();
    const allNcrs = await db
      .select({
        createdAt: foundryNcrs.createdAt,
        defectType: foundryNcrs.defectType,
      })
      .from(foundryNcrs)
      .orderBy(foundryNcrs.createdAt);

    const byDate = new Map<string, Map<string, number>>();
    for (const n of allNcrs) {
      const dateStr = new Date(n.createdAt).toISOString().slice(0, 10);
      if (!byDate.has(dateStr)) byDate.set(dateStr, new Map());
      const typeMap = byDate.get(dateStr)!;
      typeMap.set(n.defectType, (typeMap.get(n.defectType) ?? 0) + 1);
    }

    const trend = Array.from(byDate.entries())
      .map(([date, typeMap]) => {
        const entry: any = { date };
        for (const [type, count] of typeMap) {
          entry[type] = count;
        }
        return entry;
      })
      .slice(-30);

    return trend;
  }),

  // ─── Repeat Casting Defects ───
  getRepeatDefects: publicQuery.query(async () => {
    const db = getDb();
    const results = await db
      .select({
        partNumber: foundryDefects.partNumber,
        defectType: foundryDefects.defectType,
        occurrenceCount: count(),
        latestDescription: sql<string>`MAX(${foundryDefects.description})`,
      })
      .from(foundryDefects)
      .groupBy(foundryDefects.partNumber, foundryDefects.defectType)
      .having(sql`COUNT(*) >= 2`)
      .orderBy(desc(count()))
      .limit(10);

    return results.map((r) => ({
      partNumber: r.partNumber,
      defectType: r.defectType,
      occurrenceCount: Number(r.occurrenceCount),
      latestDescription: r.latestDescription,
    }));
  }),

  // ─── Visual Defect Gallery (latest with images) ───
  getVisualGallery: publicQuery
    .input(z.object({ limit: z.number().default(20) }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const results = await db
        .select({
          id: foundryNcrImages.id,
          imageUrl: foundryNcrImages.imageUrl,
          thumbnailUrl: foundryNcrImages.thumbnailUrl,
          createdAt: foundryNcrImages.createdAt,
          defectType: foundryNcrs.defectType,
          severity: foundryNcrs.severity,
          partNumber: jobs.partNumber,
          jobNumber: jobs.jobNumber,
          predictedType: aiVisualPredictions.predictedDefectType,
          aiConfidence: aiVisualPredictions.confidence,
        })
        .from(foundryNcrImages)
        .innerJoin(foundryNcrs, eq(foundryNcrImages.foundryNcrId, foundryNcrs.id))
        .innerJoin(jobs, eq(foundryNcrs.jobId, jobs.id))
        .leftJoin(
          aiVisualPredictions,
          eq(aiVisualPredictions.imageId, foundryNcrImages.id)
        )
        .orderBy(desc(foundryNcrImages.createdAt))
        .limit(input?.limit ?? 20);

      return results;
    }),

  // ─── High-Risk Casting Alerts ───
  getRiskAlerts: publicQuery.query(async () => {
    const db = getDb();

    // Batches with multiple NCRs
    const batchNcrs = await db
      .select({
        batchId: castingBatches.id,
        batchNumber: castingBatches.batchNumber,
        partNumber: castingBatches.partNumber,
        ncrCount: count(),
        scrapTotal: sql<number>`COALESCE(SUM(CASE WHEN ${foundryNcrs.scrapQuantified} = 1 THEN ${foundryNcrs.scrapCost} ELSE 0 END), 0)`,
      })
      .from(castingBatches)
      .innerJoin(foundryNcrs, eq(foundryNcrs.castingBatchId, castingBatches.id))
      .groupBy(castingBatches.id)
      .having(sql`COUNT(*) >= 2`)
      .orderBy(desc(count()))
      .limit(10);

    // Parts with increasing defect frequency (this week vs last week)
    const now = new Date();
    const thisWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const thisWeekDefects = await db
      .select({
        partNumber: foundryNcrs.defectType,
        count: count(),
      })
      .from(foundryNcrs)
      .where(gte(foundryNcrs.createdAt, thisWeekStart))
      .groupBy(foundryNcrs.defectType);

    return {
      highRiskBatches: batchNcrs.map((b) => ({
        batchId: b.batchId,
        batchNumber: b.batchNumber,
        partNumber: b.partNumber,
        ncrCount: Number(b.ncrCount),
        scrapCost: Number(b.scrapTotal),
      })),
      trendingDefects: thisWeekDefects.map((d) => ({
        defectType: d.partNumber,
        count: Number(d.count),
      })),
    };
  }),

  // ─── Scrap Analysis ───
  getScrapAnalysis: publicQuery.query(async () => {
    const db = getDb();

    const byDefectType = await db
      .select({
        defectType: foundryNcrs.defectType,
        totalScrap: sql<number>`COALESCE(SUM(${foundryNcrs.scrapCost}), 0)`,
        count: count(),
      })
      .from(foundryNcrs)
      .where(eq(foundryNcrs.scrapQuantified, true))
      .groupBy(foundryNcrs.defectType)
      .orderBy(desc(sql`COALESCE(SUM(${foundryNcrs.scrapCost}), 0)`));

    return byDefectType.map((r) => ({
      defectType: r.defectType,
      totalScrap: Number(r.totalScrap),
      count: Number(r.count),
    }));
  }),
});
