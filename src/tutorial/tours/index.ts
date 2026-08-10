import { introTour } from './introTour'
import { jobWorkflowTour } from './jobWorkflowTour'
import { setupSheetTour } from './setupSheetTour'
import { inspectionTour } from './inspectionTour'
import { failureTour } from './failureTour'
import { foundryTour } from './foundryTour'
import { visualHistoryTour } from './visualHistoryTour'
import { ncrStatusTour } from './ncrStatusTour'
import { dashboardTour } from './dashboardTour'
import { endToEndTour } from './endToEndTour'
import type { TutorialTour } from '../types'

export const allTours: TutorialTour[] = [
  introTour,
  jobWorkflowTour,
  setupSheetTour,
  inspectionTour,
  failureTour,
  foundryTour,
  visualHistoryTour,
  ncrStatusTour,
  dashboardTour,
  endToEndTour,
];

export const tourMap = new Map<string, TutorialTour>(allTours.map(t => [t.id, t]));

export {
  introTour,
  jobWorkflowTour,
  setupSheetTour,
  inspectionTour,
  failureTour,
  foundryTour,
  visualHistoryTour,
  ncrStatusTour,
  dashboardTour,
  endToEndTour,
};
