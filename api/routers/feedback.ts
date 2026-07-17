import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { jobFeedback, cncPrograms, jobs } from "@db/schema";
import { eq, desc, sql } from "drizzle-orm";

export const feedbackRouter = createRouter({
  // 1. Submit job completion feedback
  create: publicQuery
    .input(
      z.object({
        jobId: z.number().positive(),
        operatorId: z.number().positive(),
        programId: z.number().positive().optional(),
        result: z.enum(["pass", "fail"]),
        offsetAdjustment: z.number().optional(),
        toolChange: z.boolean().default(false),
        feedAdjustment: z.number().optional(),
        speedAdjustment: z.number().int().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const insertResult = await db.insert(jobFeedback).values({
        jobId: input.jobId,
        operatorId: input.operatorId,
        programId: input.programId ?? null,
        result: input.result,
        offsetAdjustment: input.offsetAdjustment != null ? String(input.offsetAdjustment) : null,
        toolChange: input.toolChange,
        feedAdjustment: input.feedAdjustment != null ? String(input.feedAdjustment) : null,
        speedAdjustment: input.speedAdjustment ?? null,
        notes: input.notes ?? null,
      });
      const insertedId = insertResult[0]?.insertId;
      return { success: true, feedbackId: Number(insertedId) };
    }),

  // 2. Get feedback for a job
  getByJobId: publicQuery
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(jobFeedback)
        .where(eq(jobFeedback.jobId, input.jobId))
        .orderBy(desc(jobFeedback.createdAt));
    }),

  // 3. AI Learning: Get optimized settings for a part number
  getOptimizedSettings: publicQuery
    .input(z.object({ partNumber: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = getDb();

      // Get all PASS feedback for jobs with this part number, joined with feedback
      const results = await db
        .select({
          programType: cncPrograms.programType,
          avgFeedAdj: sql<number>`AVG(${jobFeedback.feedAdjustment})`,
          avgSpeedAdj: sql<number>`AVG(${jobFeedback.speedAdjustment})`,
          passCount: sql<number>`COUNT(*)`,
          toolChangeCount: sql<number>`SUM(CASE WHEN ${jobFeedback.toolChange} = 1 THEN 1 ELSE 0 END)`,
        })
        .from(jobFeedback)
        .innerJoin(cncPrograms, eq(jobFeedback.programId, cncPrograms.id))
        .innerJoin(jobs, eq(jobFeedback.jobId, jobs.id))
        .where(
          sql`${jobs.partNumber} = ${input.partNumber} AND ${jobFeedback.result} = 'pass' AND ${jobFeedback.programId} IS NOT NULL`
        )
        .groupBy(cncPrograms.programType);

      // Get most common adjustment direction
      const adjustments = await db
        .select({
          feedAdjustment: jobFeedback.feedAdjustment,
          speedAdjustment: jobFeedback.speedAdjustment,
        })
        .from(jobFeedback)
        .innerJoin(jobs, eq(jobFeedback.jobId, jobs.id))
        .where(
          sql`${jobs.partNumber} = ${input.partNumber} AND ${jobFeedback.result} = 'pass' AND (${jobFeedback.feedAdjustment} IS NOT NULL OR ${jobFeedback.speedAdjustment} IS NOT NULL)`
        )
        .orderBy(desc(jobFeedback.createdAt))
        .limit(20);

      // Count pass/fail ratio
      const resultCounts = await db
        .select({
          result: jobFeedback.result,
          count: sql<number>`COUNT(*)`,
        })
        .from(jobFeedback)
        .innerJoin(jobs, eq(jobFeedback.jobId, jobs.id))
        .where(sql`${jobs.partNumber} = ${input.partNumber}`)
        .groupBy(jobFeedback.result);

      const passCount = Number(resultCounts.find((r) => r.result === "pass")?.count ?? 0);
      const failCount = Number(resultCounts.find((r) => r.result === "fail")?.count ?? 0);
      const total = passCount + failCount;

      return {
        hasData: results.length > 0 || adjustments.length > 0,
        passRate: total > 0 ? Math.round((passCount / total) * 100) : 0,
        totalRuns: total,
        byProgramType: results.map((r) => ({
          programType: r.programType,
          avgFeedAdjustment: r.avgFeedAdj != null ? parseFloat(Number(r.avgFeedAdj).toFixed(4)) : null,
          avgSpeedAdjustment: r.avgSpeedAdj != null ? Math.round(Number(r.avgSpeedAdj)) : null,
          passCount: Number(r.passCount),
          toolChangeRate: Number(r.passCount) > 0 ? Math.round((Number(r.toolChangeCount) / Number(r.passCount)) * 100) : 0,
        })),
        recentAdjustments: adjustments.slice(0, 5).map((a) => ({
          feedAdj: a.feedAdjustment != null ? Number(a.feedAdjustment) : null,
          speedAdj: a.speedAdjustment != null ? Number(a.speedAdjustment) : null,
        })),
      };
    }),

  // 4. Best Known Method for a part
  getBestKnownMethod: publicQuery
    .input(z.object({ partNumber: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = getDb();

      // Most successful program type
      const bestProgram = await db
        .select({
          programType: cncPrograms.programType,
          passCount: sql<number>`COUNT(*)`,
        })
        .from(jobFeedback)
        .innerJoin(cncPrograms, eq(jobFeedback.programId, cncPrograms.id))
        .innerJoin(jobs, eq(jobFeedback.jobId, jobs.id))
        .where(sql`${jobs.partNumber} = ${input.partNumber} AND ${jobFeedback.result} = 'pass' AND ${jobFeedback.programId} IS NOT NULL`)
        .groupBy(cncPrograms.programType)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(1);

      // Most common root cause (from NCRs)
      const topRootCause = await db
        .select({
          rootCause: sql<string>`ncr.root_cause`,
          count: sql<number>`COUNT(*)`,
        })
        .from(sql`ncr`)
        .innerJoin(sql`jobs`, sql`ncr.job_id = jobs.id`)
        .where(sql`jobs.part_number = ${input.partNumber}`)
        .groupBy(sql`ncr.root_cause`)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(1);

      // Most common corrective action
      const topCorrective = await db
        .select({
          correctiveAction: sql<string>`ncr.corrective_action`,
          count: sql<number>`COUNT(*)`,
        })
        .from(sql`ncr`)
        .innerJoin(sql`jobs`, sql`ncr.job_id = jobs.id`)
        .where(sql`jobs.part_number = ${input.partNumber}`)
        .groupBy(sql`ncr.corrective_action`)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(1);

      return {
        hasData: bestProgram.length > 0 || topRootCause.length > 0,
        bestProgramType: bestProgram[0]?.programType ?? null,
        mostCommonRootCause: topRootCause[0]?.rootCause ?? null,
        mostCommonCorrectiveAction: topCorrective[0]?.correctiveAction ?? null,
      };
    }),
});
