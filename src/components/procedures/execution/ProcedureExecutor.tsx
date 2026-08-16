"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { TProcedure } from "@/lib/procedures/services/validator.service";
import { GuidePhase } from "@/lib/procedures/types";
import { useProcedureExecution } from "@/lib/procedures/hooks/useProcedureExecution";
import { useVoiceAssistant } from "@/hooks/use-voice-assistant";
import {
  generateAssistantAdvice,
  callLLMAssistant,
  AssistantAdvicePayload,
} from "@/lib/procedures/assistants/mock-assistant";
import { SensorData, TriggeredAlarm } from "@/lib/procedures/services/alert-evaluator.service";
import { createSensorClient } from "@/lib/iot/sensor-client";
import { getClientUser } from "@/lib/procedures/client-auth";
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
  const clientUser = getClientUser();

  const {
    phase,
    currentStep,
    currentStepIndex,
    totalSteps,
    completedSteps,
    executionId,
    context,
    timer,
    actions,
  } = useProcedureExecution({
    procedure,
    userId: clientUser?.userId,
    userRole: clientUser?.role,
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

  const [aiAdvice, setAiAdvice] = useState<string>("");
  const [isAdviceLoading, setIsAdviceLoading] = useState(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [activeAlarms, setActiveAlarms] = useState<TriggeredAlarm[]>([]);
  const sensorClientRef = useRef<ReturnType<typeof createSensorClient> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const client = createSensorClient();
      sensorClientRef.current = client;

      const unsubscribe = client.on((event) => {
        if (event.type === "data" && event.data) {
          setSensorData(event.data);
        }
        if (event.type === "alert" && event.alerts) {
          setActiveAlarms(event.alerts);
        }
      });

      client.connect().catch(() => {
        sensorClientRef.current = null;
      });

      return () => {
        unsubscribe();
        client.disconnect();
        sensorClientRef.current = null;
      };
    } catch {
      sensorClientRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!currentStep) {
      setAiAdvice("");
      return;
    }

    let cancelled = false;
    const mockAdvice = generateAssistantAdvice({
      step: currentStep,
      stepIndex: currentStepIndex,
      totalSteps,
      phase,
    });

    setAiAdvice(mockAdvice);
    setIsAdviceLoading(true);
    setAdviceError(null);

    const payload: AssistantAdvicePayload = {
      step: currentStep,
      stepIndex: currentStepIndex,
      totalSteps,
      phase,
      procedureId: procedure.metadata.code,
    };

    callLLMAssistant(payload)
      .then((response) => {
        if (!cancelled) {
          setAiAdvice(response);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAdviceError(err instanceof Error ? err.message : "Erreur inconnue");
          setAiAdvice(mockAdvice);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsAdviceLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentStep, currentStepIndex, totalSteps, phase, procedure.metadata.code]);

  const handleSendMessage = useCallback(
    async (message: string): Promise<string> => {
      if (!currentStep) return "";
      setIsAdviceLoading(true);
      setAdviceError(null);

      const payload: AssistantAdvicePayload = {
        step: currentStep,
        stepIndex: currentStepIndex,
        totalSteps,
        phase,
        userMessage: message,
        procedureId: procedure.metadata.code,
      };

      try {
        const response = await callLLMAssistant(payload);
        return response;
      } catch (err) {
        const mockResponse = generateAssistantAdvice({
          step: currentStep,
          stepIndex: currentStepIndex,
          totalSteps,
          phase,
          userMessage: message,
        });
        setAdviceError(err instanceof Error ? err.message : "Erreur inconnue");
        return mockResponse;
      } finally {
        setIsAdviceLoading(false);
      }
    },
    [currentStep, currentStepIndex, totalSteps, phase, procedure.metadata.code]
  );

  const handleReadAloud = useCallback(() => {
    if (voice.isSpeaking) {
      voice.stopReading();
    } else if (currentStep) {
      voice.readStep(currentStep, currentStepIndex, totalSteps, phase);
    }
  }, [voice, currentStep, currentStepIndex, totalSteps, phase]);

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
    console.log("[ProcedureExecutor] Rendering BriefingStage", {
      procedureCode: procedure.metadata.code,
      procedureTitle: procedure.metadata.title,
    });
    return (
      <BriefingStage
        procedure={procedure}
        onStart={() => handlePhaseTransition("prerequisites")}
      />
    );
  }

  if (phase === "prerequisites") {
    console.log("[ProcedureExecutor] Rendering PrerequisitesStage", {
      procedureCode: procedure.metadata.code,
      executionId,
    });
    return (
      <PrerequisitesStage
        procedure={procedure}
        onValidate={() => {
          console.log("[ProcedureExecutor] Prerequisites validated, starting execution");
          timer.start();
          handlePhaseTransition("executing");
        }}
      />
    );
  }

  if (phase === "completed") {
    console.log("[ProcedureExecutor] Rendering CompletedStage", {
      procedureCode: procedure.metadata.code,
      executionId,
      completedSteps: completedSteps.size,
      totalSteps,
    });
    return (
      <CompletedStage
        procedure={procedure}
        context={context}
        executionId={executionId}
        onClose={onClose}
      />
    );
  }

  if (phase === "aborted") {
    console.log("[ProcedureExecutor] Rendering AbortedStage", {
      procedureCode: procedure.metadata.code,
      reason: context.anomalies[context.anomalies.length - 1] || "Interruption",
      anomalies: context.anomalies.length,
    });
    return (
      <AbortedStage
        procedure={procedure}
        context={context}
        reason={context.anomalies[context.anomalies.length - 1] || "Interruption"}
        onClose={onClose}
      />
    );
  }

  console.log("[ProcedureExecutor] Rendering RunningStage", {
    procedureCode: procedure.metadata.code,
    currentStepIndex,
    totalSteps,
    executionId,
    phase,
  });

  return (
    <RunningStage
      steps={[...procedure.steps].sort((a, b) => a.order - b.order)}
      currentStepIndex={currentStepIndex}
      completedSteps={completedSteps}
      advice={aiAdvice}
      onPrevious={actions.previousStep}
      onNext={actions.nextStep}
      onToggleComplete={actions.completeStep}
      onSendMessage={handleSendMessage}
      isSpeaking={voice.isSpeaking}
      isAutoRead={true}
      onToggleAutoRead={voice.toggleEnabled}
      onReadAloud={handleReadAloud}
      progress={progress}
      isAdviceLoading={isAdviceLoading}
      adviceError={adviceError}
      sensorData={sensorData ?? undefined}
      activeAlarms={activeAlarms}
      onCheckAlarms={actions.checkAlarms}
    />
  );
}
