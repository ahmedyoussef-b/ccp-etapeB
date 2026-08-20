"use client";

import { useState, useCallback, useRef, useEffect } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSpeech } from "@/lib/speech/use-speech";
import { speechLogger } from "@/lib/speech/speech-logger";
import { Mic, MicOff, Volume2, VolumeX, RefreshCw } from "lucide-react";

type VoiceGuidedInputMode = "input" | "textarea";

interface VoiceGuidedInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  mode?: VoiceGuidedInputMode;
  guidance?: string;
  language?: string;
  continuous?: boolean;
  disabled?: boolean;
  className?: string;
  onVoiceCommand?: (command: "yes" | "no" | "clear") => void;
}

export function VoiceGuidedInput({
  value,
  onChange,
  label,
  placeholder,
  mode = "input",
  guidance,
  language = "fr-FR",
  continuous = false,
  disabled = false,
  className,
  onVoiceCommand,
}: VoiceGuidedInputProps) {
  const [interimText, setInterimText] = useState("");
  const [commandDetected, setCommandDetected] = useState<"clear" | "yes" | "no" | null>(null);
  const guidanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSpokenGuidanceRef = useRef(false);
  const commandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCommand = useCallback(
    (command: "yes" | "no" | "clear") => {
      setCommandDetected(command);
      commandTimerRef.current = setTimeout(() => setCommandDetected(null), 2000);

      if (command === "clear") {
        onChange("");
        setInterimText("");
        speechLogger.info("voiceCommandExecuted", { command: "clear", label });
      } else if (command === "yes") {
        speechLogger.info("voiceCommandExecuted", { command: "yes", label });
      } else if (command === "no") {
        speechLogger.info("voiceCommandExecuted", { command: "no", label });
      }
      onVoiceCommand?.(command);
    },
    [onChange, onVoiceCommand, label]
  );

  const {
    isListening,
    transcript,
    error,
    isSpeaking,
    speak,
    toggleListening,
    stopSpeaking,
  } = useSpeech({ language, continuous, onCommand: handleCommand });

  const mergedText = value || interimText || transcript;

  useEffect(() => {
    if (!guidance || hasSpokenGuidanceRef.current || disabled) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    guidanceTimerRef.current = setTimeout(() => {
      speak(guidance);
      speechLogger.trace.guidanceSpoken(guidance);
      hasSpokenGuidanceRef.current = true;
    }, 800);

    return () => {
      if (guidanceTimerRef.current) {
        clearTimeout(guidanceTimerRef.current);
      }
    };
  }, [guidance, disabled, speak]);

  useEffect(() => {
    hasSpokenGuidanceRef.current = false;
  }, [label]);

  useEffect(() => {
    if (transcript && !isListening) {
      onChange(transcript);
      setInterimText("");
    }
  }, [transcript, isListening, onChange]);

  useEffect(() => {
    if (!isListening) {
      setInterimText("");
    }
  }, [isListening]);

  useEffect(() => {
    return () => {
      if (commandTimerRef.current) {
        clearTimeout(commandTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (guidanceTimerRef.current) {
        clearTimeout(guidanceTimerRef.current);
      }
      stopSpeaking();
    };
  }, [stopSpeaking]);

  const handleMicClick = useCallback(() => {
    if (!isListening) {
      setInterimText("");
    }
    speechLogger.info("userAction", { action: "micClick", isListening, label });
    toggleListening();
  }, [isListening, toggleListening, label]);

  const handleSpeakClick = useCallback(() => {
    const textToRead = guidance && !value ? guidance : mergedText;
    speechLogger.info("userAction", { action: "speakClick", hasText: !!textToRead.trim(), label });
    if (textToRead.trim()) {
      speak(textToRead.trim());
    }
  }, [mergedText, guidance, value, speak, label]);

  const handleReset = useCallback(() => {
    onChange("");
    setInterimText("");
  }, [onChange]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const isControlled = value.length > 0;
  const isEmpty = !mergedText.trim();
  const showListeningIndicator = isListening && (transcript || interimText);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={label}
          className="text-sm font-medium text-foreground"
        >
          {label}
        </label>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={handleReset}
            disabled={disabled || isEmpty}
            className="h-7 w-7"
            title="Réinitialiser"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={handleSpeakClick}
            disabled={disabled || (isEmpty && !guidance) || isSpeaking}
            className="h-7 w-7"
            title={isSpeaking ? "Arrêter la lecture" : "Écouter"}
          >
            {isSpeaking ? (
              <VolumeX className="h-3.5 w-3.5 text-destructive" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
          </Button>

          <Button
            type="button"
            variant={isListening ? "destructive" : "ghost"}
            size="icon-xs"
            onClick={handleMicClick}
            disabled={disabled}
            className="h-7 w-7"
            title={isListening ? "Arrêter l'écoute" : "Parler"}
          >
            {isListening ? (
              <MicOff className="h-3.5 w-3.5" />
            ) : (
              <Mic className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "relative rounded-lg border border-input bg-background transition-colors",
          "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20",
          showListeningIndicator && "border-primary/60 ring-2 ring-primary/20",
          error && "border-destructive focus-within:border-destructive"
        )}
      >
        {mode === "textarea" ? (
          <Textarea
            id={label}
            value={mergedText}
            onChange={handleInputChange}
            placeholder={placeholder}
            disabled={disabled}
            className="min-h-[100px] resize-none border-0 bg-transparent px-3 py-2 text-base focus-visible:ring-0 placeholder:text-muted-foreground"
          />
        ) : (
          <Input
            id={label}
            value={mergedText}
            onChange={handleInputChange}
            placeholder={placeholder}
            disabled={disabled}
            className="border-0 bg-transparent focus-visible:ring-0 placeholder:text-muted-foreground"
            autoComplete="off"
          />
        )}

        {isListening && (
          <div className="absolute bottom-2 left-3 flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-destructive opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
            </span>
            <span className="text-xs text-destructive font-medium">Écoute en cours...</span>
          </div>
        )}
      </div>

      {isListening && interimText && (
        <p className="text-xs text-muted-foreground italic">
          Texte en cours de reconnaissance : {interimText}
        </p>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {commandDetected === "clear" && (
        <p className="text-xs text-destructive font-medium animate-pulse">
          Commande vocale détectée : effacement du champ en cours...
        </p>
      )}

      {commandDetected === "yes" && (
        <p className="text-xs text-green-600 dark:text-green-400 font-medium animate-pulse">
          Commande vocale détectée : validation du texte.
        </p>
      )}

      {isSpeaking && guidance && !isControlled && (
        <p className="text-xs text-muted-foreground italic">
          Lecture de la guidance : {guidance}
        </p>
      )}
    </div>
  );
}
