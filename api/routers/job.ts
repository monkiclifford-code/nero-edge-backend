import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { jobs } from "@db/schema";
import { eq, desc } from "drizzle-orm";

export const jobRouter = createRouter({
  create: publicQuery
    .input(
      z.object({
        jobNumber: z.string().min(1).max(50),
        partNumber: z.string().min(1).max(100),
        materialNumber: z.string().min(1).max(100),
        revision: z.string().max(20).default("A"),
        operatorId: z.number().positive(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [job] = await db
        .insert(jobs)
        .values({
          jobNumber: input.jobNumber,
          partNumber: input.partNumber,
          materialNumber: input.materialNumber,
          revision: input.revision,
          operatorId: input.operatorId,
        })
        .returning();

      if (!job) {
        throw new Error("Failed to insert job");
      }

      return { success: true, job };
    }),

  list: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(jobs).orderBy(desc(jobs.createdAt));
  }),

  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [job] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, input.id))
        .limit(1);
      return job ?? null;
    }),

  markSetupViewed: publicQuery
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input }) => {
      return { success: true, jobId: input.jobId, setupViewed: true };
    }),
});
