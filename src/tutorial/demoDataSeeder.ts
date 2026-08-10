// ═══════════════════════════════════════════════════════════════
// ForgeTraceIQ Tutorial Demo Data Seeder
// ═══════════════════════════════════════════════════════════════
// This module seeds realistic manufacturing demo data specifically for
// the video tutorial system. It does NOT affect production data.

import { demoApi } from '@/lib/demoApi';

export const DEMO_SCENARIO = {
  job: {
    jobNumber: 'FTQ-2026-0048',
    partNumber: 'PN-PUMP-HOUSING-4402',
    materialNumber: 'MAT-CI-GG25',
    revision: 'Rev-C',
  },
  operator: {
    id: 101,
    name: 'Sarah Chen',
    operatorId: 'OP-2847',
  },
  part: {
    name: 'Pump Housing',
    material: 'Cast Iron GG25',
    drawingRef: 'DRW-4402-Rev-C',
  },
  setup: {
    machine: 'DMG Mori NLX-2500',
    tooling: 'Sandvik Coromant CNMG 432',
    workholding: '3-Jaw Power Chuck – 200mm',
    process: 'Turning – Rough & Finish OD, Bore, Face',
    notes: 'Verify casting porosity-free before machining. Check bore tolerance +0.02/-0.00mm.',
  },
  inspection: {
    dimensions: [
      { name: 'OD Diameter', nominal: 220.0, tolerancePlus: 0.05, toleranceMinus: 0.0, measured: 220.02, isPass: true },
      { name: 'Bore Diameter', nominal: 150.0, tolerancePlus: 0.02, toleranceMinus: 0.0, measured: 150.03, isPass: false },
      { name: 'Face Runout', nominal: 0.0, tolerancePlus: 0.05, toleranceMinus: 0.0, measured: 0.03, isPass: true },
      { name: 'Wall Thickness', nominal: 35.0, tolerancePlus: 0.5, toleranceMinus: 0.5, measured: 34.8, isPass: true },
      { name: 'Overall Length', nominal: 180.0, tolerancePlus: 0.2, toleranceMinus: 0.2, measured: 180.15, isPass: true },
    ],
  },
  ncr: {
    defectType: 'porosity',
    severity: 'major',
    problemDescription: 'Excessive porosity detected in internal bore surface during final inspection. Pore clusters visible at 3 and 9 o-clock positions. Wall thickness measurement confirms material loss.',
    rootCause: 'Inadequate venting in mold cavity during pouring. Excessive moisture in sand mix caused gas entrapment.',
    correctiveAction: '1. Increase vent holes in pattern from 4 to 8. 2. Reduce sand moisture content to 3.5%. 3. Add additional risers at bore location. 4. Re-inspect 100% of next batch.',
    scrapCost: 1240.50,
  },
  foundry: {
    batchNumber: 'BATCH-2026-048-A',
    furnaceId: 'FURNACE-03',
    quantity: 48,
    quantityScrap: 6,
  },
};

export function seedTutorialData() {
  const existing = localStorage.getItem('ftq_tutorial_seeded');
  if (existing) return;

  localStorage.setItem('cnc_operator', JSON.stringify(DEMO_SCENARIO.operator));
  localStorage.setItem('cnc_demo_mode', 'true');

  const jobResult = demoApi.createJob({
    jobNumber: DEMO_SCENARIO.job.jobNumber,
    partNumber: DEMO_SCENARIO.job.partNumber,
    materialNumber: DEMO_SCENARIO.job.materialNumber,
    revision: DEMO_SCENARIO.job.revision,
    operatorId: DEMO_SCENARIO.operator.id,
  });
  const jobId = jobResult.job.id;

  demoApi.createInspection({
    jobId,
    operatorId: DEMO_SCENARIO.operator.id,
    notes: 'Standard dimensional inspection – first article of batch FTQ-2026-0048',
    items: DEMO_SCENARIO.inspection.dimensions,
  });

  demoApi.createNcr({
    jobId,
    operatorId: DEMO_SCENARIO.operator.id,
    problemDescription: DEMO_SCENARIO.ncr.problemDescription,
    whys: [
      { whyLevel: 1, answer: 'Why did porosity occur? – Gas entrapment during solidification.' },
      { whyLevel: 2, answer: 'Why was gas trapped? – Insufficient venting and high sand moisture.' },
      { whyLevel: 3, answer: 'Why was sand moisture high? – Sand reclamation system filter overdue for replacement.' },
    ],
    rootCause: DEMO_SCENARIO.ncr.rootCause,
    correctiveAction: DEMO_SCENARIO.ncr.correctiveAction,
  });

  demoApi.createFoundryNcr({
    jobId,
    operatorId: DEMO_SCENARIO.operator.id,
    ncrType: 'foundry',
    defectType: DEMO_SCENARIO.ncr.defectType,
    problemDescription: DEMO_SCENARIO.ncr.problemDescription,
    rootCause: DEMO_SCENARIO.ncr.rootCause,
    correctiveAction: DEMO_SCENARIO.ncr.correctiveAction,
    severity: DEMO_SCENARIO.ncr.severity,
    scrapQuantified: true,
    scrapCost: DEMO_SCENARIO.ncr.scrapCost,
  });

  demoApi.createCastingBatch({
    batchNumber: DEMO_SCENARIO.foundry.batchNumber,
    partNumber: DEMO_SCENARIO.job.partNumber,
    material: DEMO_SCENARIO.part.material,
    furnaceId: DEMO_SCENARIO.foundry.furnaceId,
    quantity: DEMO_SCENARIO.foundry.quantity,
  });

  localStorage.setItem('ftq_tutorial_seeded', 'true');
  localStorage.setItem('ftq_tutorial_job_id', String(jobId));
  return jobId;
}

export function clearTutorialData() {
  localStorage.removeItem('ftq_tutorial_seeded');
  localStorage.removeItem('ftq_tutorial_job_id');
  demoApi.clearAll();
}

export function getTutorialJobId(): number | null {
  const id = localStorage.getItem('ftq_tutorial_job_id');
  return id ? parseInt(id, 10) : null;
}
