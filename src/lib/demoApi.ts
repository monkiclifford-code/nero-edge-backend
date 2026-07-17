export function isDemoMode(): boolean {
  return localStorage.getItem("cnc_demo_mode") === "true";
}

export function getDemoOperator(): { id: number; name: string; operatorId: string } | null {
  const saved = localStorage.getItem("cnc_operator");
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

// Demo data stores (in-memory for session, plus localStorage persistence)
let demoJobs: Array<{
  id: number;
  jobNumber: string;
  partNumber: string;
  materialNumber: string;
  revision: string;
  operatorId: number;
  status: string;
  createdAt: string;
}> = [];

let demoInspections: Array<{
  id: number;
  jobId: number;
  operatorId: number;
  notes?: string;
  items: Array<{
    dimensionName: string;
    nominalValue: number;
    tolerancePlus: number;
    toleranceMinus: number;
    measuredValue: number;
    isPass: boolean;
  }>;
  createdAt: string;
}> = [];

let demoNcrs: Array<{
  id: number;
  jobId: number;
  operatorId: number;
  inspectionId?: number;
  problemDescription: string;
  whys: Array<{ whyLevel: number; answer: string }>;
  rootCause: string;
  correctiveAction: string;
  createdAt: string;
}> = [];

let demoPrograms: Array<{
  id: number;
  operatorId: number;
  jobId?: number;
  programType: string;
  parameters: string;
  gcodeText: string;
  createdAt: string;
}> = [];

let demoFeedback: Array<{
  id: number;
  jobId: number;
  operatorId: number;
  programId?: number;
  result: "pass" | "fail";
  offsetAdjustment?: number;
  toolChange: boolean;
  feedAdjustment?: number;
  speedAdjustment?: number;
  notes?: string;
  createdAt: string;
}> = [];

let demoNextId = { jobs: 1, inspections: 1, ncrs: 1, programs: 1, feedback: 1, foundryNcrs: 1, foundryImages: 1, foundryDefects: 1, batches: 1, aiPredictions: 1 };

// Phase 7 — Foundry demo data
let demoFoundryNcrs: Array<{
  id: number;
  jobId: number;
  operatorId: number;
  castingBatchId?: number;
  ncrType: string;
  defectType: string;
  problemDescription: string;
  rootCause?: string;
  correctiveAction?: string;
  severity: string;
  status: string;
  scrapQuantified: boolean;
  scrapCost?: number;
  createdAt: string;
}> = [];

let demoFoundryImages: Array<{
  id: number;
  foundryNcrId: number;
  imageUrl: string;
  thumbnailUrl?: string;
  uploadedBy: number;
  createdAt: string;
}> = [];

let demoFoundryDefects: Array<{
  id: number;
  foundryNcrId: number;
  partNumber: string;
  defectType: string;
  description?: string;
  location?: string;
  confidence?: string;
  aiPredicted: boolean;
  imageId?: number;
  isRepeat: boolean;
  createdAt: string;
}> = [];

let demoCastingBatches: Array<{
  id: number;
  batchNumber: string;
  partNumber: string;
  material?: string;
  furnaceId?: string;
  quantity: number;
  quantityScrap: number;
  status: string;
  createdAt: string;
}> = [];

let demoAiPredictions: Array<{
  id: number;
  imageId: number;
  provider: string;
  model?: string;
  predictedDefectType?: string;
  confidence?: string;
  allPredictions?: string;
  processingTimeMs?: number;
  status: string;
  createdAt: string;
}> = [];

// Load from localStorage on init
function loadDemoData() {
  const jobs = localStorage.getItem("cnc_demo_jobs");
  const inspections = localStorage.getItem("cnc_demo_inspections");
  const ncrs = localStorage.getItem("cnc_demo_ncrs");
  const programs = localStorage.getItem("cnc_demo_programs");
  const feedback = localStorage.getItem("cnc_demo_feedback");
  const ids = localStorage.getItem("cnc_demo_ids");
  const fNcrs = localStorage.getItem("cnc_demo_foundry_ncrs");
  const fImages = localStorage.getItem("cnc_demo_foundry_images");
  const fDefects = localStorage.getItem("cnc_demo_foundry_defects");
  const batches = localStorage.getItem("cnc_demo_batches");
  const aiPreds = localStorage.getItem("cnc_demo_ai_predictions");

  if (jobs) demoJobs = JSON.parse(jobs);
  if (inspections) demoInspections = JSON.parse(inspections);
  if (ncrs) demoNcrs = JSON.parse(ncrs);
  if (programs) demoPrograms = JSON.parse(programs);
  if (feedback) demoFeedback = JSON.parse(feedback);
  if (ids) demoNextId = JSON.parse(ids);
  if (fNcrs) demoFoundryNcrs = JSON.parse(fNcrs);
  // Images NOT loaded from localStorage — base64 data URLs exceed quota.
  // if (fImages) demoFoundryImages = JSON.parse(fImages);
  if (fDefects) demoFoundryDefects = JSON.parse(fDefects);
  if (batches) demoCastingBatches = JSON.parse(batches);
  if (aiPreds) demoAiPredictions = JSON.parse(aiPreds);
}

function saveDemoData() {
  localStorage.setItem("cnc_demo_jobs", JSON.stringify(demoJobs));
  localStorage.setItem("cnc_demo_inspections", JSON.stringify(demoInspections));
  localStorage.setItem("cnc_demo_ncrs", JSON.stringify(demoNcrs));
  localStorage.setItem("cnc_demo_programs", JSON.stringify(demoPrograms));
  localStorage.setItem("cnc_demo_feedback", JSON.stringify(demoFeedback));
  localStorage.setItem("cnc_demo_ids", JSON.stringify(demoNextId));
  localStorage.setItem("cnc_demo_foundry_ncrs", JSON.stringify(demoFoundryNcrs));
  // Images NOT saved to localStorage — base64 data URLs exceed quota. Kept in memory only.
  // localStorage.setItem("cnc_demo_foundry_images", JSON.stringify(demoFoundryImages));
  localStorage.setItem("cnc_demo_foundry_defects", JSON.stringify(demoFoundryDefects));
  localStorage.setItem("cnc_demo_batches", JSON.stringify(demoCastingBatches));
  localStorage.setItem("cnc_demo_ai_predictions", JSON.stringify(demoAiPredictions));
}

// Seed demo foundry data if empty
function seedFoundryData() {
  if (demoFoundryNcrs.length > 0) return;

  const defectTypes = ["porosity", "blow_hole", "shrinkage", "sand_inclusion", "crack", "surface_defect", "misrun", "hard_spot"];
  const severities = ["critical", "major", "minor"];
  const statuses = ["open", "in_progress", "resolved"];
  const now = new Date();

  // Seed 8 foundry NCRs
  for (let i = 0; i < 8; i++) {
    const ncrId = demoNextId.foundryNcrs++;
    const defectType = defectTypes[i % defectTypes.length];
    const date = new Date(now.getTime() - i * 86400000 * (1 + Math.floor(Math.random() * 3)));
    demoFoundryNcrs.push({
      id: ncrId,
      jobId: i + 1,
      operatorId: 1,
      ncrType: i < 6 ? "foundry" : i === 6 ? "machining" : "supplier",
      defectType,
      problemDescription: `${defectType.replace("_", " ")} detected on casting surface during inspection`,
      rootCause: i % 2 === 0 ? "Inadequate venting in mold" : "Excessive moisture in sand",
      correctiveAction: i % 2 === 0 ? "Increase vent holes and check pattern alignment" : "Reduce sand moisture to 3-4%",
      severity: severities[i % severities.length],
      status: statuses[i % statuses.length],
      scrapQuantified: i < 4,
      scrapCost: i < 4 ? 250 + i * 150 : undefined,
      createdAt: date.toISOString(),
    });

    // Seed images for each NCR
    const imgId = demoNextId.foundryImages++;
    demoFoundryImages.push({
      id: imgId,
      foundryNcrId: ncrId,
      imageUrl: `https://picsum.photos/seed/foundry${ncrId}/800/600`,
      thumbnailUrl: `https://picsum.photos/seed/foundry${ncrId}/200/150`,
      uploadedBy: 1,
      createdAt: date.toISOString(),
    });

    // Seed AI predictions for images
    demoAiPredictions.push({
      id: demoNextId.aiPredictions++,
      imageId: imgId,
      provider: "mock",
      model: "forgeraceiq-vision-mock-v1",
      predictedDefectType: defectType,
      confidence: String(60 + (i % 30)),
      allPredictions: JSON.stringify([
        { defectType, confidence: 60 + (i % 30) },
        { defectType: defectTypes[(i + 1) % defectTypes.length], confidence: 15 + (i % 15) },
      ]),
      processingTimeMs: 450 + i * 50,
      status: "completed",
      createdAt: date.toISOString(),
    });

    // Seed defects
    demoFoundryDefects.push({
      id: demoNextId.foundryDefects++,
      foundryNcrId: ncrId,
      partNumber: `PN-CAST-${1000 + i}`,
      defectType,
      description: `${defectType.replace("_", " ")} found on upper surface of casting`,
      location: "upper_surface",
      confidence: String(60 + (i % 30)),
      aiPredicted: true,
      imageId: imgId,
      isRepeat: i >= 3,
      createdAt: date.toISOString(),
    });

    // Seed casting batches
    demoCastingBatches.push({
      id: demoNextId.batches++,
      batchNumber: `BATCH-${2025}-${String(i + 1).padStart(3, "0")}`,
      partNumber: `PN-CAST-${1000 + i}`,
      material: "ASTM A48 Class 30 Gray Iron",
      furnaceId: `FURNACE-${(i % 3) + 1}`,
      quantity: 50 + i * 10,
      quantityScrap: i < 3 ? 2 + i : 1,
      status: ["poured", "cooling", "fettled", "inspected"][i % 4],
      createdAt: date.toISOString(),
    });
  }

  saveDemoData();
}

loadDemoData();
seedFoundryData();

// Demo API functions
export const demoApi = {
  createJob(data: { jobNumber: string; partNumber: string; materialNumber: string; revision: string; operatorId: number }) {
    const job = { id: demoNextId.jobs++, ...data, status: "active", createdAt: new Date().toISOString() };
    demoJobs.push(job);
    saveDemoData();
    return { success: true, job };
  },

  getJobById(id: number) {
    return demoJobs.find((j) => j.id === id) ?? null;
  },

  listJobs() {
    return [...demoJobs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  createInspection(data: {
    jobId: number;
    operatorId: number;
    notes?: string;
    items: Array<{
      dimensionName: string;
      nominalValue: number;
      tolerancePlus: number;
      toleranceMinus: number;
      measuredValue: number;
      isPass: boolean;
    }>;
  }) {
    const inspection = { id: demoNextId.inspections++, ...data, createdAt: new Date().toISOString() };
    demoInspections.push(inspection);
    saveDemoData();
    const failCount = data.items.filter((i) => !i.isPass).length;
    return { success: true, inspectionId: inspection.id, durationSeconds: 120, failCount };
  },

  getInspectionItems(inspectionId: number) {
    const ins = demoInspections.find((i) => i.id === inspectionId);
    return ins?.items ?? [];
  },

  createNcr(data: {
    jobId: number;
    operatorId: number;
    inspectionId?: number;
    problemDescription: string;
    whys: Array<{ whyLevel: number; answer: string }>;
    rootCause: string;
    correctiveAction: string;
  }) {
    const ncr = { id: demoNextId.ncrs++, ...data, createdAt: new Date().toISOString() };
    demoNcrs.push(ncr);
    saveDemoData();
    return { success: true, ncrId: ncr.id };
  },

  getNcrByPartNumber(partNumber: string) {
    return demoNcrs
      .filter((n) => {
        const job = demoJobs.find((j) => j.id === n.jobId);
        return job?.partNumber === partNumber;
      })
      .map((n) => {
        const job = demoJobs.find((j) => j.id === n.jobId);
        return {
          ncrId: n.id,
          jobId: n.jobId,
          problemDescription: n.problemDescription,
          rootCause: n.rootCause,
          correctiveAction: n.correctiveAction,
          createdAt: n.createdAt,
          jobNumber: job?.jobNumber ?? "",
          partNumber: job?.partNumber ?? "",
        };
      });
  },

  saveProgram(data: {
    operatorId: number;
    jobId?: number;
    programType: string;
    parameters: string;
    gcodeText: string;
  }) {
    const program = { id: demoNextId.programs++, ...data, createdAt: new Date().toISOString() };
    demoPrograms.push(program);
    saveDemoData();
    return { success: true, programId: program.id };
  },

  submitFeedback(data: {
    jobId: number;
    operatorId: number;
    programId?: number;
    result: "pass" | "fail";
    offsetAdjustment?: number;
    toolChange: boolean;
    feedAdjustment?: number;
    speedAdjustment?: number;
    notes?: string;
  }) {
    const fb = { id: demoNextId.feedback++, ...data, createdAt: new Date().toISOString() };
    demoFeedback.push(fb);
    saveDemoData();
    return { success: true, feedbackId: fb.id };
  },

  getFeedbackByJobId(jobId: number) {
    return demoFeedback.filter((f) => f.jobId === jobId);
  },

  getAllFeedback() {
    return demoFeedback;
  },

  getAllNcrs() {
    return demoNcrs.map((n) => {
      const job = demoJobs.find((j) => j.id === n.jobId);
      const op = getDemoOperator();
      return {
        ncrId: n.id,
        jobId: n.jobId,
        problemDescription: n.problemDescription,
        rootCause: n.rootCause,
        correctiveAction: n.correctiveAction,
        createdAt: n.createdAt,
        operatorName: op?.name ?? "Demo Operator",
        partNumber: job?.partNumber ?? "",
        jobNumber: job?.jobNumber ?? "",
      };
    });
  },

  getAllInspections() {
    return demoInspections.map((ins) => ({
      id: ins.id,
      jobId: ins.jobId,
      operatorId: ins.operatorId,
      failCount: ins.items.filter((i) => !i.isPass).length,
      createdAt: ins.createdAt,
    }));
  },

  // AI learning from demo data
  getOptimizedSettings(partNumber: string) {
    const relevantJobs = demoJobs.filter((j) => j.partNumber === partNumber);
    const relevantFeedback = demoFeedback.filter((f) =>
      relevantJobs.some((j) => j.id === f.jobId)
    );

    const passFeedback = relevantFeedback.filter((f) => f.result === "pass");
    const total = relevantFeedback.length;

    return {
      hasData: total > 0,
      passRate: total > 0 ? Math.round((passFeedback.length / total) * 100) : 0,
      totalRuns: total,
      byProgramType: [],
      recentAdjustments: passFeedback
        .filter((f) => f.feedAdjustment != null || f.speedAdjustment != null)
        .slice(0, 5)
        .map((f) => ({
          feedAdj: f.feedAdjustment ?? null,
          speedAdj: f.speedAdjustment ?? null,
        })),
    };
  },

  getBestKnownMethod(partNumber: string) {
    const relevantNcrs = demoNcrs.filter((n) => {
      const job = demoJobs.find((j) => j.id === n.jobId);
      return job?.partNumber === partNumber;
    });

    if (relevantNcrs.length === 0) {
      return { hasData: false, bestProgramType: null, mostCommonRootCause: null, mostCommonCorrectiveAction: null };
    }

    const rootCauseCounts = new Map<string, number>();
    const correctiveCounts = new Map<string, number>();
    for (const n of relevantNcrs) {
      rootCauseCounts.set(n.rootCause, (rootCauseCounts.get(n.rootCause) ?? 0) + 1);
      correctiveCounts.set(n.correctiveAction, (correctiveCounts.get(n.correctiveAction) ?? 0) + 1);
    }

    let mostCommonRoot = "";
    let maxRootCount = 0;
    for (const [cause, count] of rootCauseCounts) {
      if (count > maxRootCount) {
        maxRootCount = count;
        mostCommonRoot = cause;
      }
    }

    let mostCommonCorrective = "";
    let maxCorrCount = 0;
    for (const [action, count] of correctiveCounts) {
      if (count > maxCorrCount) {
        maxCorrCount = count;
        mostCommonCorrective = action;
      }
    }

    return {
      hasData: true,
      bestProgramType: null,
      mostCommonRootCause: mostCommonRoot,
      mostCommonCorrectiveAction: mostCommonCorrective,
    };
  },

  getSetupInsights(partNumber: string) {
    const relevantNcrs = demoNcrs.filter((n) => {
      const job = demoJobs.find((j) => j.id === n.jobId);
      return job?.partNumber === partNumber;
    });

    if (relevantNcrs.length === 0) {
      return { hasInsights: false, insights: [] };
    }

    const grouped = new Map<string, { rootCause: string; correctiveAction: string; score: number }>();
    for (const n of relevantNcrs) {
      const daysAgo = (Date.now() - new Date(n.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      const score = Math.exp(-daysAgo / 7);
      const existing = grouped.get(n.rootCause);
      if (existing) {
        existing.score += score;
      } else {
        grouped.set(n.rootCause, {
          rootCause: n.rootCause,
          correctiveAction: n.correctiveAction,
          score,
        });
      }
    }

    const insights = Array.from(grouped.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return { hasInsights: true, insights };
  },

  getPreInspectionWarning(operatorId: number, partNumber: string) {
    const operatorNcrs = demoNcrs.filter((n) => {
      const job = demoJobs.find((j) => j.id === n.jobId);
      return n.operatorId === operatorId && job?.partNumber === partNumber;
    });

    if (operatorNcrs.length === 0) {
      return { hasWarning: false, previousIssues: [] };
    }

    return {
      hasWarning: true,
      previousIssueCount: operatorNcrs.length,
      previousIssues: operatorNcrs.slice(0, 3).map((n) => ({
        rootCause: n.rootCause,
        correctiveAction: n.correctiveAction,
      })),
    };
  },

  getJobInsight(partNumber: string) {
    const relevantNcrs = demoNcrs.filter((n) => {
      const job = demoJobs.find((j) => j.id === n.jobId);
      return job?.partNumber === partNumber;
    });

    if (relevantNcrs.length === 0) {
      return {
        hasHistory: false,
        totalNCRs: 0,
        mostCommonRootCause: null,
        recommendation: null,
        riskLevel: "low" as const,
      };
    }

    const causeCounts = new Map<string, number>();
    for (const n of relevantNcrs) {
      causeCounts.set(n.rootCause, (causeCounts.get(n.rootCause) ?? 0) + 1);
    }

    let maxCount = 0;
    let mostCommon = "";
    for (const [cause, count] of causeCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = cause;
      }
    }

    const matching = relevantNcrs.find((n) => n.rootCause === mostCommon);
    const riskLevel = relevantNcrs.length >= 5 ? "high" : relevantNcrs.length >= 2 ? "medium" : "low";

    return {
      hasHistory: true,
      totalNCRs: relevantNcrs.length,
      mostCommonRootCause: mostCommon,
      recommendation: matching?.correctiveAction ?? "Review previous NCRs before starting.",
      riskLevel,
    };
  },

  // ═══════════════════════════════════════════════════════════
  // PHASE 7 — FOUNDRY DEMO API
  // ═══════════════════════════════════════════════════════════

  createFoundryNcr(data: {
    jobId: number;
    operatorId: number;
    ncrType: string;
    defectType: string;
    problemDescription: string;
    rootCause?: string;
    correctiveAction?: string;
    severity?: string;
    scrapQuantified?: boolean;
    scrapCost?: number;
  }) {
    const ncr = {
      id: demoNextId.foundryNcrs++,
      ...data,
      severity: data.severity ?? "major",
      status: "open",
      scrapQuantified: data.scrapQuantified ?? false,
      createdAt: new Date().toISOString(),
    };
    demoFoundryNcrs.push(ncr);
    saveDemoData();
    return { success: true, foundryNcrId: ncr.id };
  },

  getFoundryNcrs() {
    return demoFoundryNcrs.map((n) => {
      const job = demoJobs.find((j) => j.id === n.jobId);
      const op = getDemoOperator();
      return {
        ...n,
        jobNumber: job?.jobNumber ?? `JOB-${n.jobId}`,
        partNumber: job?.partNumber ?? "Unknown",
        operatorName: op?.name ?? "Demo Operator",
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getFoundryNcrById(id: number) {
    return demoFoundryNcrs.find((n) => n.id === id) ?? null;
  },

  attachFoundryImage(data: { foundryNcrId: number; imageUrl: string; uploadedBy: number }) {
    const img = { id: demoNextId.foundryImages++, ...data, createdAt: new Date().toISOString() };
    demoFoundryImages.push(img);
    saveDemoData();
    return { success: true, imageId: img.id };
  },

  getFoundryImages(foundryNcrId: number) {
    return demoFoundryImages.filter((i) => i.foundryNcrId === foundryNcrId);
  },

  createFoundryDefect(data: {
    foundryNcrId: number;
    partNumber: string;
    defectType: string;
    description?: string;
    location?: string;
    confidence?: number;
    aiPredicted?: boolean;
    imageId?: number;
    isRepeat?: boolean;
  }) {
    const defect = {
      id: demoNextId.foundryDefects++,
      ...data,
      aiPredicted: data.aiPredicted ?? false,
      isRepeat: data.isRepeat ?? false,
      confidence: data.confidence?.toString(),
      createdAt: new Date().toISOString(),
    };
    demoFoundryDefects.push(defect);
    saveDemoData();
    return { success: true, defectId: defect.id };
  },

  getFoundryDefects(filters?: { partNumber?: string; defectType?: string; aiPredicted?: boolean; isRepeat?: boolean }) {
    let defects = [...demoFoundryDefects];
    if (filters?.partNumber) defects = defects.filter((d) => d.partNumber.includes(filters.partNumber!));
    if (filters?.defectType) defects = defects.filter((d) => d.defectType === filters.defectType);
    if (filters?.aiPredicted !== undefined) defects = defects.filter((d) => d.aiPredicted === filters.aiPredicted);
    if (filters?.isRepeat !== undefined) defects = defects.filter((d) => d.isRepeat === filters.isRepeat);
    return defects.reverse();
  },

  createCastingBatch(data: { batchNumber: string; partNumber: string; material?: string; furnaceId?: string; quantity?: number }) {
    const batch = { id: demoNextId.batches++, ...data, quantity: data.quantity ?? 0, quantityScrap: 0, status: "poured", createdAt: new Date().toISOString() };
    demoCastingBatches.push(batch);
    saveDemoData();
    return { success: true, batchId: batch.id };
  },

  getCastingBatches() {
    return [...demoCastingBatches].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  runAiVision(imageUrl: string, imageId: number) {
    // Deterministic mock analysis
    const hash = imageUrl.split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) >>> 0, 0);
    const defectTypes = ["blow_hole", "porosity", "corrosion", "crack", "sand_inclusion", "shrinkage", "surface_defect", "hard_spot", "misrun", "dimensional_shift"];
    const primaryIdx = hash % defectTypes.length;
    const secondaryIdx = (hash + 3) % defectTypes.length;
    const primaryConfidence = 60 + (hash % 35);
    const predictions = [
      { defectType: defectTypes[primaryIdx], confidence: primaryConfidence },
      { defectType: defectTypes[secondaryIdx], confidence: 10 + (hash % 20) },
    ];

    const pred = {
      id: demoNextId.aiPredictions++,
      imageId,
      provider: "mock" as const,
      model: "forgeraceiq-vision-mock-v1",
      predictedDefectType: defectTypes[primaryIdx],
      confidence: String(primaryConfidence),
      allPredictions: JSON.stringify(predictions),
      processingTimeMs: 400 + (hash % 300),
      status: "completed",
      createdAt: new Date().toISOString(),
    };
    demoAiPredictions.push(pred);
    saveDemoData();

    return {
      success: true,
      predictionId: pred.id,
      predictions,
      topPrediction: predictions[0],
      processingTimeMs: pred.processingTimeMs,
    };
  },

  getAiPredictions(imageId?: number) {
    if (imageId) return demoAiPredictions.filter((p) => p.imageId === imageId);
    return [...demoAiPredictions].reverse();
  },

  getFoundryDashboardKpis() {
    const totalNcrs = demoFoundryNcrs.length;
    const openNcrs = demoFoundryNcrs.filter((n) => n.status === "open").length;
    const criticalCount = demoFoundryNcrs.filter((n) => n.severity === "critical").length;
    const totalScrap = demoFoundryNcrs.filter((n) => n.scrapQuantified).reduce((s, n) => s + (n.scrapCost ?? 0), 0);
    const aiAnalyzed = demoAiPredictions.filter((p) => p.status === "completed").length;

    // Top defects
    const defectCounts = new Map<string, number>();
    for (const n of demoFoundryNcrs) {
      defectCounts.set(n.defectType, (defectCounts.get(n.defectType) ?? 0) + 1);
    }
    const topDefects = Array.from(defectCounts.entries())
      .map(([defectType, count]) => ({ defectType, count }))
      .sort((a, b) => b.count - a.count);

    // Defect trends (by date)
    const trendMap = new Map<string, number>();
    for (const n of demoFoundryNcrs) {
      const date = n.createdAt.slice(0, 10);
      trendMap.set(date, (trendMap.get(date) ?? 0) + 1);
    }
    const ncrTrend = Array.from(trendMap.entries()).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

    // Repeat defects
    const repeatDefects = demoFoundryDefects.filter((d) => d.isRepeat).map((d) => ({
      partNumber: d.partNumber,
      defectType: d.defectType,
      occurrenceCount: 2,
      latestDescription: d.description,
    }));

    // Gallery items
    const gallery = demoFoundryImages.map((img) => {
      const ncr = demoFoundryNcrs.find((n) => n.id === img.foundryNcrId);
      const pred = demoAiPredictions.find((p) => p.imageId === img.id);
      return {
        id: img.id,
        imageUrl: img.imageUrl,
        thumbnailUrl: img.thumbnailUrl,
        createdAt: img.createdAt,
        defectType: ncr?.defectType ?? "unknown",
        severity: ncr?.severity ?? "major",
        partNumber: `PN-CAST-${1000 + (img.foundryNcrId % 10)}`,
        jobNumber: `JOB-${img.foundryNcrId}`,
        predictedType: pred?.predictedDefectType ?? null,
        aiConfidence: pred?.confidence ?? null,
      };
    });

    // Risk alerts
    const batchNcrMap = new Map<number, number>();
    for (const n of demoFoundryNcrs) {
      if (n.castingBatchId) {
        batchNcrMap.set(n.castingBatchId, (batchNcrMap.get(n.castingBatchId) ?? 0) + 1);
      }
    }
    const highRiskBatches = Array.from(batchNcrMap.entries())
      .filter(([_, count]) => count >= 2)
      .map(([batchId, count]) => {
        const batch = demoCastingBatches.find((b) => b.id === batchId);
        return { batchId, batchNumber: batch?.batchNumber ?? "Unknown", partNumber: batch?.partNumber ?? "", ncrCount: count, scrapCost: 0 };
      });

    return {
      kpis: { totalNcrs, openNcrs, criticalCount, totalScrapCost: totalScrap, aiAnalyzed },
      topDefects,
      ncrTrend,
      repeatDefects,
      gallery,
      highRiskBatches,
    };
  },

  seedFoundryData,

  clearAll() {
    demoJobs = [];
    demoInspections = [];
    demoNcrs = [];
    demoPrograms = [];
    demoFeedback = [];
    demoNextId = { jobs: 1, inspections: 1, ncrs: 1, programs: 1, feedback: 1 };
    saveDemoData();
  },
};
