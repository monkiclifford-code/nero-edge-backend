import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  foundryNcrs, foundryNcrImages, foundryDefects,
  castingBatches, aiVisualPredictions, jobs, operators,
  FOUNDRY_DEFECT_TYPES, NCR_CLASSIFICATIONS,
} from "@db/schema";
import { eq, desc, sql, count, like, and, gte } from "drizzle-orm";

export const foundryRouter = createRouter({
  // ─── Create Foundry NCR ───
  createNcr: publicQuery
    .input(
      z.object({
        jobId: z.number().positive(),
        operatorId: z.number().positive(),
        castingBatchId: z.number().positive().optional(),
        ncrType: z.enum(NCR_CLASSIFICATIONS).default("foundry"),
        defectType: z.enum(FOUNDRY_DEFECT_TYPES),
        problemDescription: z.string().min(1),
        rootCause: z.string().optional(),
        correctiveAction: z.string().optional(),
        severity: z.enum(["critical", "major", "minor", "observation"]).default("major"),
        scrapQuantified: z.boolean().default(false),
        scrapCost: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(foundryNcrs).values({
        jobId: input.jobId,
        operatorId: input.operatorId,
        castingBatchId: input.castingBatchId ?? 0,
        ncrType: input.ncrType,
        defectType: input.defectType,
        problemDescription: input.problemDescription,
        rootCause: input.rootCause ?? null,
        correctiveAction: input.correctiveAction ?? null,
        severity: input.severity,
        scrapQuantified: input.scrapQuantified,
        scrapCost: input.scrapCost?.toString() ?? null,
      });
      const insertedId = result[0]?.insertId;
      return { success: true, foundryNcrId: Number(insertedId) };
    }),

  // ─── Get All Foundry NCRs ───
  getAllNcrs: publicQuery.query(async () => {
    const db = getDb();
    const results = await db
      .select({
        id: foundryNcrs.id,
        jobId: foundryNcrs.jobId,
        operatorId: foundryNcrs.operatorId,
        ncrType: foundryNcrs.ncrType,
        defectType: foundryNcrs.defectType,
        problemDescription: foundryNcrs.problemDescription,
        rootCause: foundryNcrs.rootCause,
        correctiveAction: foundryNcrs.correctiveAction,
        severity: foundryNcrs.severity,
        status: foundryNcrs.status,
        scrapQuantified: foundryNcrs.scrapQuantified,
        scrapCost: foundryNcrs.scrapCost,
        createdAt: foundryNcrs.createdAt,
        jobNumber: jobs.jobNumber,
        partNumber: jobs.partNumber,
        operatorName: operators.name,
      })
      .from(foundryNcrs)
      .innerJoin(jobs, eq(foundryNcrs.jobId, jobs.id))
      .innerJoin(operators, eq(foundryNcrs.operatorId, operators.id))
      .orderBy(desc(foundryNcrs.createdAt));
    return results;
  }),

  // ─── Get Foundry NCR by ID ───
  getNcrById: publicQuery
    .input(z.object({ id: z.number().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [ncr] = await db
        .select()
        .from(foundryNcrs)
        .where(eq(foundryNcrs.id, input.id));
      return ncr ?? null;
    }),

  // ─── Get NCRs by Part Number ───
  getNcrsByPart: publicQuery
    .input(z.object({ partNumber: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const results = await db
        .select({
          id: foundryNcrs.id,
          defectType: foundryNcrs.defectType,
          problemDescription: foundryNcrs.problemDescription,
          severity: foundryNcrs.severity,
          status: foundryNcrs.status,
          createdAt: foundryNcrs.createdAt,
          jobNumber: jobs.jobNumber,
          partNumber: jobs.partNumber,
          operatorName: operators.name,
        })
        .from(foundryNcrs)
        .innerJoin(jobs, eq(foundryNcrs.jobId, jobs.id))
        .innerJoin(operators, eq(foundryNcrs.operatorId, operators.id))
        .where(eq(jobs.partNumber, input.partNumber))
        .orderBy(desc(foundryNcrs.createdAt));
      return results;
    }),

  // ─── Update NCR Status ───
  updateStatus: publicQuery
    .input(
      z.object({
        id: z.number().positive(),
        status: z.enum(["open", "in_progress", "resolved", "closed"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(foundryNcrs)
        .set({ status: input.status })
        .where(eq(foundryNcrs.id, input.id));
      return { success: true };
    }),

  // ─── Attach Image to Foundry NCR ───
  attachImage: publicQuery
    .input(
      z.object({
        foundryNcrId: z.number().positive(),
        imageUrl: z.string().min(1),
        thumbnailUrl: z.string().optional(),
        uploadedBy: z.number().positive(),
        fileSize: z.number().optional(),
        mimeType: z.string().optional(),
        metadata: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(foundryNcrImages).values({
        foundryNcrId: input.foundryNcrId,
        imageUrl: input.imageUrl,
        thumbnailUrl: input.thumbnailUrl ?? null,
        uploadedBy: input.uploadedBy,
        fileSize: input.fileSize ?? null,
        mimeType: input.mimeType ?? null,
        metadata: input.metadata ?? null,
      });
      return { success: true, imageId: Number(result[0]?.insertId) };
    }),

  // ─── Get Images for Foundry NCR ───
  getImages: publicQuery
    .input(z.object({ foundryNcrId: z.number().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const results = await db
        .select()
        .from(foundryNcrImages)
        .where(eq(foundryNcrImages.foundryNcrId, input.foundryNcrId))
        .orderBy(desc(foundryNcrImages.createdAt));
      return results;
    }),

  // ─── Create Defect Record ───
  createDefect: publicQuery
    .input(
      z.object({
        foundryNcrId: z.number().positive(),
        partNumber: z.string().min(1),
        defectType: z.enum(FOUNDRY_DEFECT_TYPES),
        description: z.string().optional(),
        location: z.string().optional(),
        confidence: z.number().optional(),
        aiPredicted: z.boolean().default(false),
        imageId: z.number().positive().optional(),
        isRepeat: z.boolean().default(false),
        previousOccurrenceId: z.number().positive().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(foundryDefects).values({
        foundryNcrId: input.foundryNcrId,
        partNumber: input.partNumber,
        defectType: input.defectType,
        description: input.description ?? null,
        location: input.location ?? null,
        confidence: input.confidence?.toString() ?? null,
        aiPredicted: input.aiPredicted,
        imageId: input.imageId ?? null,
        isRepeat: input.isRepeat,
        previousOccurrenceId: input.previousOccurrenceId ?? null,
      });
      return { success: true, defectId: Number(result[0]?.insertId) };
    }),

  // ─── Get Defects by Part ───
  getDefectsByPart: publicQuery
    .input(z.object({ partNumber: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const results = await db
        .select()
        .from(foundryDefects)
        .where(eq(foundryDefects.partNumber, input.partNumber))
        .orderBy(desc(foundryDefects.createdAt));
      return results;
    }),

  // ─── Get All Defects (Visual History) ───
  getAllDefects: publicQuery
    .input(
      z.object({
        defectType: z.enum(FOUNDRY_DEFECT_TYPES).optional(),
        partNumber: z.string().optional(),
        aiPredicted: z.boolean().optional(),
        isRepeat: z.boolean().optional(),
        limit: z.number().default(50),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const filters = [];
      if (input?.defectType) filters.push(eq(foundryDefects.defectType, input.defectType));
      if (input?.partNumber) filters.push(like(foundryDefects.partNumber, `%${input.partNumber}%`));
      if (input?.aiPredicted !== undefined) filters.push(eq(foundryDefects.aiPredicted, input.aiPredicted));
      if (input?.isRepeat !== undefined) filters.push(eq(foundryDefects.isRepeat, input.isRepeat));

      const whereClause = filters.length > 0 ? and(...filters) : undefined;

      const results = await db
        .select({
          id: foundryDefects.id,
          partNumber: foundryDefects.partNumber,
          defectType: foundryDefects.defectType,
          description: foundryDefects.description,
          location: foundryDefects.location,
          confidence: foundryDefects.confidence,
          aiPredicted: foundryDefects.aiPredicted,
          isRepeat: foundryDefects.isRepeat,
          createdAt: foundryDefects.createdAt,
          imageUrl: foundryNcrImages.imageUrl,
          foundryNcrId: foundryDefects.foundryNcrId,
        })
        .from(foundryDefects)
        .leftJoin(foundryNcrImages, eq(foundryDefects.imageId, foundryNcrImages.id))
        .where(whereClause)
        .orderBy(desc(foundryDefects.createdAt))
        .limit(input?.limit ?? 50);
      return results;
    }),

  // ─── Create Casting Batch ───
  createBatch: publicQuery
    .input(
      z.object({
        batchNumber: z.string().min(1),
        partNumber: z.string().min(1),
        material: z.string().optional(),
        furnaceId: z.string().optional(),
        operatorId: z.number().positive().optional(),
        quantity: z.number().default(0),
        pourDate: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(castingBatches).values({
        batchNumber: input.batchNumber,
        partNumber: input.partNumber,
        material: input.material ?? null,
        furnaceId: input.furnaceId ?? null,
        operatorId: input.operatorId ?? null,
        quantity: input.quantity,
        pourDate: input.pourDate ? new Date(input.pourDate) : null,
        notes: input.notes ?? null,
      });
      return { success: true, batchId: Number(result[0]?.insertId) };
    }),

  // ─── Get Casting Batches ───
  getBatches: publicQuery
    .input(z.object({ partNumber: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const query = db.select().from(castingBatches).orderBy(desc(castingBatches.createdAt));
      if (input?.partNumber) {
        return query.where(eq(castingBatches.partNumber, input.partNumber));
      }
      const results = await query.limit(50);
      return results;
    }),
});
