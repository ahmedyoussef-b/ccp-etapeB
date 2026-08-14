"use client";

import { useCallback, useRef, useState } from "react";
import { useSpeech } from "@/lib/speech/use-speech";
import { TStep } from "@/lib/procedures/services/validator.service";
import { GuidePhase } from "@/lib/procedures/types";

export interface UseVoiceAssistantOptions {
  language?: string;
  autoRead?: boolean;
  onReadStart?: () => void;
  onReadEnd?: () => void;
}

export interface UseVoiceAssistantReturn {
  isEnabled: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  error: string | null;
  toggleEnabled: () => void;
  readStep: (step: TStep, stepIndex: number, totalSteps: number, phase: GuidePhase) => void;
  stopReading: () => void;
  readText: (text: string) => void;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
}

function buildStepScript(step: TStep, stepIndex: number, totalSteps: number, phase: GuidePhase): string {
  const parts: string[] = [];

  if (phase === "briefing") {
    parts.push("Briefing de la procédure.");
    if (step.title) parts.push(`Objectif : ${step.title}.`);
    if (step.instructions) parts.push(step.instructions);
    return parts.join(" ");
  }

  if (phase === "prerequisites") {
    parts.push("Vérifiez les prérequis suivants avant de démarrer.");
    return parts.join(" ");
  }

  parts.push(`Étape ${stepIndex + 1} sur ${totalSteps}.`);
  if (step.title) parts.push(`${step.title}.`);
  if (step.subtitle) parts.push(`${step.subtitle}.`);
  if (step.instructions) parts.push(`Instructions : ${step.instructions}.`);
  if (step.isMandatory) parts.push("Étape obligatoire.");
  if (step.timerEnabled && step.timerSeconds > 0) {
    const mins = Math.floor(step.timerSeconds / 60);
    const secs = step.timerSeconds % 60;
    parts.push(`Chronomètre : ${mins} minute${mins > 1 ? "s" : ""}${secs > 0 ? ` et ${secs} seconde${secs > 1 ? "s" : ""}` : ""}.`);
  }
  if (step.mediaRequirements.length > 0) {
    parts.push("Captures requises :");
    step.mediaRequirements.forEach((m) => {
      parts.push(`${m.type}${m.mandatory ? " obligatoire" : ""}.`);
    });
  }
  if (step.alarms.length > 0) {
    parts.push(`${step.alarms.length} alerte(s) configurée(s).`);
    step.alarms.forEach((alarm) => {
      parts.push(`Alerte ${alarm.type} : ${alarm.message}.`);
    });
  }
  return parts.join(" ");
}

export function useVoiceAssistant({
  language = "fr-FR",
  autoRead = true,
  onReadStart,
  onReadEnd,
}: UseVoiceAssistantOptions = {}): UseVoiceAssistantReturn {
  const [isEnabled, setIsEnabled] = useState(false);
  const { speak, stopSpeaking, isSpeaking, isListening, error, startListening, stopListening, toggleListening } =
    useSpeech({ language, continuous: false });
  const autoReadRef = useRef(autoRead);
  autoReadRef.current = autoRead;

  const toggleEnabled = useCallback(() => {
    setIsEnabled((prev) => !prev);
  }, []);

  const readStep = useCallback(
    (step: TStep, stepIndex: number, totalSteps: number, phase: GuidePhase) => {
      if (!isEnabled) return;
      const script = buildStepScript(step, stepIndex, totalSteps, phase);
      onReadStart?.();
      speak(script);
    },
    [isEnabled, speak, onReadStart]
  );

  const readText = useCallback(
    (text: string) => {
      if (!isEnabled) return;
      onReadStart?.();
      speak(text);
    },
    [isEnabled, speak, onReadStart]
  );

  const stopReading = useCallback(() => {
    stopSpeaking();
    onReadEnd?.();
  }, [stopSpeaking, onReadEnd]);

  return {
    isEnabled,
    isSpeaking,
    isListening,
    error: error || null,
    toggleEnabled,
    readStep,
    stopReading,
    readText,
    startListening,
    stopListening,
    toggleListening,
  };
}
