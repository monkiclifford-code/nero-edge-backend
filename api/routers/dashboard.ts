import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { ncr, jobs, operators, inspections } from "@db/schema";
import { eq, desc, sql, count } from "drizzle-orm";

export const dashboardRouter = createRouter({
  // A. Live NCR Feed
  getNcrFeed: publicQuery.query(async () => {
    const db = getDb();
    const results = await db
      .select({
        ncrId: ncr.id,
        problemDescription: ncr.problemDescription,
        rootCause: ncr.rootCause,
        correctiveAction: ncr.correctiveAction,
        createdAt: ncr.createdAt,
        operatorName: operators.name,
        partNumber: jobs.partNumber,
        jobNumber: jobs.jobNumber,
      })
      .from(ncr)
      .innerJoin(operators, eq(ncr.operatorId, operators.id))
      .innerJoin(jobs, eq(ncr.jobId, jobs.id))
      .orderBy(desc(ncr.createdAt))
      .limit(50);
    return results;
  }),

  // B. Repeat Issues Panel
  getRepeatIssues: publicQuery.query(async () => {
    const db = getDb();
    // Find part numbers with 2+ NCRs
    const results = await db
      .select({
        partNumber: jobs.partNumber,
        issueCount: count(),
        latestRootCause: sql<string>`MAX(${ncr.rootCause})`,
        latestProblem: sql<string>`MAX(${ncr.problemDescription})`,
      })
      .from(ncr)
      .innerJoin(jobs, eq(ncr.jobId, jobs.id))
      .groupBy(jobs.partNumber)
      .having(sql`COUNT(*) >= 2`)
      .orderBy(desc(count()));

    return results.map((r) => ({
      partNumber: r.partNumber,
      issueCount: Number(r.issueCount),
      latestRootCause: r.latestRootCause,
      latestProblem: r.latestProblem,
    }));
  }),

  // C. Operator Performance Table
  getOperatorStats: publicQuery.query(async () => {
    const db = getDb();

    // Get all operators with their inspection and NCR counts
    const opList = await db.select().from(operators).orderBy(operators.name);

    const stats = await Promise.all(
      opList.map(async (op) => {
        // Total inspections
        const inspectionResult = await db
          .select({
            total: count(),
            totalFails: sql<number>`COALESCE(SUM(${inspections.failCount}), 0)`,
          })
          .from(inspections)
          .where(eq(inspections.operatorId, op.id));

        const totalInspections = Number(inspectionResult[0]?.total ?? 0);
        const totalFails = Number(inspectionResult[0]?.totalFails ?? 0);

        // NCR count for this operator
        const ncrResult = await db
          .select({ ncrCount: count() })
          .from(ncr)
          .where(eq(ncr.operatorId, op.id));
        const ncrCount = Number(ncrResult[0]?.ncrCount ?? 0);

        // Repeat NCR count: same operator + same part + same root cause >= 2
        const repeatResult = await db
          .select({
            partNumber: jobs.partNumber,
            rootCause: ncr.rootCause,
            repeatCount: count(),
          })
          .from(ncr)
          .innerJoin(jobs, eq(ncr.jobId, jobs.id))
          .where(eq(ncr.operatorId, op.id))
          .groupBy(jobs.partNumber, ncr.rootCause)
          .having(sql`COUNT(*) >= 2`);

        const repeatNcrCount = repeatResult.reduce(
          (sum, r) => sum + Number(r.repeatCount),
          0
        );

        const failRate =
          totalInspections > 0
            ? ((totalFails / totalInspections) * 100).toFixed(1)
            : "0.0";

        return {
          operatorId: op.id,
          operatorName: op.name,
          operatorCode: op.operatorId,
          totalInspections,
          totalFails,
          ncrCount,
          repeatNcrCount,
          failRate: parseFloat(failRate),
        };
      })
    );

    return stats;
  }),

  // D. Top Root Causes
  getTopRootCauses: publicQuery.query(async () => {
    const db = getDb();
    const results = await db
      .select({
        rootCause: ncr.rootCause,
        causeCount: count(),
      })
      .from(ncr)
      .groupBy(ncr.rootCause)
      .orderBy(desc(count()))
      .limit(5);

    return results.map((r) => ({
      rootCause: r.rootCause,
      count: Number(r.causeCount),
    }));
  }),

  // E. Trends
  getTrends: publicQuery.query(async () => {
    const db = getDb();

    // Fetch all NCRs and group by date in JS (more compatible)
    const allNcrs = await db
      .select({ createdAt: ncr.createdAt })
      .from(ncr)
      .orderBy(ncr.createdAt);

    const ncrByDate = new Map<string, number>();
    for (const n of allNcrs) {
      const dateStr = new Date(n.createdAt).toISOString().slice(0, 10);
      ncrByDate.set(dateStr, (ncrByDate.get(dateStr) ?? 0) + 1);
    }

    const allInspections = await db
      .select({
        createdAt: inspections.createdAt,
        failCount: inspections.failCount,
      })
      .from(inspections)
      .orderBy(inspections.createdAt);

    const failByDate = new Map<string, { total: number; fails: number }>();
    for (const ins of allInspections) {
      const dateStr = new Date(ins.createdAt).toISOString().slice(0, 10);
      const entry = failByDate.get(dateStr) ?? { total: 0, fails: 0 };
      entry.total += 1;
      entry.fails += ins.failCount ?? 0;
      failByDate.set(dateStr, entry);
    }

    return {
      ncrTrend: Array.from(ncrByDate.entries())
        .map(([date, count]) => ({ date, count }))
        .slice(-30),
      failTrend: Array.from(failByDate.entries())
        .map(([date, { total, fails }]) => ({
          date,
          failRate: total > 0 ? (fails / total) * 100 : 0,
        }))
        .slice(-30),
    };
  }),

  // Repeat Operator Detection
  getRepeatOperatorIssues: publicQuery.query(async () => {
    const db = getDb();

    const results = await db
      .select({
        operatorName: operators.name,
        operatorCode: operators.operatorId,
        partNumber: jobs.partNumber,
        rootCause: ncr.rootCause,
        occurrenceCount: count(),
      })
      .from(ncr)
      .innerJoin(operators, eq(ncr.operatorId, operators.id))
      .innerJoin(jobs, eq(ncr.jobId, jobs.id))
      .groupBy(operators.name, operators.operatorId, jobs.partNumber, ncr.rootCause)
      .having(sql`COUNT(*) >= 2`)
      .orderBy(desc(count()));

    return results.map((r) => ({
      operatorName: r.operatorName,
      operatorCode: r.operatorCode,
      partNumber: r.partNumber,
      rootCause: r.rootCause,
      occurrenceCount: Number(r.occurrenceCount),
    }));
  }),
});
