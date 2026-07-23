import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  foundryNcrs, foundryNcrImages, foundryDefects, foundryNcrVersions,
  castingBatches, aiVisualPredictions, jobs, operators,
  FOUNDRY_DEFECT_TYPES, NCR_CLASSIFICATIONS,
} from "@db/schema";
import { eq, desc, sql, count, like, and, gte, inArray } from "drizzle-orm";

export const foundryRouter = createRouter({

  // ═══════════════════════════════════════════════════════════
  // SAVE NCR — with version control (create or update)
  // ═══════════════════════════════════════════════════════════
  saveNcr: publicQuery
    .input(
      z.object({
        jobId: z.number().positive(),
        operatorId: z.number().positive(),
        operatorName: z.string(),
        castingBatchId: z.number().positive().optional(),
        ncrType: z.enum(NCR_CLASSIFICATIONS).default("foundry"),
        defectType: z.enum(FOUNDRY_DEFECT_TYPES),
        problemDescription: z.string().min(1),
        rootCause: z.string().optional(),
        correctiveAction: z.string().optional(),
        severity: z.enum(["critical", "major", "minor", "observation"]).default("major"),
        status: z.enum(["open", "in_progress", "resolved", "closed"]).default("open"),
        scrapQuantified: z.boolean().default(false),
        scrapCost: z.number().optional(),
        changeSummary: z.string().optional(),
        // For editing existing NCR
        existingNcrId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      let newVersion = 1;
      let previousVersion = 0;

      if (input.existingNcrId) {
        // ─── UPDATE: Archive existing, create new version ───
        const [existing] = await db.select().from(foundryNcrs)
          .where(eq(foundryNcrs.id, input.existingNcrId))
          .limit(1);

        if (!existing) throw new Error("NCR not found");

        previousVersion = existing.version;
        newVersion = existing.version + 1;

        // Get old images for snapshot
        const oldImages = await db.select().from(foundryNcrImages)
          .where(eq(foundryNcrImages.foundryNcrId, existing.id));

        // Save version snapshot
        await db.insert(foundryNcrVersions).values({
          foundryNcrId: existing.id,
          version: existing.version,
          operatorId: input.operatorId,
          operatorName: input.operatorName,
          changeSummary: input.changeSummary || `Updated to version ${newVersion}`,
          snapshotData: JSON.stringify({
            problemDescription: existing.problemDescription,
            rootCause: existing.rootCause,
            correctiveAction: existing.correctiveAction,
            severity: existing.severity,
            status: existing.status,
            scrapQuantified: existing.scrapQuantified,
            scrapCost: existing.scrapCost,
            imageCount: oldImages.length,
            updatedAt: existing.updatedAt,
          }),
        });

        // Mark old as not latest
        await db.update(foundryNcrs)
          .set({ isLatest: false })
          .where(eq(foundryNcrs.id, existing.id));

        // Delete old images
        await db.delete(foundryNcrImages)
          .where(eq(foundryNcrImages.foundryNcrId, existing.id));
      }

      // ─── Create new NCR record ───
      const [ncr] = await db.insert(foundryNcrs).values({
        jobId: input.jobId,
        operatorId: input.operatorId,
        castingBatchId: input.castingBatchId ?? null,
        ncrType: input.ncrType,
        defectType: input.defectType,
        problemDescription: input.problemDescription,
        rootCause: input.rootCause ?? null,
        correctiveAction: input.correctiveAction ?? null,
        severity: input.severity,
        status: input.status,
        scrapQuantified: input.scrapQuantified,
        scrapCost: input.scrapCost?.toString() ?? null,
        version: newVersion,
        isLatest: true,
        approvalStatus: "pending",
        updatedBy: input.operatorName,
        changeSummary: input.changeSummary || null,
      }).returning();

      return {
        success: true,
        foundryNcrId: ncr.id,
        version: newVersion,
        previousVersion,
        message: previousVersion > 0
          ? `NCR updated to version ${newVersion}`
          : `NCR created (version ${newVersion})`,
      };
    }),

  // ═══════════════════════════════════════════════════════════
  // GET NCR by ID — returns latest version with images
  // ═══════════════════════════════════════════════════════════
  getNcrById: publicQuery
    .input(z.object({ id: z.number().positive() }))
    .query(async ({ input }) => {
      const db = getDb();

      // Get the NCR along with job/operator info
      const [ncr] = await db
        .select({
          id: foundryNcrs.id,
          jobId: foundryNcrs.jobId,
          operatorId: foundryNcrs.operatorId,
          castingBatchId: foundryNcrs.castingBatchId,
          ncrType: foundryNcrs.ncrType,
          defectType: foundryNcrs.defectType,
          problemDescription: foundryNcrs.problemDescription,
          rootCause: foundryNcrs.rootCause,
          correctiveAction: foundryNcrs.correctiveAction,
          severity: foundryNcrs.severity,
          status: foundryNcrs.status,
          scrapQuantified: foundryNcrs.scrapQuantified,
          scrapCost: foundryNcrs.scrapCost,
          version: foundryNcrs.version,
          isLatest: foundryNcrs.isLatest,
          approvalStatus: foundryNcrs.approvalStatus,
          approvedBy: foundryNcrs.approvedBy,
          approvedAt: foundryNcrs.approvedAt,
          changeSummary: foundryNcrs.changeSummary,
          updatedBy: foundryNcrs.updatedBy,
          createdAt: foundryNcrs.createdAt,
          updatedAt: foundryNcrs.updatedAt,
          jobNumber: jobs.jobNumber,
          partNumber: jobs.partNumber,
          materialNumber: jobs.materialNumber,
          revision: jobs.revision,
          operatorName: operators.name,
        })
        .from(foundryNcrs)
        .innerJoin(jobs, eq(foundryNcrs.jobId, jobs.id))
        .innerJoin(operators, eq(foundryNcrs.operatorId, operators.id))
        .where(eq(foundryNcrs.id, input.id))
        .limit(1);

      if (!ncr) return null;

      // Get images
      const images = await db.select().from(foundryNcrImages)
        .where(eq(foundryNcrImages.foundryNcrId, ncr.id))
        .orderBy(desc(foundryNcrImages.createdAt));

      // Get version history
      const versions = await db.select().from(foundryNcrVersions)
        .where(eq(foundryNcrVersions.foundryNcrId, ncr.id))
        .orderBy(desc(foundryNcrVersions.createdAt))
        .limit(10);

      return { ...ncr, images, versions };
    }),

  // ═══════════════════════════════════════════════════════════
  // GET NCRs by Part Number — returns LATEST APPROVED only
  // ═══════════════════════════════════════════════════════════
  getNcrsByPart: publicQuery
    .input(z.object({ partNumber: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const results = await db
        .select({
          id: foundryNcrs.id,
          defectType: foundryNcrs.defectType,
          problemDescription: foundryNcrs.problemDescription,
          rootCause: foundryNcrs.rootCause,
          correctiveAction: foundryNcrs.correctiveAction,
          severity: foundryNcrs.severity,
          status: foundryNcrs.status,
          version: foundryNcrs.version,
          approvalStatus: foundryNcrs.approvalStatus,
          scrapQuantified: foundryNcrs.scrapQuantified,
          scrapCost: foundryNcrs.scrapCost,
          createdAt: foundryNcrs.createdAt,
          updatedAt: foundryNcrs.updatedAt,
          jobNumber: jobs.jobNumber,
          partNumber: jobs.partNumber,
          operatorName: operators.name,
        })
        .from(foundryNcrs)
        .innerJoin(jobs, eq(foundryNcrs.jobId, jobs.id))
        .innerJoin(operators, eq(foundryNcrs.operatorId, operators.id))
        .where(and(
          eq(jobs.partNumber, input.partNumber),
          eq(foundryNcrs.isLatest, true),
          eq(foundryNcrs.approvalStatus, "approved"),
        ))
        .orderBy(desc(foundryNcrs.createdAt));
      return results;
    }),

  // ═══════════════════════════════════════════════════════════
  // SEARCH NCRs — library with filters (only latest)
  // ═══════════════════════════════════════════════════════════
  searchNcrs: publicQuery
    .input(
      z.object({
        partNumber: z.string().optional(),
        jobNumber: z.string().optional(),
        ncrNumber: z.string().optional(),
        defectType: z.string().optional(),
        operatorName: z.string().optional(),
        status: z.string().optional(),
        severity: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [eq(foundryNcrs.isLatest, true)];

      if (input.partNumber) conditions.push(like(jobs.partNumber, `%${input.partNumber}%`));
      if (input.jobNumber) conditions.push(like(jobs.jobNumber, `%${input.jobNumber}%`));
      if (input.ncrNumber) conditions.push(eq(foundryNcrs.id, Number(input.ncrNumber)));
      if (input.defectType) conditions.push(eq(foundryNcrs.defectType, input.defectType));
      if (input.status) conditions.push(eq(foundryNcrs.status, input.status));
      if (input.severity) conditions.push(eq(foundryNcrs.severity, input.severity));
      if (input.dateFrom) conditions.push(gte(foundryNcrs.createdAt, new Date(input.dateFrom)));
      if (input.dateTo) conditions.push(sql`${foundryNcrs.createdAt} <= ${new Date(input.dateTo)}`);

      const whereClause = and(...conditions);

      const results = await db
        .select({
          id: foundryNcrs.id,
          jobId: foundryNcrs.jobId,
          operatorId: foundryNcrs.operatorId,
          ncrType: foundryNcrs.ncrType,
          defectType: foundryNcrs.defectType,
          problemDescription: foundryNcrs.problemDescription,
          severity: foundryNcrs.severity,
          status: foundryNcrs.status,
          scrapQuantified: foundryNcrs.scrapQuantified,
          scrapCost: foundryNcrs.scrapCost,
          version: foundryNcrs.version,
          approvalStatus: foundryNcrs.approvalStatus,
          approvedBy: foundryNcrs.approvedBy,
          approvedAt: foundryNcrs.approvedAt,
          createdAt: foundryNcrs.createdAt,
          updatedAt: foundryNcrs.updatedAt,
          jobNumber: jobs.jobNumber,
          partNumber: jobs.partNumber,
          materialNumber: jobs.materialNumber,
          revision: jobs.revision,
          operatorName: operators.name,
        })
        .from(foundryNcrs)
        .innerJoin(jobs, eq(foundryNcrs.jobId, jobs.id))
        .innerJoin(operators, eq(foundryNcrs.operatorId, operators.id))
        .where(whereClause)
        .orderBy(desc(foundryNcrs.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const countResult = await db
        .select({ total: count() })
        .from(foundryNcrs)
        .innerJoin(jobs, eq(foundryNcrs.jobId, jobs.id))
        .innerJoin(operators, eq(foundryNcrs.operatorId, operators.id))
        .where(whereClause);

      return { results, total: Number(countResult[0]?.total ?? 0) };
    }),

  // ═══════════════════════════════════════════════════════════
  // APPROVE NCR — supervisor sign-off
  // ═══════════════════════════════════════════════════════════
  approveNcr: publicQuery
    .input(z.object({
      ncrId: z.number().positive(),
      approverName: z.string().min(1),
      status: z.enum(["approved", "rejected"]).default("approved"),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(foundryNcrs)
        .set({
          approvalStatus: input.status,
          approvedBy: input.status === "approved" ? input.approverName : null,
          approvedAt: input.status === "approved" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(foundryNcrs.id, input.ncrId));

      return {
        success: true,
        message: input.status === "approved"
          ? "NCR approved and published"
          : "NCR rejected — needs revision",
        status: input.status,
      };
    }),

  // ═══════════════════════════════════════════════════════════
  // GET version history for an NCR
  // ═══════════════════════════════════════════════════════════
  getVersions: publicQuery
    .input(z.object({ ncrId: z.number().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(foundryNcrVersions)
        .where(eq(foundryNcrVersions.foundryNcrId, input.ncrId))
        .orderBy(desc(foundryNcrVersions.createdAt));
    }),

  // ═══════════════════════════════════════════════════════════
  // UPDATE NCR Status (workflow state)
  // ═══════════════════════════════════════════════════════════
  updateStatus: publicQuery
    .input(
      z.object({
        id: z.number().positive(),
        status: z.enum(["open", "in_progress", "resolved", "closed"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(foundryNcrs)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(foundryNcrs.id, input.id));
      return { success: true };
    }),

  // ═══════════════════════════════════════════════════════════
  // Attach Image to Foundry NCR
  // ═══════════════════════════════════════════════════════════
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
      const [img] = await db.insert(foundryNcrImages).values({
        foundryNcrId: input.foundryNcrId,
        imageUrl: input.imageUrl,
        thumbnailUrl: input.thumbnailUrl ?? null,
        uploadedBy: input.uploadedBy,
        fileSize: input.fileSize ?? null,
        mimeType: input.mimeType ?? null,
        metadata: input.metadata ?? null,
      }).returning({ id: foundryNcrImages.id });
      return { success: true, imageId: img.id };
    }),

  // ═══════════════════════════════════════════════════════════
  // Get Images for Foundry NCR
  // ═══════════════════════════════════════════════════════════
  getImages: publicQuery
    .input(z.object({ foundryNcrId: z.number().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(foundryNcrImages)
        .where(eq(foundryNcrImages.foundryNcrId, input.foundryNcrId))
        .orderBy(desc(foundryNcrImages.createdAt));
    }),

  // ═══════════════════════════════════════════════════════════
  // Create Defect Record
  // ═══════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════
  // Get Defects by Part
  // ═══════════════════════════════════════════════════════════
  getDefectsByPart: publicQuery
    .input(z.object({ partNumber: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(foundryDefects)
        .where(eq(foundryDefects.partNumber, input.partNumber))
        .orderBy(desc(foundryDefects.createdAt));
    }),

  // ═══════════════════════════════════════════════════════════
  // Get All Defects (Visual History)
  // ═══════════════════════════════════════════════════════════
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

      return db.select({
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
    }),

  // ═══════════════════════════════════════════════════════════
  // Create Casting Batch
  // ═══════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════
  // Get Casting Batches
  // ═══════════════════════════════════════════════════════════
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
