import { useNavigate } from 'react-router'
import { useTutorial } from './TutorialProvider'
import { allTours } from './tours'
import { seedTutorialData, clearTutorialData } from './demoDataSeeder'
import AppLayout from '@/components/layout/AppLayout'
import {
  Play, Clock, CheckCircle, Video, RotateCcw, BookOpen,
  ArrowRight, Monitor
} from 'lucide-react'
import { useState, useEffect } from 'react'

export default function TutorialPage() {
  const navigate = useNavigate()
  const { startTour, state } = useTutorial()
  const [seeded, setSeeded] = useState(false)
  const [showScripts, setShowScripts] = useState(false)
  const [selectedScript, setSelectedScript] = useState<string | null>(null)

  useEffect(() => {
    setSeeded(!!localStorage.getItem('ftq_tutorial_seeded'))
  }, [])

  const handleStartTour = (tourId: string) => {
    const tour = allTours.find(t => t.id === tourId)
    if (!tour) return

    // Seed demo data if not already
    if (!seeded) {
      seedTutorialData()
      setSeeded(true)
    }

    startTour(tour)
  }

  const handleResetData = () => {
    clearTutorialData()
    setSeeded(false)
  }

  const handleRecordMode = (tourId: string) => {
    const tour = allTours.find(t => t.id === tourId)
    if (!tour) return

    if (!seeded) {
      seedTutorialData()
      setSeeded(true)
    }

    startTour(tour)
  }

  return (
    <AppLayout title="Video Tutorials & Demo Mode" subtitle="ForgeTraceIQ Training Academy">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Hero section */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-orange-500/10 rounded-lg">
              <Video className="h-6 w-6 text-orange-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white mb-1">
                ForgeTraceIQ Training Academy
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Step-by-step guided tutorials for Production Managers, Quality Managers,
                Foundry Managers, and Operators. Use Demo Mode to practice workflows with
                realistic sample data, or Record Mode to capture professional demonstration videos.
              </p>
            </div>
          </div>
        </div>

        {/* Data controls */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${
            seeded
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}>
            <CheckCircle className="h-3.5 w-3.5" />
            {seeded ? 'Demo data loaded' : 'No demo data'}
          </div>
          {!seeded && (
            <button
              onClick={() => { seedTutorialData(); setSeeded(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500 hover:bg-orange-600 text-white transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Seed Demo Data
            </button>
          )}
          {seeded && (
            <button
              onClick={handleResetData}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Data
            </button>
          )}
          <button
            onClick={() => setShowScripts(!showScripts)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 transition-colors ml-auto"
          >
            <BookOpen className="h-3.5 w-3.5" />
            {showScripts ? 'Hide Scripts' : 'Voiceover Scripts'}
          </button>
        </div>

        {/* Scripts panel */}
        {showScripts && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-white">Voiceover Scripts</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {allTours.map(tour => (
                <button
                  key={tour.id}
                  onClick={() => setSelectedScript(selectedScript === tour.id ? null : tour.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                    selectedScript === tour.id
                      ? 'bg-orange-500/10 border border-orange-500/30 text-orange-400'
                      : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold">Video {tour.videoNumber}</div>
                  <div className="truncate">{tour.title}</div>
                </button>
              ))}
            </div>
            {selectedScript && (
              <div className="mt-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                {(() => {
                  const tour = allTours.find(t => t.id === selectedScript)
                  if (!tour) return null
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-white">{tour.title}</h4>
                        <span className="text-[10px] text-slate-500">{tour.estimatedDuration}</span>
                      </div>
                      {tour.steps.map((step, i) => (
                        <div key={step.id} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-orange-400 w-6">{i + 1}</span>
                            <span className="text-xs font-semibold text-slate-300">{step.title}</span>
                          </div>
                          <p className="text-xs text-slate-500 italic pl-8 leading-relaxed">
                            {step.voiceover}
                          </p>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}

        {/* Tour cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allTours.map(tour => {
            const isCompleted = state.completedTours.includes(tour.id)
            return (
              <div
                key={tour.id}
                className="group bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl p-4 transition-all hover:shadow-lg"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-sm font-bold text-orange-500">
                    {tour.videoNumber}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-bold text-white truncate">
                        {tour.title}
                      </h3>
                      {isCompleted && (
                        <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mb-1">{tour.subtitle}</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-600">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {tour.estimatedDuration}
                      </span>
                      <span>{tour.steps.length} steps</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-2 mb-3 leading-relaxed">
                  {tour.description}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStartTour(tour.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500 hover:bg-orange-600 text-white transition-colors"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Start Tutorial
                  </button>
                  <button
                    onClick={() => handleRecordMode(tour.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                    title="Launch with voiceover for screen recording"
                  >
                    <Monitor className="h-3.5 w-3.5" />
                    Record Mode
                  </button>
                  <button
                    onClick={() => {
                      setShowScripts(true)
                      setSelectedScript(tour.id)
                    }}
                    className="ml-auto p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
                    title="View voiceover script"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Flagship highlight */}
        <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-orange-500/20 rounded-lg">
              <Video className="h-6 w-6 text-orange-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white mb-1">
                Flagship Tutorial: Complete Manufacturing Story
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                Follow a realistic scenario from job creation through setup, production,
                inspection, quality failure, NCR creation, AI defect analysis, corrective
                action, and management dashboard. This is the main video for YouTube,
                website, and customer demonstrations.
              </p>
              <button
                onClick={() => handleStartTour('end-to-end')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white transition-colors"
              >
                <Play className="h-4 w-4" />
                Launch Flagship Tutorial
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-bold text-white mb-2">Recording Tips</h3>
          <ul className="space-y-1.5 text-xs text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-orange-500 mt-0.5">1.</span>
              Click Record Mode to launch a tutorial with voiceover scripts displayed.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500 mt-0.5">2.</span>
              Use your screen recording software (OBS, Loom, etc.) to capture the session.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500 mt-0.5">3.</span>
              The voiceover script panel shows exactly what to narrate for each step.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500 mt-0.5">4.</span>
              Press Space or Right Arrow to advance. Press Left Arrow to go back.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500 mt-0.5">5.</span>
              Press Escape to exit the tutorial at any time.
            </li>
          </ul>
        </div>
      </div>
    </AppLayout>
  )
}
