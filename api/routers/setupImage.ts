import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { setupImages } from "@db/schema";
import { eq, desc } from "drizzle-orm";

export const setupImageRouter = createRouter({
  create: publicQuery
    .input(
      z.object({
        jobId: z.number().positive(),
        imageUrl: z.string().min(1).max(500),
        uploadedBy: z.number().positive(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const insertResult = await db.insert(setupImages).values({
        jobId: input.jobId,
        imageUrl: input.imageUrl,
        uploadedBy: input.uploadedBy,
      });
      const insertedId = insertResult[0]?.insertId;
      return { success: true, imageId: Number(insertedId) };
    }),

  getByJobId: publicQuery
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(setupImages)
        .where(eq(setupImages.jobId, input.jobId))
        .orderBy(desc(setupImages.createdAt));
    }),
});
