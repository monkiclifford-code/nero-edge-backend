import { useEffect, useRef, useState, useCallback } from 'react'
import { useTutorial } from './TutorialProvider'
import { getStepAudioUrl, hasVoiceoverAudio } from './voiceMap'
import {
  ChevronRight, ChevronLeft, X, Play, Pause, Mic, BookOpen,
  Volume2, VolumeX
} from 'lucide-react'

export default function TutorialOverlay() {
  const {
    state, audioState,
    nextStep, prevStep, endTour, setTargetRect, goToStep,
    setAudioPlaying, setAudioMuted, setAudioVolume,
    setAudioTime, setAudioDuration, setAudioEnded, setHasAudio,
  } = useTutorial()

  const [elementRect, setElementRect] = useState<DOMRect | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isPaused, setIsPaused] = useState(false)
  const [showVoiceover, setShowVoiceover] = useState(false)
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight })

  const { isActive, currentTour, currentStepIndex, isTransitioning } = state
  const step = currentTour?.steps[currentStepIndex]
  const isLastStep = currentTour
    ? currentStepIndex >= currentTour.steps.length - 1
    : false
  const isFirstStep = currentStepIndex === 0

  // Compute current audio URL
  const audioUrl = currentTour
    ? getStepAudioUrl(currentTour.id, currentStepIndex)
    : null

  // Track viewport size
  useEffect(() => {
    const handleResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Find target element and compute rect
  useEffect(() => {
    if (!isActive || !step || isTransitioning) {
      setElementRect(null)
      setTargetRect(null)
      return
    }
    const findElement = () => {
      if (!step.target) {
        setElementRect(null)
        setTargetRect(null)
        return true
      }
      try {
        const el = document.querySelector(step.target) as HTMLElement
        if (el) {
          const rect = el.getBoundingClientRect()
          setElementRect(rect)
          setTargetRect(rect)
          return true
        }
      } catch {
        return true
      }
      return false
    }
    if (!findElement()) {
      const poll = () => {
        if (findElement()) return
        pollTimerRef.current = setTimeout(poll, 300)
      }
      pollTimerRef.current = setTimeout(poll, 300)
    }
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [isActive, step, isTransitioning, currentStepIndex, setTargetRect])

  // Compute tooltip position
  useEffect(() => {
    if (!isActive || !step) return
    const vw = viewport.w
    const vh = viewport.h
    const padding = 16
    let x = vw / 2
    let y = vh / 2
    const tooltipWidth = Math.min(420, vw - 32)
    const tooltipHeight = 280
    if (elementRect) {
      const pos = step.position || 'bottom'
      switch (pos) {
        case 'top':
          x = elementRect.left + elementRect.width / 2
          y = elementRect.top - padding - tooltipHeight / 2
          break
        case 'bottom':
          x = elementRect.left + elementRect.width / 2
          y = elementRect.bottom + padding + tooltipHeight / 2
          break
        case 'left':
          x = elementRect.left - padding - tooltipWidth / 2
          y = elementRect.top + elementRect.height / 2
          break
        case 'right':
          x = elementRect.right + padding + tooltipWidth / 2
          y = elementRect.top + elementRect.height / 2
          break
        default:
          x = vw / 2
          y = vh / 2
      }
      x = Math.max(tooltipWidth / 2 + padding, Math.min(vw - tooltipWidth / 2 - padding, x))
      y = Math.max(tooltipHeight / 2 + padding, Math.min(vh - tooltipHeight / 2 - padding, y))
    }
    setTooltipPos({ x, y })
  }, [elementRect, step, isActive, viewport])

  // Audio: Load and play when step changes
  useEffect(() => {
    if (!isActive || !audioRef.current) return
    const audio = audioRef.current

    if (audioUrl) {
      setHasAudio(true)
      audio.src = audioUrl
      audio.load()
      audio.volume = audioState.volume
      audio.muted = audioState.isMuted

      const playAudio = async () => {
        try {
          await audio.play()
          setAudioPlaying(true)
        } catch {
          // Auto-play may be blocked by browser policy
          setAudioPlaying(false)
        }
      }

      // Small delay to let route transition settle
      const timer = setTimeout(playAudio, 300)
      return () => clearTimeout(timer)
    } else {
      setHasAudio(false)
      audio.src = ''
    }
  }, [isActive, audioUrl, currentStepIndex, audioState.volume, audioState.isMuted])

  // Sync audio play/pause with tour pause state
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audioState.hasAudio) return
    if (isPaused) {
      audio.pause()
    } else if (audioState.isPlaying) {
      audio.play().catch(() => {})
    }
  }, [isPaused, audioState.isPlaying, audioState.hasAudio])

  // When audio ends, auto-advance if step has autoAdvance
  useEffect(() => {
    if (!audioState.audioEnded || !step?.autoAdvance || isPaused) return
    const timer = setTimeout(() => {
      nextStep()
    }, 500) // brief pause before advancing
    return () => clearTimeout(timer)
  }, [audioState.audioEnded, step, isPaused, nextStep])

  // Fallback auto-advance timer (if no audio or audio fails)
  useEffect(() => {
    if (!isActive || !step?.autoAdvance || isPaused || isTransitioning) return
    if (audioState.hasAudio && audioState.duration > 0) return // audio-driven advance
    const delay = step.autoAdvanceDelay || 5000
    autoAdvanceTimerRef.current = setTimeout(() => {
      nextStep()
    }, delay)
    return () => {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current)
    }
  }, [isActive, step, isPaused, isTransitioning, nextStep, audioState.hasAudio, audioState.duration])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isActive) return
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        nextStep()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prevStep()
      } else if (e.key === 'Escape') {
        endTour()
      }
    },
    [isActive, nextStep, prevStep, endTour]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Audio event handlers
  const handleAudioPlay = () => setAudioPlaying(true)
  const handleAudioPause = () => setAudioPlaying(false)
  const handleAudioEnded = () => setAudioEnded(true)
  const handleAudioTimeUpdate = () => {
    if (audioRef.current) setAudioTime(audioRef.current.currentTime)
  }
  const handleAudioLoadedMetadata = () => {
    if (audioRef.current) setAudioDuration(audioRef.current.duration)
  }
  const handleAudioVolumeChange = () => {
    if (audioRef.current) {
      setAudioVolume(audioRef.current.volume)
      setAudioMuted(audioRef.current.muted)
    }
  }

  // Toggle play/pause
  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio || !audioState.hasAudio) return
    if (audioState.isPlaying) {
      audio.pause()
    } else {
      audio.play().catch(() => {})
    }
  }

  // Toggle mute
  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = !audio.muted
    setAudioMuted(audio.muted)
  }

  // Volume slider
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.volume = vol
      audioRef.current.muted = vol === 0
    }
    setAudioVolume(vol)
    if (vol > 0) setAudioMuted(false)
  }

  if (!isActive || !currentTour || !step) return null

  const padding = step.spotlightPadding ?? 8
  const showSpotlight = !!elementRect && step.position !== 'center'

  const progress = currentTour.steps.length > 0
    ? ((currentStepIndex + 1) / currentTour.steps.length) * 100
    : 0

  const audioProgressPercent = audioState.duration > 0
    ? (audioState.currentTime / audioState.duration) * 100
    : 0

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onPlay={handleAudioPlay}
        onPause={handleAudioPause}
        onEnded={handleAudioEnded}
        onTimeUpdate={handleAudioTimeUpdate}
        onLoadedMetadata={handleAudioLoadedMetadata}
        onVolumeChange={handleAudioVolumeChange}
        preload="auto"
      />

      {/* Dark overlay with spotlight cutout */}
      {showSpotlight && elementRect ? (
        <div className="absolute inset-0" style={{ pointerEvents: 'auto' }} onClick={() => { if (!step.target) nextStep() }}>
          <div className="absolute bg-black/75" style={{ left: 0, top: 0, width: viewport.w, height: Math.max(0, elementRect.top - padding) }} />
          <div className="absolute bg-black/75" style={{ left: 0, top: elementRect.bottom + padding, width: viewport.w, height: Math.max(0, viewport.h - (elementRect.bottom + padding)) }} />
          <div className="absolute bg-black/75" style={{ left: 0, top: Math.max(0, elementRect.top - padding), width: Math.max(0, elementRect.left - padding), height: elementRect.height + padding * 2 }} />
          <div className="absolute bg-black/75" style={{ left: elementRect.right + padding, top: Math.max(0, elementRect.top - padding), width: Math.max(0, viewport.w - (elementRect.right + padding)), height: elementRect.height + padding * 2 }} />
        </div>
      ) : (
        <div className="absolute inset-0 bg-black/75" style={{ pointerEvents: 'auto' }} onClick={() => { if (!step.target) nextStep() }} />
      )}

      {/* Spotlight border */}
      {showSpotlight && elementRect && (
        <div
          className="absolute pointer-events-none border-2 border-orange-400 rounded-xl"
          style={{
            left: elementRect.left - padding,
            top: elementRect.top - padding,
            width: elementRect.width + padding * 2,
            height: elementRect.height + padding * 2,
            boxShadow: '0 0 0 4px rgba(249,115,22,0.3), 0 0 20px rgba(249,115,22,0.2)',
          }}
        />
      )}

      {/* Pulse ring */}
      {showSpotlight && elementRect && step.showPulse !== false && (
        <div
          className="absolute pointer-events-none rounded-xl animate-ping"
          style={{
            left: elementRect.left - padding,
            top: elementRect.top - padding,
            width: elementRect.width + padding * 2,
            height: elementRect.height + padding * 2,
            border: '2px solid rgba(249,115,22,0.5)',
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className="absolute pointer-events-auto"
        style={{
          left: tooltipPos.x,
          top: tooltipPos.y,
          transform: 'translate(-50%, -50%)',
          maxWidth: '420px',
          width: 'calc(100vw - 32px)',
        }}
      >
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-slate-800">
            <div
              className="h-full bg-orange-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">
                Video {currentTour.videoNumber}
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-[10px] text-slate-500">
                Step {currentStepIndex + 1} of {currentTour.steps.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title={isPaused ? 'Resume' : 'Pause'}
              >
                {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => setShowVoiceover(!showVoiceover)}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Voiceover script"
              >
                <Mic className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={endTour}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
                title="Exit tutorial"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Audio Player Bar */}
          {audioState.hasAudio && (
            <div className="px-4 pb-2">
              <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/50">
                {/* Play/Pause */}
                <button
                  onClick={togglePlayPause}
                  className="p-1 rounded hover:bg-slate-700 text-orange-400 transition-colors flex-shrink-0"
                  title={audioState.isPlaying ? 'Pause audio' : 'Play audio'}
                >
                  {audioState.isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </button>

                {/* Audio progress bar */}
                <div className="flex-1 min-w-0">
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full transition-all"
                      style={{ width: `${audioProgressPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[9px] text-slate-500">
                      {formatTime(audioState.currentTime)}
                    </span>
                    <span className="text-[9px] text-slate-500">
                      {formatTime(audioState.duration)}
                    </span>
                  </div>
                </div>

                {/* Mute */}
                <button
                  onClick={toggleMute}
                  className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors flex-shrink-0"
                  title={audioState.isMuted ? 'Unmute' : 'Mute'}
                >
                  {audioState.isMuted || audioState.volume === 0 ? (
                    <VolumeX className="h-3.5 w-3.5" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                </button>

                {/* Volume slider */}
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={audioState.isMuted ? 0 : audioState.volume}
                  onChange={handleVolumeChange}
                  className="w-16 h-1 accent-orange-500 cursor-pointer flex-shrink-0"
                  title="Volume"
                />

                {/* Speaking indicator */}
                {audioState.isPlaying && (
                  <div className="flex gap-0.5 items-end h-3 flex-shrink-0">
                    <div className="w-0.5 bg-orange-400 rounded-full animate-[bounce_0.6s_infinite]" style={{ height: '60%' }} />
                    <div className="w-0.5 bg-orange-400 rounded-full animate-[bounce_0.6s_infinite_0.1s]" style={{ height: '100%' }} />
                    <div className="w-0.5 bg-orange-400 rounded-full animate-[bounce_0.6s_infinite_0.2s]" style={{ height: '40%' }} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Content */}
          <div className="px-4 pb-3">
            <h3 className="text-sm font-bold text-white mb-1">
              {step.title}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {step.content}
            </p>
          </div>

          {/* Voiceover script panel */}
          {showVoiceover && (
            <div className="mx-4 mb-3 p-3 bg-slate-800/80 rounded-lg border border-slate-700">
              <div className="flex items-center gap-1.5 mb-1.5">
                <BookOpen className="h-3 w-3 text-orange-400" />
                <span className="text-[10px] font-bold text-orange-400 uppercase">Voiceover Script</span>
              </div>
              <p className="text-xs text-slate-400 italic leading-relaxed">
                {step.voiceover}
              </p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between px-4 pb-3">
            <button
              onClick={prevStep}
              disabled={isFirstStep}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </button>

            <div className="flex items-center gap-1">
              {currentTour.steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToStep(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === currentStepIndex
                      ? 'bg-orange-500'
                      : i < currentStepIndex
                      ? 'bg-slate-500'
                      : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={nextStep}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500 hover:bg-orange-600 text-white transition-colors"
            >
              {isLastStep ? 'Finish' : 'Next'}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}
