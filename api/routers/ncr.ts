import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { ncr, ncrWhys, jobs } from "@db/schema";
import { eq, desc, like } from "drizzle-orm";

export const ncrRouter = createRouter({
  create: publicQuery
    .input(
      z.object({
        jobId: z.number().positive(),
        operatorId: z.number().positive(),
        inspectionId: z.number().positive().optional(),
        problemDescription: z.string().min(1),
        whys: z.array(z.object({
          whyLevel: z.number().min(1).max(5),
          answer: z.string().min(1),
        })).min(1).max(5),
        rootCause: z.string().min(1),
        correctiveAction: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      const insertResult = await db
        .insert(ncr)
        .values({
          jobId: input.jobId,
          operatorId: input.operatorId,
          inspectionId: input.inspectionId ?? null,
          problemDescription: input.problemDescription,
          rootCause: input.rootCause,
          correctiveAction: input.correctiveAction,
        });

      const insertedId = insertResult[0]?.insertId;
      if (!insertedId) {
        throw new Error("Failed to insert NCR");
      }

      const ncrId = Number(insertedId);

      // Insert WHYs
      if (input.whys.length > 0) {
        await db.insert(ncrWhys).values(
          input.whys.map((w) => ({
            ncrId: ncrId,
            whyLevel: w.whyLevel,
            answer: w.answer,
          }))
        );
      }

      return { success: true, ncrId };
    }),

  getByJobId: publicQuery
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const results = await db
        .select()
        .from(ncr)
        .where(eq(ncr.jobId, input.jobId))
        .orderBy(desc(ncr.createdAt));
      return results;
    }),

  getByPartNumber: publicQuery
    .input(z.object({ partNumber: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      // Join with jobs to find NCRs for the same part number
      const results = await db
        .select({
          ncrId: ncr.id,
          jobId: ncr.jobId,
          problemDescription: ncr.problemDescription,
          rootCause: ncr.rootCause,
          correctiveAction: ncr.correctiveAction,
          createdAt: ncr.createdAt,
          jobNumber: jobs.jobNumber,
          partNumber: jobs.partNumber,
        })
        .from(ncr)
        .innerJoin(jobs, eq(ncr.jobId, jobs.id))
        .where(eq(jobs.partNumber, input.partNumber))
        .orderBy(desc(ncr.createdAt));
      return results;
    }),

  getSuggestions: publicQuery
    .input(z.object({ keyword: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const keyword = `%${input.keyword}%`;

      const rootCauses = await db
        .selectDistinct({ value: ncr.rootCause })
        .from(ncr)
        .where(like(ncr.rootCause, keyword))
        .limit(10);

      const correctiveActions = await db
        .selectDistinct({ value: ncr.correctiveAction })
        .from(ncr)
        .where(like(ncr.correctiveAction, keyword))
        .limit(10);

      return {
        rootCauses: rootCauses.map((r) => r.value),
        correctiveActions: correctiveActions.map((r) => r.value),
      };
    }),
});
