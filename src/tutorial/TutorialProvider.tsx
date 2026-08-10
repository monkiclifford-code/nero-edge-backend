import { createContext, useContext, useReducer, useCallback, useRef, useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router'
import type { TutorialState, TutorialAction, TutorialTour } from './types'

const initialState: TutorialState = {
  isActive: false,
  currentTour: null,
  currentStepIndex: 0,
  isTransitioning: false,
  completedTours: [],
}

function tutorialReducer(state: TutorialState, action: TutorialAction): TutorialState {
  switch (action.type) {
    case 'START_TOUR':
      return {
        ...state,
        isActive: true,
        currentTour: action.tour,
        currentStepIndex: 0,
        isTransitioning: false,
      }
    case 'NEXT_STEP': {
      if (!state.currentTour) return state
      const nextIndex = state.currentStepIndex + 1
      if (nextIndex >= state.currentTour.steps.length) {
        return {
          ...state,
          isActive: false,
          currentTour: null,
          currentStepIndex: 0,
          completedTours: state.currentTour
            ? [...state.completedTours, state.currentTour.id]
            : state.completedTours,
        }
      }
      return { ...state, currentStepIndex: nextIndex, isTransitioning: true }
    }
    case 'PREV_STEP':
      return {
        ...state,
        currentStepIndex: Math.max(0, state.currentStepIndex - 1),
        isTransitioning: true,
      }
    case 'GO_TO_STEP':
      if (
        !state.currentTour ||
        action.index < 0 ||
        action.index >= state.currentTour.steps.length
      )
        return state
      return { ...state, currentStepIndex: action.index, isTransitioning: true }
    case 'END_TOUR':
      return {
        ...state,
        isActive: false,
        currentTour: null,
        currentStepIndex: 0,
        completedTours: state.currentTour
          ? [...state.completedTours, state.currentTour.id]
          : state.completedTours,
      }
    case 'SET_TRANSITIONING':
      return { ...state, isTransitioning: action.value }
    case 'MARK_COMPLETE':
      return { ...state, completedTours: [...state.completedTours, action.tourId] }
    default:
      return state
  }
}

export interface AudioState {
  isPlaying: boolean
  isMuted: boolean
  volume: number
  currentTime: number
  duration: number
  audioEnded: boolean
  hasAudio: boolean
}

interface TutorialContextValue {
  state: TutorialState
  audioState: AudioState
  startTour: (tour: TutorialTour) => void
  nextStep: () => void
  prevStep: () => void
  goToStep: (index: number) => void
  endTour: () => void
  setTransitioning: (value: boolean) => void
  targetRect: DOMRect | null
  setTargetRect: (rect: DOMRect | null) => void
  // Audio controls
  setAudioPlaying: (playing: boolean) => void
  setAudioMuted: (muted: boolean) => void
  setAudioVolume: (volume: number) => void
  setAudioTime: (time: number) => void
  setAudioDuration: (duration: number) => void
  setAudioEnded: (ended: boolean) => void
  setHasAudio: (has: boolean) => void
}

const TutorialContext = createContext<TutorialContextValue | null>(null)

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(tutorialReducer, initialState)
  const [targetRect, setTargetRectState] = useState<DOMRect | null>(null)
  const [audioState, setAudioState] = useState<AudioState>({
    isPlaying: false,
    isMuted: false,
    volume: 1.0,
    currentTime: 0,
    duration: 0,
    audioEnded: false,
    hasAudio: false,
  })

  const navigate = useNavigate()
  const location = useLocation()
  const pendingRouteRef = useRef<string | null>(null)

  const currentStep = state.currentTour?.steps[state.currentStepIndex]
  const targetRoute = currentStep?.route

  // Route navigation sync
  useEffect(() => {
    if (!state.isActive || !targetRoute || state.isTransitioning) return
    const routePattern = targetRoute.replace(/:.*$/, '')
    if (
      location.pathname !== targetRoute &&
      !location.pathname.startsWith(routePattern)
    ) {
      pendingRouteRef.current = targetRoute
      dispatch({ type: 'SET_TRANSITIONING', value: true })
      navigate(targetRoute)
    }
  }, [state.isActive, targetRoute, location.pathname, state.isTransitioning, navigate])

  useEffect(() => {
    if (state.isTransitioning && pendingRouteRef.current) {
      const pending = pendingRouteRef.current
      const routePattern = pending.replace(/:.*$/, '')
      if (
        location.pathname === pending ||
        location.pathname.startsWith(routePattern)
      ) {
        pendingRouteRef.current = null
        const timer = setTimeout(() => {
          dispatch({ type: 'SET_TRANSITIONING', value: false })
        }, 500)
        return () => clearTimeout(timer)
      }
    }
  }, [location.pathname, state.isTransitioning])

  const startTour = useCallback((tour: TutorialTour) => {
    window.scrollTo(0, 0)
    dispatch({ type: 'START_TOUR', tour })
    setAudioState(s => ({ ...s, isPlaying: true, audioEnded: false, currentTime: 0 }))
  }, [])

  const nextStep = useCallback(() => {
    window.scrollTo(0, 0)
    dispatch({ type: 'NEXT_STEP' })
    setAudioState(s => ({ ...s, audioEnded: false, currentTime: 0 }))
  }, [])

  const prevStep = useCallback(() => {
    window.scrollTo(0, 0)
    dispatch({ type: 'PREV_STEP' })
    setAudioState(s => ({ ...s, audioEnded: false, currentTime: 0 }))
  }, [])

  const goToStep = useCallback((index: number) => {
    window.scrollTo(0, 0)
    dispatch({ type: 'GO_TO_STEP', index })
    setAudioState(s => ({ ...s, audioEnded: false, currentTime: 0 }))
  }, [])

  const endTour = useCallback(() => {
    dispatch({ type: 'END_TOUR' })
    setAudioState(s => ({ ...s, isPlaying: false, audioEnded: false, currentTime: 0 }))
  }, [])

  const setTransitioning = useCallback((value: boolean) => {
    dispatch({ type: 'SET_TRANSITIONING', value })
  }, [])

  const setTargetRect = useCallback((rect: DOMRect | null) => {
    setTargetRectState(rect)
  }, [])

  // Audio setters
  const setAudioPlaying = useCallback((playing: boolean) => {
    setAudioState(s => ({ ...s, isPlaying: playing }))
  }, [])

  const setAudioMuted = useCallback((muted: boolean) => {
    setAudioState(s => ({ ...s, isMuted: muted }))
  }, [])

  const setAudioVolume = useCallback((volume: number) => {
    setAudioState(s => ({ ...s, volume: Math.max(0, Math.min(1, volume)) }))
  }, [])

  const setAudioTime = useCallback((time: number) => {
    setAudioState(s => ({ ...s, currentTime: time }))
  }, [])

  const setAudioDuration = useCallback((duration: number) => {
    setAudioState(s => ({ ...s, duration }))
  }, [])

  const setAudioEnded = useCallback((ended: boolean) => {
    setAudioState(s => ({ ...s, audioEnded: ended }))
  }, [])

  const setHasAudio = useCallback((has: boolean) => {
    setAudioState(s => ({ ...s, hasAudio: has }))
  }, [])

  return (
    <TutorialContext.Provider
      value={{
        state,
        audioState,
        startTour,
        nextStep,
        prevStep,
        goToStep,
        endTour,
        setTransitioning,
        targetRect,
        setTargetRect,
        setAudioPlaying,
        setAudioMuted,
        setAudioVolume,
        setAudioTime,
        setAudioDuration,
        setAudioEnded,
        setHasAudio,
      }}
    >
      {children}
    </TutorialContext.Provider>
  )
}

export function useTutorial() {
  const ctx = useContext(TutorialContext)
  if (!ctx) throw new Error('useTutorial must be used within TutorialProvider')
  return ctx
}
