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
        .leftJoin(jobs, eq(foundryNcrs.jobId, jobs.id))
        .leftJoin(operators, eq(foundryNcrs.operatorId, operators.id))
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
  // LIST ALL NCRs — returns ALL NCRs with job/operator info
  // ═══════════════════════════════════════════════════════════
  listAllNcrs: publicQuery
    .input(
      z.object({
        limit: z.number().default(50),
        offset: z.number().default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
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
          isLatest: foundryNcrs.isLatest,
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
        .leftJoin(jobs, eq(foundryNcrs.jobId, jobs.id))
        .leftJoin(operators, eq(foundryNcrs.operatorId, operators.id))
        .orderBy(desc(foundryNcrs.createdAt))
        .limit(input?.limit ?? 50)
        .offset(input?.offset ?? 0);

      const countResult = await db
        .select({ total: count() })
        .from(foundryNcrs);

      return { results, total: Number(countResult[0]?.total ?? 0) };
    }),

  // ═══════════════════════════════════════════════════════════
  // SEARCH NCRs — library with filters (uses LEFT JOIN for safety)
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

      // Build conditions — start with no mandatory filters
      const conditions = [];

      if (input.partNumber) conditions.push(like(jobs.partNumber, `%${input.partNumber}%`));
      if (input.jobNumber) conditions.push(like(jobs.jobNumber, `%${input.jobNumber}%`));
      if (input.ncrNumber) conditions.push(eq(foundryNcrs.id, Number(input.ncrNumber)));
      if (input.defectType) conditions.push(eq(foundryNcrs.defectType, input.defectType));
      if (input.status) conditions.push(eq(foundryNcrs.status, input.status));
      if (input.severity) conditions.push(eq(foundryNcrs.severity, input.severity));
      if (input.dateFrom) conditions.push(gte(foundryNcrs.createdAt, new Date(input.dateFrom)));
      if (input.dateTo) conditions.push(sql`${foundryNcrs.createdAt} <= ${new Date(input.dateTo)}`);

      // If no filters provided, default to showing latest versions only
      if (conditions.length === 0) {
        conditions.push(eq(foundryNcrs.isLatest, true));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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
        .leftJoin(jobs, eq(foundryNcrs.jobId, jobs.id))
        .leftJoin(operators, eq(foundryNcrs.operatorId, operators.id))
        .where(whereClause)
        .orderBy(desc(foundryNcrs.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const countResult = await db
        .select({ total: count() })
        .from(foundryNcrs)
        .leftJoin(jobs, eq(foundryNcrs.jobId, jobs.id))
        .leftJoin(operators, eq(foundryNcrs.operatorId, operators.id))
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
  // VISUAL HISTORY — gallery of all NCR images with NCR context
  // ═══════════════════════════════════════════════════════════
  getVisualHistory: publicQuery
    .input(
      z.object({
        partNumber: z.string().optional(),
        ncrNumber: z.string().optional(),
        jobNumber: z.string().optional(),
        materialNumber: z.string().optional(),
        defectType: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [eq(foundryNcrs.isLatest, true)];

      if (input?.partNumber) conditions.push(like(jobs.partNumber, `%${input.partNumber}%`));
      if (input?.ncrNumber) conditions.push(eq(foundryNcrs.id, Number(input.ncrNumber)));
      if (input?.jobNumber) conditions.push(like(jobs.jobNumber, `%${input.jobNumber}%`));
      if (input?.materialNumber) conditions.push(like(jobs.materialNumber ?? "", `%${input.materialNumber}%`));
      if (input?.defectType) conditions.push(eq(foundryNcrs.defectType, input.defectType));
      if (input?.dateFrom) conditions.push(gte(foundryNcrs.createdAt, new Date(input.dateFrom)));
      if (input?.dateTo) conditions.push(sql`${foundryNcrs.createdAt} <= ${new Date(input.dateTo)}`);

      const whereClause = and(...conditions);

      // Get images joined with NCRs and jobs for full gallery data (LEFT JOIN for safety)
      const images = await db
        .select({
          imageId: foundryNcrImages.id,
          imageUrl: foundryNcrImages.imageUrl,
          thumbnailUrl: foundryNcrImages.thumbnailUrl,
          mimeType: foundryNcrImages.mimeType,
          fileSize: foundryNcrImages.fileSize,
          imageCreatedAt: foundryNcrImages.createdAt,
          ncrId: foundryNcrs.id,
          jobId: foundryNcrs.jobId,
          operatorId: foundryNcrs.operatorId,
          defectType: foundryNcrs.defectType,
          severity: foundryNcrs.severity,
          problemDescription: foundryNcrs.problemDescription,
          rootCause: foundryNcrs.rootCause,
          correctiveAction: foundryNcrs.correctiveAction,
          status: foundryNcrs.status,
          scrapQuantified: foundryNcrs.scrapQuantified,
          scrapCost: foundryNcrs.scrapCost,
          version: foundryNcrs.version,
          approvalStatus: foundryNcrs.approvalStatus,
          ncrCreatedAt: foundryNcrs.createdAt,
          jobNumber: jobs.jobNumber,
          partNumber: jobs.partNumber,
          materialNumber: jobs.materialNumber,
          revision: jobs.revision,
          operatorName: operators.name,
        })
        .from(foundryNcrImages)
        .innerJoin(foundryNcrs, eq(foundryNcrImages.foundryNcrId, foundryNcrs.id))
        .leftJoin(jobs, eq(foundryNcrs.jobId, jobs.id))
        .leftJoin(operators, eq(foundryNcrs.operatorId, operators.id))
        .where(whereClause)
        .orderBy(desc(foundryNcrImages.createdAt))
        .limit(input?.limit ?? 50)
        .offset(input?.offset ?? 0);

      const countResult = await db
        .select({ total: count() })
        .from(foundryNcrImages)
        .innerJoin(foundryNcrs, eq(foundryNcrImages.foundryNcrId, foundryNcrs.id))
        .leftJoin(jobs, eq(foundryNcrs.jobId, jobs.id))
        .where(whereClause);

      return {
        images,
        total: Number(countResult[0]?.total ?? 0),
      };
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
  // DASHBOARD: Recent NCRs for live feed
  // ═══════════════════════════════════════════════════════════
  getRecentNcrs: publicQuery
    .input(z.object({ limit: z.number().default(10) }).optional())
    .query(async ({ input }) => {
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
          version: foundryNcrs.version,
          approvalStatus: foundryNcrs.approvalStatus,
          createdAt: foundryNcrs.createdAt,
          updatedAt: foundryNcrs.updatedAt,
          jobNumber: jobs.jobNumber,
          partNumber: jobs.partNumber,
          materialNumber: jobs.materialNumber,
          revision: jobs.revision,
          operatorName: operators.name,
        })
        .from(foundryNcrs)
        .leftJoin(jobs, eq(foundryNcrs.jobId, jobs.id))
        .leftJoin(operators, eq(foundryNcrs.operatorId, operators.id))
        .orderBy(desc(foundryNcrs.createdAt))
        .limit(input?.limit ?? 10);

      // Get image counts for each NCR
      const ncrsWithImages = await Promise.all(
        results.map(async (ncr) => {
          const imgs = await db.select({ count: count() }).from(foundryNcrImages)
            .where(eq(foundryNcrImages.foundryNcrId, ncr.id));
          return { ...ncr, imageCount: Number(imgs[0]?.count ?? 0) };
        })
      );

      return ncrsWithImages;
    }),

  // ═══════════════════════════════════════════════════════════
  // DASHBOARD: AI recommendation from knowledge base
  // ═══════════════════════════════════════════════════════════
  getAiRecommendation: publicQuery
    .input(z.object({ defectType: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = getDb();
      const [knowledge] = await db.select().from(foundryKnowledge)
        .where(eq(foundryKnowledge.defectType, input.defectType))
        .limit(1);

      if (!knowledge) {
        return {
          defectType: input.defectType,
          hasKnowledge: false,
          possibleCauses: "No knowledge base entry found for this defect type.",
          correctiveActions: "Consult foundry engineer for analysis.",
          preventiveActions: "",
          inspectionMethods: "",
          severityIndicators: "",
          relatedDefects: "",
        };
      }

      return {
        defectType: knowledge.defectType,
        hasKnowledge: true,
        possibleCauses: knowledge.possibleCauses,
        correctiveActions: knowledge.correctiveActions,
        preventiveActions: knowledge.preventiveActions,
        inspectionMethods: knowledge.inspectionMethods,
        lessonsLearned: knowledge.lessonsLearned,
        severityIndicators: knowledge.severityIndicators,
        relatedDefects: knowledge.relatedDefects,
      };
    }),

  // ═══════════════════════════════════════════════════════════
  // DASHBOARD: Risk alerts — repeat defect detection
  // ═══════════════════════════════════════════════════════════
  getRiskAlerts: publicQuery
    .query(async () => {
      const db = getDb();

      // Find parts with multiple NCRs of the same defect type
      const repeatDefects = await db
        .select({
          partNumber: jobs.partNumber,
          defectType: foundryNcrs.defectType,
          count: count(),
          maxSeverity: foundryNcrs.severity,
        })
        .from(foundryNcrs)
        .leftJoin(jobs, eq(foundryNcrs.jobId, jobs.id))
        .where(eq(foundryNcrs.isLatest, true))
        .groupBy(jobs.partNumber, foundryNcrs.defectType)
        .having(sql`${count()} > 1`)
        .orderBy(desc(count()));

      // Get total scrap cost per part
      const scrapByPart = await db
        .select({
          partNumber: jobs.partNumber,
          totalScrap: sql`SUM(${foundryNcrs.scrapCost})`,
          ncrCount: count(),
        })
        .from(foundryNcrs)
        .leftJoin(jobs, eq(foundryNcrs.jobId, jobs.id))
        .where(eq(foundryNcrs.isLatest, true))
        .groupBy(jobs.partNumber)
        .orderBy(desc(sql`SUM(${foundryNcrs.scrapCost})`));

      // Build alerts
      const alerts = [];

      for (const rd of repeatDefects) {
        const partNcrCount = await db
          .select({ count: count() })
          .from(foundryNcrs)
          .leftJoin(jobs, eq(foundryNcrs.jobId, jobs.id))
          .where(and(
            eq(jobs.partNumber, rd.partNumber ?? ""),
            eq(foundryNcrs.isLatest, true)
          ));

        alerts.push({
          type: "repeat_defect" as const,
          severity: Number(rd.count) >= 4 ? "critical" : Number(rd.count) >= 2 ? "major" : "minor",
          partNumber: rd.partNumber ?? "Unknown",
          defectType: rd.defectType,
          occurrenceCount: Number(rd.count),
          totalNcrsForPart: Number(partNcrCount[0]?.count ?? 0),
          message: `Repeated ${rd.defectType?.replace(/_/g, " ")} on ${rd.partNumber}. ${rd.count} NCRs recorded.`,
          recommendation: `Review casting parameters for ${rd.partNumber}. Consider process audit and pattern review.`,
        });
      }

      // Add scrap cost alerts
      for (const sp of scrapByPart.slice(0, 3)) {
        if (sp.totalScrap && Number(sp.totalScrap) > 500) {
          alerts.push({
            type: "high_scrap" as const,
            severity: Number(sp.totalScrap) > 2000 ? "critical" : "major",
            partNumber: sp.partNumber ?? "Unknown",
            defectType: null,
            occurrenceCount: Number(sp.ncrCount),
            totalNcrsForPart: Number(sp.ncrCount),
            message: `High scrap cost on ${sp.partNumber}: $${Number(sp.totalScrap).toLocaleString()} across ${sp.ncrCount} NCRs.`,
            recommendation: `Immediate cost review required. Analyze root causes and implement corrective actions.`,
          });
        }
      }

      return alerts.sort((a, b) => {
        const sevOrder = { critical: 0, major: 1, minor: 2 };
        return sevOrder[a.severity] - sevOrder[b.severity];
      });
    }),

  // ═══════════════════════════════════════════════════════════
  // DASHBOARD: KPIs and trends
  // ═══════════════════════════════════════════════════════════
  getDashboardKpis: publicQuery
    .query(async () => {
      const db = getDb();

      const totalNcrs = await db.select({ count: count() }).from(foundryNcrs)
        .where(eq(foundryNcrs.isLatest, true));
      const openNcrs = await db.select({ count: count() }).from(foundryNcrs)
        .where(and(eq(foundryNcrs.isLatest, true), eq(foundryNcrs.status, "open")));
      const criticalCount = await db.select({ count: count() }).from(foundryNcrs)
        .where(and(eq(foundryNcrs.isLatest, true), eq(foundryNcrs.severity, "critical")));
      const pendingApproval = await db.select({ count: count() }).from(foundryNcrs)
        .where(and(eq(foundryNcrs.isLatest, true), eq(foundryNcrs.approvalStatus, "pending")));

      const scrapResult = await db.select({
        total: sql`SUM(${foundryNcrs.scrapCost})`,
      }).from(foundryNcrs).where(eq(foundryNcrs.isLatest, true));

      // Top defects
      const topDefects = await db
        .select({
          defectType: foundryNcrs.defectType,
          count: count(),
        })
        .from(foundryNcrs)
        .where(eq(foundryNcrs.isLatest, true))
        .groupBy(foundryNcrs.defectType)
        .orderBy(desc(count()));

      // Recent trend (last 20 days)
      const trend = await db
        .select({
          date: sql<string>`DATE(${foundryNcrs.createdAt})`,
          count: count(),
        })
        .from(foundryNcrs)
        .where(sql`${foundryNcrs.createdAt} >= NOW() - INTERVAL '20 days'`)
        .groupBy(sql`DATE(${foundryNcrs.createdAt})`)
        .orderBy(sql`DATE(${foundryNcrs.createdAt})`);

      return {
        kpis: {
          totalNcrs: Number(totalNcrs[0]?.count ?? 0),
          openNcrs: Number(openNcrs[0]?.count ?? 0),
          criticalCount: Number(criticalCount[0]?.count ?? 0),
          pendingApproval: Number(pendingApproval[0]?.count ?? 0),
          totalScrapCost: Number(scrapResult[0]?.total ?? 0),
        },
        topDefects: topDefects.map(d => ({
          defectType: d.defectType,
          count: Number(d.count),
        })),
        trend: trend.map(t => ({
          date: t.date,
          count: Number(t.count),
        })),
      };
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
