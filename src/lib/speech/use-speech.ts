"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseSpeechOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
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
      setTranscript(finalTranscriptRef.current + interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") {
        setError("Aucun son détecté. Réessayez.");
      } else if (event.error === "audio-capture") {
        setError("Impossible d'accéder au microphone.");
      } else if (event.error !== "aborted") {
        setError(`Erreur de reconnaissance : ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
    setError(null);
  }, [language, continuous, interimResults]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
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
        setError(
          "La synthèse vocale n'est pas supportée par ce navigateur."
        );
        return;
      }

      speechSynthesisRef.current.cancel();

      const utterance = new SpeechSynthesisUtterance(text) as unknown as SpeechSynthesisUtteranceInstance;
      utterance.lang = language;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => {
        setIsSpeaking(false);
        setError("Erreur lors de la synthèse vocale.");
      };

      speechSynthesisRef.current.speak(utterance);
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