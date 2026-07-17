import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { ncr, jobs } from "@db/schema";
import { eq, desc, sql, count } from "drizzle-orm";

function calculateRecencyScore(createdAt: Date): number {
  const now = Date.now();
  const itemTime = new Date(createdAt).getTime();
  const daysDiff = (now - itemTime) / (1000 * 60 * 60 * 24);
  // Exponential decay: 1.0 for today, 0.5 for 7 days, 0.25 for 14 days
  return Math.exp(-daysDiff / 7);
}

export const aiAssistantRouter = createRouter({
  // 1. Job Start AI Insight — what should the operator watch for?
  getJobInsight: publicQuery
    .input(z.object({ partNumber: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = getDb();

      // Get all NCRs for this part number
      const ncrs = await db
        .select({
          id: ncr.id,
          rootCause: ncr.rootCause,
          correctiveAction: ncr.correctiveAction,
          createdAt: ncr.createdAt,
        })
        .from(ncr)
        .innerJoin(jobs, eq(ncr.jobId, jobs.id))
        .where(eq(jobs.partNumber, input.partNumber))
        .orderBy(desc(ncr.createdAt));

      if (ncrs.length === 0) {
        return {
          hasHistory: false,
          totalNCRs: 0,
          mostCommonRootCause: null,
          recommendation: null,
          riskLevel: "low" as const,
        };
      }

      // Count root cause frequency
      const causeCounts = new Map<string, number>();
      for (const item of ncrs) {
        causeCounts.set(item.rootCause, (causeCounts.get(item.rootCause) ?? 0) + 1);
      }

      // Find most common
      let maxCount = 0;
      let mostCommon = "";
      for (const [cause, cnt] of causeCounts) {
        if (cnt > maxCount) {
          maxCount = cnt;
          mostCommon = cause;
        }
      }

      // Get the corrective action for the most common cause
      const matching = ncrs.find((n) => n.rootCause === mostCommon);

      // Risk level
      const riskLevel = ncrs.length >= 5 ? "high" : ncrs.length >= 2 ? "medium" : "low";

      return {
        hasHistory: true,
        totalNCRs: ncrs.length,
        mostCommonRootCause: mostCommon,
        recommendation: matching?.correctiveAction ?? "Review previous NCRs before starting.",
        riskLevel,
      };
    }),

  // 2. Setup Intelligence — past issues for this part
  getSetupInsights: publicQuery
    .input(z.object({ partNumber: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = getDb();

      const ncrs = await db
        .select({
          rootCause: ncr.rootCause,
          correctiveAction: ncr.correctiveAction,
          problemDescription: ncr.problemDescription,
          createdAt: ncr.createdAt,
        })
        .from(ncr)
        .innerJoin(jobs, eq(ncr.jobId, jobs.id))
        .where(eq(jobs.partNumber, input.partNumber))
        .orderBy(desc(ncr.createdAt))
        .limit(10);

      if (ncrs.length === 0) {
        return { hasInsights: false, insights: [] };
      }

      // Score each root cause (frequency + recency)
      const scored = ncrs.map((n) => ({
        rootCause: n.rootCause,
        correctiveAction: n.correctiveAction,
        recencyScore: calculateRecencyScore(n.createdAt),
      }));

      // Group by root cause and sum scores
      const grouped = new Map<string, { rootCause: string; correctiveAction: string; score: number }>();
      for (const s of scored) {
        const existing = grouped.get(s.rootCause);
        if (existing) {
          existing.score += s.recencyScore;
        } else {
          grouped.set(s.rootCause, {
            rootCause: s.rootCause,
            correctiveAction: s.correctiveAction,
            score: s.recencyScore,
          });
        }
      }

      const insights = Array.from(grouped.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      return { hasInsights: true, insights };
    }),

  // 3. Pre-Inspection Warning — operator + part history
  getPreInspectionWarning: publicQuery
    .input(
      z.object({
        operatorId: z.number().positive(),
        partNumber: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();

      // Find NCRs from this operator on this part
      const ncrs = await db
        .select({
          id: ncr.id,
          rootCause: ncr.rootCause,
          correctiveAction: ncr.correctiveAction,
          createdAt: ncr.createdAt,
        })
        .from(ncr)
        .innerJoin(jobs, eq(ncr.jobId, jobs.id))
        .where(
          sql`${ncr.operatorId} = ${input.operatorId} AND ${jobs.partNumber} = ${input.partNumber}`
        )
        .orderBy(desc(ncr.createdAt));

      if (ncrs.length === 0) {
        return { hasWarning: false, previousIssues: [] };
      }

      return {
        hasWarning: true,
        previousIssueCount: ncrs.length,
        previousIssues: ncrs.slice(0, 3).map((n) => ({
          rootCause: n.rootCause,
          correctiveAction: n.correctiveAction,
        })),
      };
    }),

  // 4. Enhanced NCR Suggestions with confidence scoring
  getRankedSuggestions: publicQuery
    .input(z.object({ keyword: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = getDb();
      const keyword = `%${input.keyword}%`;

      // Get root causes with frequency
      const rootCauses = await db
        .select({
          value: ncr.rootCause,
          freq: count(),
          latest: sql<string>`MAX(${ncr.createdAt})`,
        })
        .from(ncr)
        .where(sql`${ncr.rootCause} LIKE ${keyword}`)
        .groupBy(ncr.rootCause)
        .orderBy(desc(count()))
        .limit(10);

      // Get corrective actions with frequency
      const correctiveActions = await db
        .select({
          value: ncr.correctiveAction,
          freq: count(),
          latest: sql<string>`MAX(${ncr.createdAt})`,
        })
        .from(ncr)
        .where(sql`${ncr.correctiveAction} LIKE ${keyword}`)
        .groupBy(ncr.correctiveAction)
        .orderBy(desc(count()))
        .limit(10);

      // Calculate confidence scores
      const totalRootFreq = rootCauses.reduce((s, r) => s + Number(r.freq), 0) || 1;
      const totalActionFreq = correctiveActions.reduce((s, r) => s + Number(r.freq), 0) || 1;

      return {
        rootCauses: rootCauses.map((r) => ({
          text: r.value,
          frequency: Number(r.freq),
          confidence: Math.round((Number(r.freq) / totalRootFreq) * 100),
        })),
        correctiveActions: correctiveActions.map((r) => ({
          text: r.value,
          frequency: Number(r.freq),
          confidence: Math.round((Number(r.freq) / totalActionFreq) * 100),
        })),
      };
    }),

  // 5. Operator Coaching Alert — same operator, same issue
  getCoachingAlert: publicQuery
    .input(
      z.object({
        operatorId: z.number().positive(),
        rootCause: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();

      const ncrs = await db
        .select({
          id: ncr.id,
          correctiveAction: ncr.correctiveAction,
          createdAt: ncr.createdAt,
        })
        .from(ncr)
        .where(
          sql`${ncr.operatorId} = ${input.operatorId} AND ${ncr.rootCause} = ${input.rootCause}`
        )
        .orderBy(desc(ncr.createdAt));

      if (ncrs.length === 0) {
        return { hasAlert: false };
      }

      return {
        hasAlert: true,
        occurrenceCount: ncrs.length,
        latestCorrectiveAction: ncrs[0]?.correctiveAction ?? "",
      };
    }),
});
