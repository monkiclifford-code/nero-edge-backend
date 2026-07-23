import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  setupSheets, setupSheetImages, setupAnnotations,
  setupTools, setupWorkholding, setupVersions,
  jobs,
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
  number: z.number().optional(),
  strokeWidth: z.number().optional(),
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

  // ─── GET by Part Number ───
  getByPartNumber: publicQuery
    .input(z.object({
      partNumber: z.string().min(1),
      revision: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = getDb();

      let query = db.select().from(setupSheets)
        .where(and(
          eq(setupSheets.partNumber, input.partNumber),
          eq(setupSheets.isLatest, true)
        ))
        .limit(1);

      if (input.revision) {
        query = db.select().from(setupSheets)
          .where(and(
            eq(setupSheets.partNumber, input.partNumber),
            eq(setupSheets.revision, input.revision),
            eq(setupSheets.isLatest, true)
          ))
          .limit(1);
      }

      const [sheet] = await query;
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
      partNumber: z.string(),
      revision: z.string().default("A"),
      materialNumber: z.string(),
      operatorId: z.number(),
      operatorName: z.string(),
      programNotes: z.string().optional(),
      generalNotes: z.string().optional(),
      workholding: z.array(workholdingInput).default([]),
      tools: z.array(toolInput).default([]),
      images: z.array(imageInput).default([]),
      copiedFromJobId: z.number().optional(),
      copiedFromVersion: z.number().optional(),
      changeSummary: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();

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

        // Save version snapshot BEFORE updating
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
          }),
        });

        // Mark old as not latest
        await db.update(setupSheets)
          .set({ isLatest: false })
          .where(eq(setupSheets.id, existing.id));

        // Delete old related data (get image IDs first, then delete annotations)
        const oldImages = await db.select({ id: setupSheetImages.id })
          .from(setupSheetImages)
          .where(eq(setupSheetImages.setupSheetId, existing.id));
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
        revision: input.revision,
        materialNumber: input.materialNumber,
        operatorId: input.operatorId,
        operatorName: input.operatorName,
        programNotes: input.programNotes || null,
        generalNotes: input.generalNotes || null,
        version: newVersion,
        isLatest: true,
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
              number: ann.number || null,
              strokeWidth: ann.strokeWidth || null,
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
});
