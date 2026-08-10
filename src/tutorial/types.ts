export interface Point {
  x: number;
  y: number;
}

export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  voiceover: string;
  target?: string; // CSS selector for element to highlight
  route?: string; // Route to navigate to before this step
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: 'click' | 'type' | 'none';
  actionValue?: string;
  highlightStyle?: 'circle' | 'rect';
  waitForElement?: number; // ms to wait for element to appear (default 500)
  autoAdvance?: boolean; // auto advance after delay
  autoAdvanceDelay?: number; // ms to wait before auto advancing
  spotlightPadding?: number; // padding around highlighted element
  showPulse?: boolean; // show pulsing ring around target
}

export interface TutorialTour {
  id: string;
  videoNumber: number;
  title: string;
  subtitle: string;
  description: string;
  steps: TutorialStep[];
  estimatedDuration: string; // e.g. '3:30'
}

export interface TutorialState {
  isActive: boolean;
  currentTour: TutorialTour | null;
  currentStepIndex: number;
  isTransitioning: boolean;
  completedTours: string[];
}

export type TutorialAction =
  | { type: 'START_TOUR'; tour: TutorialTour }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'GO_TO_STEP'; index: number }
  | { type: 'END_TOUR' }
  | { type: 'SET_TRANSITIONING'; value: boolean }
  | { type: 'MARK_COMPLETE'; tourId: string };
