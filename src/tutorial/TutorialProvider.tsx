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

interface TutorialContextValue {
  state: TutorialState
  startTour: (tour: TutorialTour) => void
  nextStep: () => void
  prevStep: () => void
  goToStep: (index: number) => void
  endTour: () => void
  setTransitioning: (value: boolean) => void
  targetRect: DOMRect | null
  setTargetRect: (rect: DOMRect | null) => void
}

const TutorialContext = createContext<TutorialContextValue | null>(null)

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(tutorialReducer, initialState)
  const [targetRect, setTargetRectState] = useState<DOMRect | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const pendingRouteRef = useRef<string | null>(null)

  const currentStep = state.currentTour?.steps[state.currentStepIndex]
  const targetRoute = currentStep?.route

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
  }, [])

  const nextStep = useCallback(() => {
    window.scrollTo(0, 0)
    dispatch({ type: 'NEXT_STEP' })
  }, [])

  const prevStep = useCallback(() => {
    window.scrollTo(0, 0)
    dispatch({ type: 'PREV_STEP' })
  }, [])

  const goToStep = useCallback((index: number) => {
    window.scrollTo(0, 0)
    dispatch({ type: 'GO_TO_STEP', index })
  }, [])

  const endTour = useCallback(() => {
    dispatch({ type: 'END_TOUR' })
  }, [])

  const setTransitioning = useCallback((value: boolean) => {
    dispatch({ type: 'SET_TRANSITIONING', value })
  }, [])

  const setTargetRect = useCallback((rect: DOMRect | null) => {
    setTargetRectState(rect)
  }, [])

  return (
    <TutorialContext.Provider
      value={{
        state,
        startTour,
        nextStep,
        prevStep,
        goToStep,
        endTour,
        setTransitioning,
        targetRect,
        setTargetRect,
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
