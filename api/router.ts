import { createRouter, publicQuery } from "./middleware";
import { operatorRouter } from "./routers/operator";
import { jobRouter } from "./routers/job";
import { inspectionRouter } from "./routers/inspection";
import { ncrRouter } from "./routers/ncr";
import { dashboardRouter } from "./routers/dashboard";
import { aiAssistantRouter } from "./routers/aiAssistant";
import { cncProgramRouter } from "./routers/cncProgram";
import { feedbackRouter } from "./routers/feedback";
import { setupImageRouter } from "./routers/setupImage";

// Phase 7 — Foundry AI Vision Module
import { foundryRouter } from "./routers/foundry";
import { aiVisionRouter } from "./routers/aiVision";
import { foundryDashboardRouter } from "./routers/foundryDashboard";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  operator: operatorRouter,
  job: jobRouter,
  inspection: inspectionRouter,
  ncr: ncrRouter,
  dashboard: dashboardRouter,
  ai: aiAssistantRouter,
  cncProgram: cncProgramRouter,
  feedback: feedbackRouter,
  setupImage: setupImageRouter,
  // Phase 7
  foundry: foundryRouter,
  aiVision: aiVisionRouter,
  foundryDashboard: foundryDashboardRouter,
});

export type AppRouter = typeof appRouter;
