import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  setupSheets, setupSheetImages, setupAnnotations,
  setupTools, setupWorkholding, setupVersions,
  jobs, operators,
} from "@db/schema";
import { eq, and, desc, like, sql, count, inArray } from "drizzle-orm";

// ─── Input schemas ───
const workholdingInput = z.object({
  label: z.string().min(1),
  value: z.string(),
  displayOrder: z.number().default(0),
});

const toolInput = z.object({
  toolNumber: z.string().min(1),
  description: z.string().optional(),
  toolId: z.string().optional(),
  offset: z.string().optional(),
  displayOrder: z.number().default(0),
});

const pointInput = z.object({ x: z.number(), y: z.number() });

const annotationInput = z.object({
  type: z.string().min(1),
  color: z.string().min(1),
  points: z.array(pointInput),
  text: z.string().optional(),
  number: z.number().nullable().optional(),
  strokeWidth: z.number().nullable().optional(),
});

const imageInput = z.object({
  imageData: z.string().min(1), // base64
  displayOrder: z.number().default(0),
  annotations: z.array(annotationInput).default([]),
});

export const setupSheetRouter = createRouter({

  // ─── GET by Job ID ───
  getByJobId: publicQuery
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();

      // Find the latest setup sheet for this job
      const [sheet] = await db
        .select()
        .from(setupSheets)
        .where(and(
          eq(setupSheets.jobId, input.jobId),
          eq(setupSheets.isLatest, true)
        ))
        .limit(1);

      if (!sheet) return null;

      // Load all related data in parallel
      const [images, tools, workholding, versions] = await Promise.all([
        db.select().from(setupSheetImages)
          .where(eq(setupSheetImages.setupSheetId, sheet.id))
          .orderBy(setupSheetImages.displayOrder),
        db.select().from(setupTools)
          .where(eq(setupTools.setupSheetId, sheet.id))
          .orderBy(setupTools.displayOrder),
        db.select().from(setupWorkholding)
          .where(eq(setupWorkholding.setupSheetId, sheet.id))
          .orderBy(setupWorkholding.displayOrder),
        db.select().from(setupVersions)
          .where(eq(setupVersions.setupSheetId, sheet.id))
          .orderBy(desc(setupVersions.createdAt))
          .limit(10),
      ]);

      // Load annotations for each image
      const imagesWithAnnotations = await Promise.all(
        images.map(async (img) => {
          const anns = await db.select().from(setupAnnotations)
            .where(eq(setupAnnotations.imageId, img.id));
          return {
            ...img,
            annotations: anns.map(a => ({
              ...a,
              points: JSON.parse(a.points) as { x: number; y: number }[],
            })),
          };
        })
      );

      return {
        ...sheet,
        images: imagesWithAnnotations,
        tools,
        workholding,
        versions,
      };
    }),

  // ─── GET by Part Number — returns LATEST APPROVED setup for auto-load ───
  getByPartNumber: publicQuery
    .input(z.object({
      partNumber: z.string().min(1),
      revision: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = getDb();

      // Only return APPROVED setups for operator auto-load
      const conditions = [
        eq(setupSheets.partNumber, input.partNumber),
        eq(setupSheets.isLatest, true),
        eq(setupSheets.approvalStatus, "approved"),
      ];
      if (input.revision) {
        conditions.push(eq(setupSheets.revision, input.revision));
      }

      const [sheet] = await db.select().from(setupSheets)
        .where(and(...conditions))
        .limit(1);

      if (!sheet) return null;

      const [images, tools, workholding, versions] = await Promise.all([
        db.select().from(setupSheetImages)
          .where(eq(setupSheetImages.setupSheetId, sheet.id))
          .orderBy(setupSheetImages.displayOrder),
        db.select().from(setupTools)
          .where(eq(setupTools.setupSheetId, sheet.id))
          .orderBy(setupTools.displayOrder),
        db.select().from(setupWorkholding)
          .where(eq(setupWorkholding.setupSheetId, sheet.id))
          .orderBy(setupWorkholding.displayOrder),
        db.select().from(setupVersions)
          .where(eq(setupVersions.setupSheetId, sheet.id))
          .orderBy(desc(setupVersions.createdAt))
          .limit(10),
      ]);

      const imagesWithAnnotations = await Promise.all(
        images.map(async (img) => {
          const anns = await db.select().from(setupAnnotations)
            .where(eq(setupAnnotations.imageId, img.id));
          return {
            ...img,
            annotations: anns.map(a => ({
              ...a,
              points: JSON.parse(a.points) as { x: number; y: number }[],
            })),
          };
        })
      );

      return {
        ...sheet,
        images: imagesWithAnnotations,
        tools,
        workholding,
        versions,
      };
    }),

  // ─── LIST ALL setups (for Setup Library search) ───
  listAll: publicQuery
    .input(
      z.object({
        search: z.string().optional(),
        partNumber: z.string().optional(),
        material: z.string().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.search) {
        conditions.push(like(setupSheets.partNumber, `%${input.search}%`));
      }
      if (input?.partNumber) {
        conditions.push(like(setupSheets.partNumber, `%${input.partNumber}%`));
      }
      if (input?.material) {
        conditions.push(like(setupSheets.materialNumber, `%${input.material}%`));
      }
      const whereClause = conditions.length > 0 ? and(...conditions, eq(setupSheets.isLatest, true)) : eq(setupSheets.isLatest, true);
      const results = await db
        .select({
          id: setupSheets.id,
          jobId: setupSheets.jobId,
          partNumber: setupSheets.partNumber,
          revision: setupSheets.revision,
          materialNumber: setupSheets.materialNumber,
          operatorName: setupSheets.operatorName,
          version: setupSheets.version,
          isLatest: setupSheets.isLatest,
          approvalStatus: setupSheets.approvalStatus,
          approvedBy: setupSheets.approvedBy,
          approvedAt: setupSheets.approvedAt,
          copiedFromJobId: setupSheets.copiedFromJobId,
          copiedFromVersion: setupSheets.copiedFromVersion,
          createdAt: setupSheets.createdAt,
          updatedAt: setupSheets.updatedAt,
          generalNotes: setupSheets.generalNotes,
          jobNumber: jobs.jobNumber,
        })
        .from(setupSheets)
        .innerJoin(jobs, eq(setupSheets.jobId, jobs.id))
        .where(whereClause)
        .orderBy(desc(setupSheets.createdAt))
        .limit(input?.limit ?? 50)
        .offset(input?.offset ?? 0);
      const countResult = await db
        .select({ total: count() })
        .from(setupSheets)
        .where(eq(setupSheets.isLatest, true));
      return { results, total: Number(countResult[0]?.total ?? 0) };
    }),

  // ─── CREATE or UPDATE (upsert) ───
  save: publicQuery
    .input(z.object({
      jobId: z.number(),
      partNumber: z.string().min(1),
      revision: z.string().max(20).default("A"),
      materialNumber: z.string().min(1),
      operatorId: z.number(),
      operatorName: z.string().min(1),
      programNotes: z.string().optional().nullable(),
      generalNotes: z.string().optional().nullable(),
      workholding: z.array(workholdingInput).default([]),
      tools: z.array(toolInput).default([]),
      images: z.array(imageInput).default([]),
      copiedFromJobId: z.number().optional().nullable(),
      copiedFromVersion: z.number().optional().nullable(),
      changeSummary: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();

      try {
        // Verify job exists
        const [job] = await db
          .select({ id: jobs.id })
          .from(jobs)
          .where(eq(jobs.id, input.jobId))
          .limit(1);

        if (!job) {
          throw new Error(`Job ${input.jobId} not found`);
        }

        // Verify operator exists (if not demo)
        if (input.operatorId < 900000) {
          const [op] = await db
            .select({ id: operators.id })
            .from(operators)
            .where(eq(operators.id, input.operatorId))
            .limit(1);
          if (!op) {
            throw new Error(`Operator ID ${input.operatorId} not found. Please log in again.`);
          }
        }

        // Check if a setup already exists for this job
        const [existing] = await db
          .select()
          .from(setupSheets)
          .where(and(
            eq(setupSheets.jobId, input.jobId),
            eq(setupSheets.isLatest, true)
          ))
          .limit(1);

        let setupSheetId: number;
        let newVersion: number;

        if (existing) {
          // ─── UPDATE existing ───
          setupSheetId = existing.id;
          newVersion = existing.version + 1;

          // Save FULL version snapshot BEFORE updating
          const oldTools = await db.select().from(setupTools)
            .where(eq(setupTools.setupSheetId, existing.id));
          const oldWorkholding = await db.select().from(setupWorkholding)
            .where(eq(setupWorkholding.setupSheetId, existing.id));
          const oldImages = await db.select().from(setupSheetImages)
            .where(eq(setupSheetImages.setupSheetId, existing.id));

          await db.insert(setupVersions).values({
            setupSheetId: existing.id,
            version: existing.version,
            operatorId: input.operatorId,
            operatorName: input.operatorName,
            changeSummary: input.changeSummary || `Updated to version ${newVersion}`,
            snapshotData: JSON.stringify({
              programNotes: existing.programNotes,
              generalNotes: existing.generalNotes,
              updatedAt: existing.updatedAt,
              toolCount: oldTools.length,
              workholdingCount: oldWorkholding.length,
              imageCount: oldImages.length,
              tools: oldTools.map(t => ({ number: t.toolNumber, description: t.description, offset: t.offset })),
              workholding: oldWorkholding.map(w => ({ label: w.label, value: w.value })),
            }),
          });

          // Mark old as not latest
          await db.update(setupSheets)
            .set({ isLatest: false })
            .where(eq(setupSheets.id, existing.id));

          // Delete old related data (oldImages already fetched above for snapshot)
          if (oldImages.length > 0) {
            await db.delete(setupAnnotations)
              .where(inArray(setupAnnotations.imageId, oldImages.map(i => i.id)));
          }
          await db.delete(setupWorkholding)
            .where(eq(setupWorkholding.setupSheetId, existing.id));
          await db.delete(setupTools)
            .where(eq(setupTools.setupSheetId, existing.id));
          await db.delete(setupSheetImages)
            .where(eq(setupSheetImages.setupSheetId, existing.id));
        } else {
          newVersion = 1;
        }

        // ─── Create new setup sheet (or replacement) ───
        const [sheet] = await db.insert(setupSheets).values({
          jobId: input.jobId,
          partNumber: input.partNumber,
          revision: input.revision || "A",
          materialNumber: input.materialNumber,
          operatorId: input.operatorId,
          operatorName: input.operatorName,
          programNotes: input.programNotes ?? null,
          generalNotes: input.generalNotes ?? null,
          version: newVersion,
          isLatest: true,
          approvalStatus: "pending",
          copiedFromJobId: input.copiedFromJobId ?? null,
          copiedFromVersion: input.copiedFromVersion ?? null,
        }).returning();

        setupSheetId = sheet.id;

        // ─── Insert workholding ───
        if (input.workholding.length > 0) {
          await db.insert(setupWorkholding).values(
            input.workholding.map((wh) => ({
              setupSheetId,
              label: wh.label,
              value: wh.value || "",
              displayOrder: wh.displayOrder,
            }))
          );
        }

        // ─── Insert tools ───
        if (input.tools.length > 0) {
          await db.insert(setupTools).values(
            input.tools.map((t) => ({
              setupSheetId,
              toolNumber: t.toolNumber,
              description: t.description || null,
              toolId: t.toolId || null,
              offset: t.offset || null,
              displayOrder: t.displayOrder,
            }))
          );
        }

        // ─── Insert images + annotations ───
        for (const img of input.images) {
          const [imageRecord] = await db.insert(setupSheetImages).values({
            setupSheetId,
            imageData: img.imageData,
            displayOrder: img.displayOrder,
          }).returning();

          if (img.annotations.length > 0) {
            await db.insert(setupAnnotations).values(
              img.annotations.map((ann) => ({
                imageId: imageRecord.id,
                type: ann.type,
                color: ann.color,
                points: JSON.stringify(ann.points),
                text: ann.text || null,
                number: ann.number ?? null,
                strokeWidth: ann.strokeWidth ?? null,
              }))
            );
          }
        }

        return {
          success: true,
          setupSheetId,
          version: newVersion,
          message: existing
            ? `Setup updated to version ${newVersion}`
            : `Setup created (version ${newVersion})`,
        };
      } catch (error: any) {
        console.error("Setup sheet save error:", error);
        // Extract the actual PostgreSQL error message
        const pgMessage = error?.message || String(error);
        if (pgMessage.includes("foreign key constraint")) {
          throw new Error(`Database reference error: ${pgMessage}. The operator or job may not exist in the database.`);
        }
        if (pgMessage.includes("null value in column")) {
          throw new Error(`Missing required field: ${pgMessage}`);
        }
        throw new Error(`Save failed: ${pgMessage}`);
      }
    }),

  // ─── GET version history ───
  getVersions: publicQuery
    .input(z.object({ setupSheetId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(setupVersions)
        .where(eq(setupVersions.setupSheetId, input.setupSheetId))
        .orderBy(desc(setupVersions.createdAt));
    }),

  // ─── GET setup sheets by part number (list) ───
  listByPartNumber: publicQuery
    .input(z.object({ partNumber: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select()
        .from(setupSheets)
        .where(and(
          eq(setupSheets.partNumber, input.partNumber),
          eq(setupSheets.isLatest, true)
        ))
        .orderBy(desc(setupSheets.createdAt));
    }),

  // ─── APPROVE a setup (supervisor action) ───
  approveSetup: publicQuery
    .input(z.object({
      setupSheetId: z.number(),
      approverName: z.string().min(1),
      status: z.enum(["approved", "rejected"]).default("approved"),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();

      // Mark the target setup as approved/rejected
      await db.update(setupSheets)
        .set({
          approvalStatus: input.status,
          approvedBy: input.status === "approved" ? input.approverName : null,
          approvedAt: input.status === "approved" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(setupSheets.id, input.setupSheetId));

      return {
        success: true,
        message: input.status === "approved"
          ? "Setup approved and published to operators"
          : "Setup rejected — operator must revise",
        status: input.status,
      };
    }),
});
