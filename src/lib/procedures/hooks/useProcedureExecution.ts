"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { TProcedure, TStep } from "../services/validator.service";
import { GuidePhase, ProcedureExecutionContext } from "../types";

export interface UseProcedureExecutionOptions {
  procedure: TProcedure;
  onComplete?: (context: ProcedureExecutionContext) => void;
  onAbort?: (context: ProcedureExecutionContext, reason: string) => void;
}

export interface UseProcedureExecutionReturn {
  phase: GuidePhase;
  currentStep: TStep | null;
  currentStepIndex: number;
  totalSteps: number;
  completedSteps: Set<string>;
  context: ProcedureExecutionContext;
  timer: {
    stepRemaining: number;
    globalElapsed: number;
    isRunning: boolean;
    isPaused: boolean;
    start: () => void;
    pause: () => void;
    resume: () => void;
    stop: () => void;
    reset: () => void;
  };
  actions: {
    goToStep: (index: number) => void;
    nextStep: () => void;
    previousStep: () => void;
    completeStep: (stepId: string) => void;
    setPhase: (phase: GuidePhase) => void;
    abort: (reason: string) => void;
    reset: () => void;
  };
}

function createInitialContext(): ProcedureExecutionContext {
  return {
    currentStepIndex: 0,
    completedSteps: new Set<string>(),
    startedAt: Date.now(),
    anomalies: [],
  };
}

export function useProcedureExecution({
  procedure,
  onComplete,
  onAbort,
}: UseProcedureExecutionOptions): UseProcedureExecutionReturn {
  const [phase, setPhase] = useState<GuidePhase>("briefing");
  const [context, setContext] = useState<ProcedureExecutionContext>(() =>
    createInitialContext()
  );
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [stepRemaining, setStepRemaining] = useState(0);
  const [globalElapsed, setGlobalElapsed] = useState(0);

  const timerIntervalRef = useRef<number | null>(null);
  const currentStepRef = useRef<TStep | null>(null);

  const sortedSteps = useRef<TStep[]>([...procedure.steps].sort((a, b) => a.order - b.order));

  useEffect(() => {
    sortedSteps.current = [...procedure.steps].sort((a, b) => a.order - b.order);
  }, [procedure.steps]);

  const currentStep = sortedSteps.current[context.currentStepIndex] || null;
  currentStepRef.current = currentStep;

  const clearTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearTimer();
    if (isTimerRunning && !isTimerPaused && currentStep?.timerEnabled && currentStep.timerSeconds > 0) {
      setStepRemaining(currentStep.timerSeconds);
      timerIntervalRef.current = window.setInterval(() => {
        setStepRemaining((prev) => {
          if (prev <= 1) {
            clearTimer();
            setIsTimerRunning(false);
            setContext((ctx) => ({
              ...ctx,
              anomalies: [...ctx.anomalies, `Temps écoulé pour l'étape: ${currentStep.title}`],
            }));
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return clearTimer;
  }, [isTimerRunning, isTimerPaused, currentStep, clearTimer]);

  useEffect(() => {
    let globalInterval: number | null = null;
    if (isTimerRunning && !isTimerPaused) {
      globalInterval = window.setInterval(() => {
        setGlobalElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (globalInterval) clearInterval(globalInterval);
    };
  }, [isTimerRunning, isTimerPaused]);

  const startTimer = useCallback(() => {
    setIsTimerRunning(true);
    setIsTimerPaused(false);
  }, []);

  const pauseTimer = useCallback(() => {
    setIsTimerPaused(true);
  }, []);

  const resumeTimer = useCallback(() => {
    setIsTimerPaused(false);
  }, []);

  const stopTimer = useCallback(() => {
    clearTimer();
    setIsTimerRunning(false);
    setIsTimerPaused(false);
    setStepRemaining(0);
  }, [clearTimer]);

  const resetTimer = useCallback(() => {
    clearTimer();
    setIsTimerRunning(false);
    setIsTimerPaused(false);
    setStepRemaining(0);
    setGlobalElapsed(0);
  }, [clearTimer]);

  const contextRef = useRef(context);
  contextRef.current = context;

  const goToStep = useCallback(
    (index: number) => {
      if (index >= 0 && index < sortedSteps.current.length) {
        stopTimer();
        setContext((ctx) => ({ ...ctx, currentStepIndex: index }));
        setPhase("executing");
      }
    },
    [stopTimer]
  );

  const nextStep = useCallback(() => {
    const current = contextRef.current;
    if (current.currentStepIndex < sortedSteps.current.length - 1) {
      stopTimer();
      setContext((ctx) => ({
        ...ctx,
        currentStepIndex: ctx.currentStepIndex + 1,
        completedSteps: new Set(ctx.completedSteps).add(
          sortedSteps.current[ctx.currentStepIndex].id
        ),
      }));
    } else {
      setPhase("completed");
      stopTimer();
      onComplete?.(current);
    }
  }, [stopTimer, onComplete]);

  const previousStep = useCallback(() => {
    const current = contextRef.current;
    if (current.currentStepIndex > 0) {
      stopTimer();
      setContext((ctx) => ({ ...ctx, currentStepIndex: ctx.currentStepIndex - 1 }));
    }
  }, [stopTimer]);

  const completeStep = useCallback(
    (stepId: string) => {
      setContext((ctx) => {
        const next = new Set(ctx.completedSteps);
        if (next.has(stepId)) {
          next.delete(stepId);
        } else {
          next.add(stepId);
        }
        return { ...ctx, completedSteps: next };
      });
    },
    []
  );

  const abort = useCallback(
    (reason: string) => {
      const current = contextRef.current;
      stopTimer();
      setContext((ctx) => ({
        ...ctx,
        finishedAt: Date.now(),
        anomalies: [...ctx.anomalies, reason],
      }));
      setPhase("aborted");
      onAbort?.(current, reason);
    },
    [stopTimer, onAbort]
  );

  const reset = useCallback(() => {
    stopTimer();
    setContext(createInitialContext());
    setPhase("briefing");
    setGlobalElapsed(0);
  }, [stopTimer]);

  return {
    phase,
    currentStep,
    currentStepIndex: context.currentStepIndex,
    totalSteps: sortedSteps.current.length,
    completedSteps: context.completedSteps,
    context,
    timer: {
      stepRemaining,
      globalElapsed,
      isRunning: isTimerRunning,
      isPaused: isTimerPaused,
      start: startTimer,
      pause: pauseTimer,
      resume: resumeTimer,
      stop: stopTimer,
      reset: resetTimer,
    },
    actions: {
      goToStep,
      nextStep,
      previousStep,
      completeStep,
      setPhase,
      abort,
      reset,
    },
  };
}
