// Maps tour IDs to their voiceover folder names
const TOUR_FOLDER_MAP: Record<string, string> = {
  'intro': '01-introduction',
  'job-workflow': '02-job-workflow',
  'setup-sheet': '03-setup-sheet',
  'inspection': '04-inspection',
  'failure': '05-quality-failure',
  'foundry': '06-foundry-ai',
  'visual-history': '07-visual-history',
  'ncr-status': '08-ncr-status',
  'dashboard': '09-dashboard',
  'end-to-end': '10-end-to-end',
}

/**
 * Get the audio URL for a specific tutorial step.
 * Steps are 0-indexed internally but audio files are 1-indexed.
 */
export function getStepAudioUrl(tourId: string, stepIndex: number): string | null {
  const folder = TOUR_FOLDER_MAP[tourId]
  if (!folder) return null
  const stepNum = stepIndex + 1
  return `/voiceovers/${folder}/step-${String(stepNum).padStart(2, '0')}.mp3`
}

/**
 * Check if a tour has voiceover audio available.
 */
export function hasVoiceoverAudio(tourId: string): boolean {
  return tourId in TOUR_FOLDER_MAP
}
