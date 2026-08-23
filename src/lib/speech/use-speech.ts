"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { speechLogger } from "@/lib/speech/speech-logger";

interface UseSpeechOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onCommand?: (command: "yes" | "no" | "clear", raw: string) => void;
}

interface UseSpeechReturn {
  isListening: boolean;
  transcript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  isSpeaking: boolean;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  toggleListening: () => void;
}

type SpeechRecognitionResult = {
  0: { transcript: string; confidence: number };
  isFinal: boolean;
};

type SpeechRecognitionResultList = {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
};

type SpeechRecognitionEvent = {
  results: SpeechRecognitionResultList;
  resultIndex: number;
};

type SpeechRecognitionErrorEvent = {
  error: string;
  message: string;
};

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = {
  new (): SpeechRecognitionInstance;
};

type SpeechSynthesisUtteranceInstance = {
  text: string;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechSynthesisInstance = {
  cancel: () => void;
  speak: (utterance: SpeechSynthesisUtteranceInstance) => void;
};

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const SpeechRecognition =
    (window as unknown as Record<string, unknown>).SpeechRecognition as
      | SpeechRecognitionConstructor
      | undefined;
  const webkitSpeechRecognition =
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition as
      | SpeechRecognitionConstructor
      | undefined;
  return SpeechRecognition || webkitSpeechRecognition || null;
}

export function useSpeech(
  options: UseSpeechOptions = {}
): UseSpeechReturn {
  const {
    language = "fr-FR",
    continuous = false,
    interimResults = true,
    onCommand,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const speechSynthesisRef =
    useRef<SpeechSynthesisInstance | null>(null);
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    speechSynthesisRef.current = window.speechSynthesis as unknown as SpeechSynthesisInstance;
    return () => {
      if (speechSynthesisRef.current) {
        speechSynthesisRef.current.cancel();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setError(
        "La reconnaissance vocale n'est pas supportée par ce navigateur."
      );
      speechLogger.error("recognitionNotSupported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscriptRef.current += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      const merged = finalTranscriptRef.current + interim;
      speechLogger.trace.recognitionResult(merged, !interim, event.results[event.results.length - 1]?.[0]?.confidence);

      const normalized = merged.trim().toLowerCase();
      const clearCommands = ["efface", "supprime", "annule", "recommence"];
      const yesCommands = ["oui", "valide", "c'est bon", "ok", "d'accord"];
      const noCommands = ["non", "non pas"];

      if (clearCommands.some((cmd) => normalized === cmd || normalized.startsWith(cmd + " "))) {
        speechLogger.info("voiceCommandDetected", { command: "clear", raw: merged });
        finalTranscriptRef.current = "";
        setTranscript("");
        onCommand?.("clear", merged);
      } else if (noCommands.some((cmd) => normalized === cmd || normalized.startsWith(cmd + " "))) {
        speechLogger.info("voiceCommandDetected", { command: "no", raw: merged });
        onCommand?.("no", merged);
      } else if (yesCommands.some((cmd) => normalized === cmd || normalized.startsWith(cmd + " "))) {
        speechLogger.info("voiceCommandDetected", { command: "yes", raw: merged });
        onCommand?.("yes", merged);
      } else {
        setTranscript(merged);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      speechLogger.trace.recognitionError(event.error, event.message);
      if (event.error === "no-speech") {
        setError("Aucun son détecté. Réessayez.");
      } else if (event.error === "audio-capture") {
        setError("Impossible d'accéder au microphone.");
      } else if (event.error !== "aborted") {
        setError(`Erreur de reconnaissance : ${event.error}`);
      }
    };

    recognition.onend = () => {
      speechLogger.trace.listeningStop("onend");
      setIsListening(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
    setError(null);
    speechLogger.trace.listeningStart(language, continuous);
  }, [language, continuous, interimResults, onCommand]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    speechLogger.trace.listeningStop("manual");
  }, []);

  const toggleListening = useCallback(() => {
    const next = !isListening;
    speechLogger.trace.toggle(next);
    if (isListening) {
      stopListening();
    } else {
      finalTranscriptRef.current = "";
      setTranscript("");
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const speak = useCallback(
    (text: string) => {
      if (!speechSynthesisRef.current) {
        speechLogger.error("speechSynthesisNotSupported");
        return;
      }

      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        speechLogger.error("speechSynthesisUnavailable");
        return;
      }

      const synth = speechSynthesisRef.current;
      const voices = (synth as unknown as { getVoices: () => SpeechSynthesisVoice[] }).getVoices?.();
      const hasVoices = Array.isArray(voices) && voices.length > 0;

      const trySpeak = () => {
        synth.cancel();
        speechLogger.trace.speakStart(text, language);

        const utterance = new SpeechSynthesisUtterance(text) as unknown as SpeechSynthesisUtteranceInstance;
        utterance.lang = language;
        let hasError = false;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
          setIsSpeaking(false);
          if (!hasError) {
            speechLogger.trace.speakEnd();
          }
        };
        utterance.onerror = () => {
          hasError = true;
          setIsSpeaking(false);
          speechLogger.trace.speakError("utterance onerror");
        };

        try {
          synth.speak(utterance);
        } catch (err) {
          setIsSpeaking(false);
          speechLogger.trace.speakError("speak threw: " + ((err as Error)?.message ?? err));
        }
      };

      if (!hasVoices) {
        speechLogger.warn("speechSynthesisNoVoices", { language });
        const onVoicesChanged = () => {
          (synth as unknown as { onvoiceschanged: (() => void) | null }).onvoiceschanged = null;
          const updatedVoices = (synth as unknown as { getVoices: () => SpeechSynthesisVoice[] }).getVoices?.();
          if (Array.isArray(updatedVoices) && updatedVoices.length > 0) {
            speechLogger.info("speechSynthesisVoicesLoaded", { count: updatedVoices.length });
            trySpeak();
          } else {
            speechLogger.error("speechSynthesisVoicesUnavailable");
          }
        };
        (synth as unknown as { onvoiceschanged: (() => void) | null }).onvoiceschanged = onVoicesChanged;
        setTimeout(() => {
          (synth as unknown as { onvoiceschanged: (() => void) | null }).onvoiceschanged = null;
          const lateVoices = (synth as unknown as { getVoices: () => SpeechSynthesisVoice[] }).getVoices?.();
          if (Array.isArray(lateVoices) && lateVoices.length > 0) {
            speechLogger.info("speechSynthesisVoicesLoadedLate", { count: lateVoices.length });
            trySpeak();
          } else {
            speechLogger.error("speechSynthesisVoicesTimeout");
          }
        }, 1000);
        return;
      }

      trySpeak();
    },
    [language]
  );

  const stopSpeaking = useCallback(() => {
    if (speechSynthesisRef.current) {
      speechSynthesisRef.current.cancel();
      setIsSpeaking(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (speechSynthesisRef.current) {
        speechSynthesisRef.current.cancel();
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    isSpeaking,
    speak,
    stopSpeaking,
    toggleListening,
  };
}