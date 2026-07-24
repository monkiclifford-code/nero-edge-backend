import { pgTable, serial, varchar, timestamp, decimal, boolean, text, pgEnum, integer } from "drizzle-orm/pg-core";

// ═══════════════════════════════════════════════════════════
// CONSTANTS (also exported for server-side usage)
// ═══════════════════════════════════════════════════════════

export const NCR_CLASSIFICATIONS = ["foundry", "machining", "tooling", "supplier"] as const;

export const FOUNDRY_DEFECT_TYPES = [
  "blow_hole", "porosity", "corrosion", "crack", "sand_inclusion",
  "shrinkage", "surface_defect", "hard_spot", "misrun", "dimensional_shift", "other"
] as const;

export const SEVERITY_LEVELS = ["critical", "major", "minor", "observation"] as const;

export const AI_VISION_PROVIDERS = ["mock", "openai", "ollama", "deepseek", "yolo_local"] as const;

// ===== ENUMS =====
export const jobStatusEnum = pgEnum("job_status", ["active", "completed", "on_hold"]);
export const programTypeEnum = pgEnum("program_type", ["facing", "od_turning", "id_turning", "drilling"]);
export const feedbackResultEnum = pgEnum("feedback_result", ["pass", "fail"]);
export const ncrClassificationEnum = pgEnum("ncr_classification", ["foundry", "machining", "tooling", "supplier"]);
export const defectTypeEnum = pgEnum("defect_type", [
  "blow_hole", "porosity", "corrosion", "crack", "sand_inclusion",
  "shrinkage", "surface_defect", "hard_spot", "misrun", "dimensional_shift", "other"
]);
export const aiProviderEnum = pgEnum("ai_provider", ["mock", "openai", "ollama", "deepseek", "yolo_local"]);
export const severityEnum = pgEnum("severity", ["critical", "major", "minor", "observation"]);
export const foundryStatusEnum = pgEnum("foundry_status", ["open", "in_progress", "resolved", "closed"]);
export const predictionStatusEnum = pgEnum("prediction_status", ["pending", "processing", "completed", "failed"]);
export const batchStatusEnum = pgEnum("batch_status", ["poured", "cooling", "fettled", "inspected", "shipped"]);
export const approvalStatusEnum = pgEnum("approval_status", ["pending", "approved", "rejected"]);

// ===== OPERATORS =====
export const operators = pgTable("operators", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  operatorId: varchar("operator_id", { length: 50 }).notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== JOBS =====
export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  jobNumber: varchar("job_number", { length: 50 }).notNull(),
  partNumber: varchar("part_number", { length: 100 }).notNull(),
  materialNumber: varchar("material_number", { length: 100 }).notNull(),
  revision: varchar("revision", { length: 20 }).notNull().default("A"),
  operatorId: integer("operator_id").notNull().references(() => operators.id, { onDelete: "cascade" }),
  status: jobStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ===== INSPECTIONS =====
export const inspections = pgTable("inspections", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  operatorId: integer("operator_id").notNull().references(() => operators.id, { onDelete: "cascade" }),
  notes: text("notes"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  durationSeconds: integer("duration_seconds"),
  failCount: integer("fail_count").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== INSPECTION ITEMS =====
export const inspectionItems = pgTable("inspection_items", {
  id: serial("id").primaryKey(),
  inspectionId: integer("inspection_id").notNull().references(() => inspections.id, { onDelete: "cascade" }),
  dimensionName: varchar("dimension_name", { length: 100 }).notNull(),
  nominalValue: decimal("nominal_value", { precision: 12, scale: 4 }).notNull(),
  tolerancePlus: decimal("tolerance_plus", { precision: 12, scale: 4 }).notNull(),
  toleranceMinus: decimal("tolerance_minus", { precision: 12, scale: 4 }).notNull(),
  measuredValue: decimal("measured_value", { precision: 12, scale: 4 }),
  isPass: boolean("is_pass"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== SETUP IMAGES =====
export const setupImages = pgTable("setup_images", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  imageUrl: varchar("image_url", { length: 500 }).notNull(),
  uploadedBy: integer("uploaded_by").notNull().references(() => operators.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== NCR =====
export const ncr = pgTable("ncr", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  operatorId: integer("operator_id").notNull().references(() => operators.id, { onDelete: "cascade" }),
  inspectionId: integer("inspection_id").references(() => inspections.id, { onDelete: "set null" }),
  problemDescription: text("problem_description").notNull(),
  rootCause: text("root_cause").notNull(),
  correctiveAction: text("corrective_action").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== CNC PROGRAMS =====
export const cncPrograms = pgTable("cnc_programs", {
  id: serial("id").primaryKey(),
  operatorId: integer("operator_id").notNull().references(() => operators.id, { onDelete: "cascade" }),
  jobId: integer("job_id").references(() => jobs.id, { onDelete: "set null" }),
  programType: programTypeEnum("program_type").notNull(),
  parameters: text("parameters").notNull(),
  gcodeText: text("gcode_text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== JOB FEEDBACK =====
export const jobFeedback = pgTable("job_feedback", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  operatorId: integer("operator_id").notNull().references(() => operators.id, { onDelete: "cascade" }),
  programId: integer("program_id").references(() => cncPrograms.id, { onDelete: "set null" }),
  result: feedbackResultEnum("result").notNull(),
  offsetAdjustment: decimal("offset_adjustment", { precision: 12, scale: 4 }),
  toolChange: boolean("tool_change").default(false),
  feedAdjustment: decimal("feed_adjustment", { precision: 8, scale: 4 }),
  speedAdjustment: integer("speed_adjustment"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== NCR WHYS =====
export const ncrWhys = pgTable("ncr_whys", {
  id: serial("id").primaryKey(),
  ncrId: integer("ncr_id").notNull().references(() => ncr.id, { onDelete: "cascade" }),
  whyLevel: integer("why_level").notNull(),
  answer: text("answer").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== FOUNDRY NCRs =====
export const foundryNcrs = pgTable("foundry_ncrs", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  operatorId: integer("operator_id").notNull().references(() => operators.id, { onDelete: "cascade" }),
  castingBatchId: integer("casting_batch_id"),
  ncrType: ncrClassificationEnum("ncr_type").notNull().default("foundry"),
  defectType: defectTypeEnum("defect_type").notNull(),
  problemDescription: text("problem_description").notNull(),
  rootCause: text("root_cause"),
  correctiveAction: text("corrective_action"),
  severity: severityEnum("severity").notNull().default("major"),
  status: foundryStatusEnum("status").notNull().default("open"),
  scrapQuantified: boolean("scrap_quantified").default(false),
  scrapCost: decimal("scrap_cost", { precision: 12, scale: 2 }),
  // ── Version Control ──
  version: integer("version").notNull().default(1),
  isLatest: boolean("is_latest").notNull().default(true),
  approvalStatus: approvalStatusEnum("approval_status").notNull().default("pending"),
  approvedBy: varchar("approved_by", { length: 100 }),
  approvedAt: timestamp("approved_at"),
  changeSummary: text("change_summary"),
  updatedBy: varchar("updated_by", { length: 100 }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== FOUNDRY NCR VERSIONS (version history snapshots) =====
export const foundryNcrVersions = pgTable("foundry_ncr_versions", {
  id: serial("id").primaryKey(),
  foundryNcrId: integer("foundry_ncr_id").notNull().references(() => foundryNcrs.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  operatorId: integer("operator_id").notNull().references(() => operators.id, { onDelete: "cascade" }),
  operatorName: varchar("operator_name", { length: 100 }).notNull(),
  changeSummary: text("change_summary"),
  snapshotData: text("snapshot_data").notNull(), // Full JSON snapshot
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== FOUNDRY NCR IMAGES =====
export const foundryNcrImages = pgTable("foundry_ncr_images", {
  id: serial("id").primaryKey(),
  foundryNcrId: integer("foundry_ncr_id").notNull().references(() => foundryNcrs.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  uploadedBy: integer("uploaded_by").notNull().references(() => operators.id, { onDelete: "cascade" }),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 50 }),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== FOUNDRY KNOWLEDGE BASE (AI defect analysis) =====
export const foundryKnowledge = pgTable("foundry_knowledge", {
  id: serial("id").primaryKey(),
  defectType: defectTypeEnum("defect_type").notNull(),
  possibleCauses: text("possible_causes").notNull(),
  inspectionMethods: text("inspection_methods"),
  correctiveActions: text("corrective_actions").notNull(),
  preventiveActions: text("preventive_actions"),
  lessonsLearned: text("lessons_learned"),
  severityIndicators: text("severity_indicators"),
  relatedDefects: text("related_defects"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ===== FOUNDRY DEFECTS =====
export const foundryDefects = pgTable("foundry_defects", {
  id: serial("id").primaryKey(),
  foundryNcrId: integer("foundry_ncr_id").notNull().references(() => foundryNcrs.id, { onDelete: "cascade" }),
  partNumber: varchar("part_number", { length: 100 }).notNull(),
  defectType: defectTypeEnum("defect_type").notNull(),
  description: text("description"),
  location: varchar("location", { length: 100 }),
  confidence: decimal("confidence", { precision: 5, scale: 2 }),
  aiPredicted: boolean("ai_predicted").default(false),
  imageId: integer("image_id").references(() => foundryNcrImages.id, { onDelete: "set null" }),
  isRepeat: boolean("is_repeat").default(false),
  previousOccurrenceId: integer("previous_occurrence_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== AI VISUAL PREDICTIONS =====
export const aiVisualPredictions = pgTable("ai_visual_predictions", {
  id: serial("id").primaryKey(),
  imageId: integer("image_id").notNull().references(() => foundryNcrImages.id, { onDelete: "cascade" }),
  provider: aiProviderEnum("provider").notNull().default("mock"),
  model: varchar("model", { length: 100 }),
  predictedDefectType: defectTypeEnum("predicted_defect_type"),
  confidence: decimal("confidence", { precision: 5, scale: 2 }),
  allPredictions: text("all_predictions"),
  rawResponse: text("raw_response"),
  processingTimeMs: integer("processing_time_ms"),
  status: predictionStatusEnum("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== CASTING BATCHES =====
export const castingBatches = pgTable("casting_batches", {
  id: serial("id").primaryKey(),
  batchNumber: varchar("batch_number", { length: 50 }).notNull().unique(),
  partNumber: varchar("part_number", { length: 100 }).notNull(),
  material: varchar("material", { length: 100 }),
  furnaceId: varchar("furnace_id", { length: 50 }),
  operatorId: integer("operator_id").references(() => operators.id, { onDelete: "set null" }),
  quantity: integer("quantity").default(0),
  quantityScrap: integer("quantity_scrap").default(0),
  pourDate: timestamp("pour_date"),
  status: batchStatusEnum("status").notNull().default("poured"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════
// SETUP SHEET SYSTEM — Persistent database-driven setup library
// ═══════════════════════════════════════════════════════════

export const setupSheets = pgTable("setup_sheets", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  partNumber: varchar("part_number", { length: 100 }).notNull(),
  revision: varchar("revision", { length: 20 }).notNull().default("A"),
  materialNumber: varchar("material_number", { length: 100 }).notNull(),
  operatorId: integer("operator_id").notNull().references(() => operators.id, { onDelete: "cascade" }),
  operatorName: varchar("operator_name", { length: 100 }).notNull(),
  programNotes: text("program_notes"),       // JSON string of program notes
  generalNotes: text("general_notes"),       // Setup notes
  version: integer("version").notNull().default(1),
  isLatest: boolean("is_latest").notNull().default(true),
  approvalStatus: approvalStatusEnum("approval_status").notNull().default("pending"),
  approvedBy: varchar("approved_by", { length: 100 }),
  approvedAt: timestamp("approved_at"),
  copiedFromJobId: integer("copied_from_job_id"),
  copiedFromVersion: integer("copied_from_version"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const setupSheetImages = pgTable("setup_sheet_images", {
  id: serial("id").primaryKey(),
  setupSheetId: integer("setup_sheet_id").notNull().references(() => setupSheets.id, { onDelete: "cascade" }),
  imageData: text("image_data").notNull(),    // base64 data URL
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const setupAnnotations = pgTable("setup_annotations", {
  id: serial("id").primaryKey(),
  imageId: integer("image_id").notNull().references(() => setupSheetImages.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 30 }).notNull(),
  color: varchar("color", { length: 20 }).notNull(),
  points: text("points").notNull(),           // JSON array of {x,y}
  text: varchar("text", { length: 500 }),
  number: integer("number"),
  strokeWidth: integer("stroke_width"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const setupTools = pgTable("setup_tools", {
  id: serial("id").primaryKey(),
  setupSheetId: integer("setup_sheet_id").notNull().references(() => setupSheets.id, { onDelete: "cascade" }),
  toolNumber: varchar("tool_number", { length: 20 }).notNull(),
  description: varchar("description", { length: 200 }),
  toolId: varchar("tool_id", { length: 100 }),
  offset: varchar("offset", { length: 50 }),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const setupWorkholding = pgTable("setup_workholding", {
  id: serial("id").primaryKey(),
  setupSheetId: integer("setup_sheet_id").notNull().references(() => setupSheets.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 100 }).notNull(),
  value: varchar("value", { length: 300 }),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const setupVersions = pgTable("setup_versions", {
  id: serial("id").primaryKey(),
  setupSheetId: integer("setup_sheet_id").notNull().references(() => setupSheets.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  operatorId: integer("operator_id").notNull().references(() => operators.id, { onDelete: "cascade" }),
  operatorName: varchar("operator_name", { length: 100 }).notNull(),
  changeSummary: text("change_summary"),
  snapshotData: text("snapshot_data").notNull(), // Full JSON snapshot
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
