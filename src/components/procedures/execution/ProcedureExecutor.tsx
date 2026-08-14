"use client";

import { useCallback, useMemo } from "react";
import { TProcedure } from "@/lib/procedures/services/validator.service";
import { GuidePhase } from "@/lib/procedures/types";
import { useProcedureExecution } from "@/lib/procedures/hooks/useProcedureExecution";
import { useVoiceAssistant } from "@/hooks/use-voice-assistant";
import { generateAssistantAdvice } from "@/lib/procedures/assistants/mock-assistant";
import { BriefingStage } from "./BriefingStage";
import { PrerequisitesStage } from "./PrerequisitesStage";
import { RunningStage } from "./RunningStage";
import { CompletedStage } from "./CompletedStage";
import { AbortedStage } from "./AbortedStage";

interface ProcedureExecutorProps {
  procedure: TProcedure;
  onClose: () => void;
}

export function ProcedureExecutor({ procedure, onClose }: ProcedureExecutorProps) {
  const {
    phase,
    currentStep,
    currentStepIndex,
    totalSteps,
    completedSteps,
    context,
    timer,
    actions,
  } = useProcedureExecution({
    procedure,
    onComplete: (ctx) => {
      console.log("Procedure completed", ctx);
    },
    onAbort: (_ctx, reason) => {
      console.log("Procedure aborted:", reason);
    },
  });

  const voice = useVoiceAssistant({
    autoRead: true,
    onReadStart: () => {},
    onReadEnd: () => {},
  });

  const handleReadAloud = useCallback(() => {
    if (voice.isSpeaking) {
      voice.stopReading();
    } else if (currentStep) {
      voice.readStep(currentStep, currentStepIndex, totalSteps, phase);
    }
  }, [voice, currentStep, currentStepIndex, totalSteps, phase]);

  const handleSendMessage = useCallback(
    (message: string): string => {
      if (!currentStep) return "";
      return generateAssistantAdvice({
        step: currentStep,
        stepIndex: currentStepIndex,
        totalSteps,
        phase,
        userMessage: message,
      });
    },
    [currentStep, currentStepIndex, totalSteps, phase]
  );

  const currentAdvice = useMemo(() => {
    if (!currentStep) return "";
    return generateAssistantAdvice({
      step: currentStep,
      stepIndex: currentStepIndex,
      totalSteps,
      phase,
    });
  }, [currentStep, currentStepIndex, totalSteps, phase]);

  const progress =
    totalSteps > 0 ? Math.round(((currentStepIndex + (phase === "completed" ? 1 : 0)) / totalSteps) * 100) : 0;

  const handlePhaseTransition = useCallback(
    (nextPhase: GuidePhase) => {
      actions.setPhase(nextPhase);
      if (nextPhase === "executing" && currentStep) {
        voice.readStep(currentStep, currentStepIndex, totalSteps, nextPhase);
      }
    },
    [actions, voice, currentStep, currentStepIndex, totalSteps]
  );

  if (phase === "briefing") {
    return (
      <BriefingStage
        procedure={procedure}
        onStart={() => handlePhaseTransition("prerequisites")}
      />
    );
  }

  if (phase === "prerequisites") {
    return (
      <PrerequisitesStage
        procedure={procedure}
        onValidate={() => {
          timer.start();
          handlePhaseTransition("executing");
        }}
      />
    );
  }

  if (phase === "completed") {
    return (
      <CompletedStage
        procedure={procedure}
        context={context}
        onClose={onClose}
      />
    );
  }

  if (phase === "aborted") {
    return (
      <AbortedStage
        procedure={procedure}
        context={context}
        reason={context.anomalies[context.anomalies.length - 1] || "Interruption"}
        onClose={onClose}
      />
    );
  }

  return (
    <RunningStage
      steps={[...procedure.steps].sort((a, b) => a.order - b.order)}
      currentStepIndex={currentStepIndex}
      completedSteps={completedSteps}
      advice={currentAdvice}
      onPrevious={actions.previousStep}
      onNext={actions.nextStep}
      onToggleComplete={actions.completeStep}
      onSendMessage={handleSendMessage}
      isSpeaking={voice.isSpeaking}
      isAutoRead={true}
      onToggleAutoRead={voice.toggleEnabled}
      onReadAloud={handleReadAloud}
      progress={progress}
    />
  );
}
