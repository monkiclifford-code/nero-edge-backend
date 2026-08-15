import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { operators } from "@db/schema";
import { eq } from "drizzle-orm";

export const operatorRouter = createRouter({
  create: publicQuery
    .input(
      z.object({
        name: z.string().min(1).max(100),
        operatorId: z.string().min(1).max(50),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [existing] = await db
        .select()
        .from(operators)
        .where(eq(operators.operatorId, input.operatorId))
        .limit(1);

      if (existing) {
        return { success: true, operator: existing, message: "Operator already exists" };
      }

      const [operator] = await db
        .insert(operators)
        .values({
          name: input.name,
          operatorId: input.operatorId,
        })
        .returning();

      if (!operator) {
        throw new Error("Failed to insert operator");
      }

      return { success: true, operator };
    }),

  list: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(operators);
  }),

  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [operator] = await db
        .select()
        .from(operators)
        .where(eq(operators.id, input.id))
        .limit(1);
      return operator ?? null;
    }),
});
