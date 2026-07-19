import { relations } from "drizzle-orm";
import {
  operators, jobs, inspections, inspectionItems,
  setupImages, ncr, ncrWhys, cncPrograms, jobFeedback,
  foundryNcrs, foundryNcrImages, foundryDefects,
  aiVisualPredictions, castingBatches,
  setupSheets, setupSheetImages, setupAnnotations, setupTools, setupWorkholding, setupVersions,
} from "./schema";

export const operatorsRelations = relations(operators, ({ many }) => ({
  jobs: many(jobs),
  inspections: many(inspections),
  setupImages: many(setupImages),
  ncrs: many(ncr),
  cncPrograms: many(cncPrograms),
  feedbacks: many(jobFeedback),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  operator: one(operators, { fields: [jobs.operatorId], references: [operators.id] }),
  inspections: many(inspections),
  setupImages: many(setupImages),
  ncrs: many(ncr),
  cncPrograms: many(cncPrograms),
  feedbacks: many(jobFeedback),
}));

export const inspectionsRelations = relations(inspections, ({ one, many }) => ({
  job: one(jobs, { fields: [inspections.jobId], references: [jobs.id] }),
  operator: one(operators, { fields: [inspections.operatorId], references: [operators.id] }),
  items: many(inspectionItems),
  ncr: one(ncr, { fields: [inspections.id], references: [ncr.inspectionId] }),
}));

export const inspectionItemsRelations = relations(inspectionItems, ({ one }) => ({
  inspection: one(inspections, { fields: [inspectionItems.inspectionId], references: [inspections.id] }),
}));

export const setupImagesRelations = relations(setupImages, ({ one }) => ({
  job: one(jobs, { fields: [setupImages.jobId], references: [jobs.id] }),
  uploader: one(operators, { fields: [setupImages.uploadedBy], references: [operators.id] }),
}));

export const ncrRelations = relations(ncr, ({ one, many }) => ({
  job: one(jobs, { fields: [ncr.jobId], references: [jobs.id] }),
  operator: one(operators, { fields: [ncr.operatorId], references: [operators.id] }),
  inspection: one(inspections, { fields: [ncr.inspectionId], references: [inspections.id] }),
  whys: many(ncrWhys),
}));

export const ncrWhysRelations = relations(ncrWhys, ({ one }) => ({
  ncr: one(ncr, { fields: [ncrWhys.ncrId], references: [ncr.id] }),
}));

export const cncProgramsRelations = relations(cncPrograms, ({ one, many }) => ({
  operator: one(operators, { fields: [cncPrograms.operatorId], references: [operators.id] }),
  job: one(jobs, { fields: [cncPrograms.jobId], references: [jobs.id] }),
  feedbacks: many(jobFeedback),
}));

export const jobFeedbackRelations = relations(jobFeedback, ({ one }) => ({
  job: one(jobs, { fields: [jobFeedback.jobId], references: [jobs.id] }),
  operator: one(operators, { fields: [jobFeedback.operatorId], references: [operators.id] }),
  program: one(cncPrograms, { fields: [jobFeedback.programId], references: [cncPrograms.id] }),
}));

// ═══════════════════════════════════════════════════════════
// PHASE 7 — FOUNDRY RELATIONS
// ═══════════════════════════════════════════════════════════

export const foundryNcrsRelations = relations(foundryNcrs, ({ one, many }) => ({
  job: one(jobs, { fields: [foundryNcrs.jobId], references: [jobs.id] }),
  operator: one(operators, { fields: [foundryNcrs.operatorId], references: [operators.id] }),
  castingBatch: one(castingBatches, { fields: [foundryNcrs.castingBatchId], references: [castingBatches.id] }),
  images: many(foundryNcrImages),
  defects: many(foundryDefects),
}));

export const foundryNcrImagesRelations = relations(foundryNcrImages, ({ one, many }) => ({
  foundryNcr: one(foundryNcrs, { fields: [foundryNcrImages.foundryNcrId], references: [foundryNcrs.id] }),
  uploader: one(operators, { fields: [foundryNcrImages.uploadedBy], references: [operators.id] }),
  aiPredictions: many(aiVisualPredictions),
  linkedDefect: one(foundryDefects, { fields: [foundryNcrImages.id], references: [foundryDefects.imageId] }),
}));

export const foundryDefectsRelations = relations(foundryDefects, ({ one }) => ({
  foundryNcr: one(foundryNcrs, { fields: [foundryDefects.foundryNcrId], references: [foundryNcrs.id] }),
  image: one(foundryNcrImages, { fields: [foundryDefects.imageId], references: [foundryNcrImages.id] }),
}));

export const aiVisualPredictionsRelations = relations(aiVisualPredictions, ({ one }) => ({
  image: one(foundryNcrImages, { fields: [aiVisualPredictions.imageId], references: [foundryNcrImages.id] }),
}));

export const castingBatchesRelations = relations(castingBatches, ({ one, many }) => ({
  operator: one(operators, { fields: [castingBatches.operatorId], references: [operators.id] }),
  foundryNcrs: many(foundryNcrs),
}));

// ═══════════════════════════════════════════════════════════
// SETUP SHEET RELATIONS
// ═══════════════════════════════════════════════════════════

export const setupSheetsRelations = relations(setupSheets, ({ one, many }) => ({
  job: one(jobs, { fields: [setupSheets.jobId], references: [jobs.id] }),
  operator: one(operators, { fields: [setupSheets.operatorId], references: [operators.id] }),
  images: many(setupSheetImages),
  tools: many(setupTools),
  workholding: many(setupWorkholding),
  versions: many(setupVersions),
}));

export const setupSheetImagesRelations = relations(setupSheetImages, ({ one, many }) => ({
  setupSheet: one(setupSheets, { fields: [setupSheetImages.setupSheetId], references: [setupSheets.id] }),
  annotations: many(setupAnnotations),
}));

export const setupAnnotationsRelations = relations(setupAnnotations, ({ one }) => ({
  image: one(setupSheetImages, { fields: [setupAnnotations.imageId], references: [setupSheetImages.id] }),
}));

export const setupToolsRelations = relations(setupTools, ({ one }) => ({
  setupSheet: one(setupSheets, { fields: [setupTools.setupSheetId], references: [setupSheets.id] }),
}));

export const setupWorkholdingRelations = relations(setupWorkholding, ({ one }) => ({
  setupSheet: one(setupSheets, { fields: [setupWorkholding.setupSheetId], references: [setupSheets.id] }),
}));

export const setupVersionsRelations = relations(setupVersions, ({ one }) => ({
  setupSheet: one(setupSheets, { fields: [setupVersions.setupSheetId], references: [setupSheets.id] }),
  operator: one(operators, { fields: [setupVersions.operatorId], references: [operators.id] }),
}));
