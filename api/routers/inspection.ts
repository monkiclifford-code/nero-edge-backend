import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { inspections, inspectionItems } from "@db/schema";
import { eq } from "drizzle-orm";

export const inspectionRouter = createRouter({
  create: publicQuery
    .input(
      z.object({
        jobId: z.number().positive(),
        operatorId: z.number().positive(),
        notes: z.string().optional(),
        startedAt: z.string().optional(), // ISO timestamp
        items: z.array(
          z.object({
            dimensionName: z.string().min(1),
            nominalValue: z.number(),
            tolerancePlus: z.number(),
            toleranceMinus: z.number(),
            measuredValue: z.number(),
            isPass: z.boolean(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      const now = new Date();
      const startedAt = input.startedAt ? new Date(input.startedAt) : now;
      const durationSeconds = Math.round((now.getTime() - startedAt.getTime()) / 1000);
      const failCount = input.items.filter((i) => !i.isPass).length;

      // Create inspection record (PostgreSQL: use .returning())
      const [inserted] = await db
        .insert(inspections)
        .values({
          jobId: input.jobId,
          operatorId: input.operatorId,
          notes: input.notes ?? null,
          startedAt: startedAt,
          completedAt: now,
          durationSeconds: durationSeconds,
          failCount: failCount,
        })
        .returning({ id: inspections.id });

      if (!inserted) {
        throw new Error("Failed to insert inspection");
      }

      const inspectionId = inserted.id;

      // Insert items
      if (input.items.length > 0) {
        await db.insert(inspectionItems).values(
          input.items.map((item) => ({
            inspectionId: inspectionId,
            dimensionName: item.dimensionName,
            nominalValue: String(item.nominalValue),
            tolerancePlus: String(item.tolerancePlus),
            toleranceMinus: String(item.toleranceMinus),
            measuredValue: String(item.measuredValue),
            isPass: item.isPass,
          }))
        );
      }

      return { success: true, inspectionId, durationSeconds, failCount };
    }),

  getByJobId: publicQuery
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const results = await db
        .select()
        .from(inspections)
        .where(eq(inspections.jobId, input.jobId))
        .orderBy(inspections.createdAt);
      return results;
    }),

  getItems: publicQuery
    .input(z.object({ inspectionId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(inspectionItems)
        .where(eq(inspectionItems.inspectionId, input.inspectionId));
    }),
});
