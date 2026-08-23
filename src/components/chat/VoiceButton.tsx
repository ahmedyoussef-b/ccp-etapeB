"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSpeech } from "@/lib/speech/use-speech";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mic, MicOff, VolumeX } from "lucide-react";

interface VoiceButtonProps {
  onTranscript?: (text: string) => void;
  onSpeakingChange?: (speaking: boolean) => void;
}

export function VoiceButton({ onTranscript, onSpeakingChange }: VoiceButtonProps) {
  const {
    isListening,
    transcript,
    isSpeaking,
    error,
    toggleListening,
    stopListening,
    stopSpeaking,
  } = useSpeech({ language: "fr-FR", continuous: false });

  const prevTranscriptRef = useRef("");

  useEffect(() => {
    if (transcript && transcript !== prevTranscriptRef.current && !isListening) {
      onTranscript?.(transcript);
      prevTranscriptRef.current = transcript;
    }
  }, [transcript, isListening, onTranscript]);

  useEffect(() => {
    onSpeakingChange?.(isSpeaking);
  }, [isSpeaking, onSpeakingChange]);

  useEffect(() => {
    return () => {
      stopListening();
      stopSpeaking();
    };
  }, [stopListening, stopSpeaking]);

  const handleToggle = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      prevTranscriptRef.current = "";
      toggleListening();
    }
  }, [isListening, toggleListening, stopListening]);

  const getState = (): "idle" | "listening" | "processing" | "speaking" => {
    if (isSpeaking) return "speaking";
    if (isListening) return "listening";
    return "idle";
  };

  const state = getState();

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon-sm"
        className={cn(
          "h-8 w-8 rounded-xl transition-all duration-300 relative transform-style-3d",
          state === "listening" && "text-destructive hover:text-destructive rotate-y-6 depth-1",
          state === "speaking" && "text-amber-500 hover:text-amber-600 rotate-y-neg-6 depth-1"
        )}
        onClick={handleToggle}
        title={
          state === "listening"
            ? "Arrêter l'écoute"
            : state === "speaking"
            ? "Arrêter la lecture"
            : "Mode vocal"
        }
      >
        {state === "listening" ? (
          <MicOff className="h-4 w-4" />
        ) : state === "speaking" ? (
          <VolumeX className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}

        {state === "listening" && (
          <>
            <span className="absolute inset-0 rounded-xl border-2 border-destructive/40 animate-ping" />
            <span className="absolute inset-0 rounded-xl border-2 border-destructive/60 animate-pulse" />
          </>
        )}

        {state === "speaking" && (
          <span className="absolute inset-0 rounded-xl border-2 border-amber-400/40 animate-pulse" />
        )}
      </Button>

      {error && (
        <div className="absolute top-full right-0 mt-2 w-48 rounded-lg bg-destructive/10 p-2 text-[10px] text-destructive border border-destructive/20 z-50">
          {error}
        </div>
      )}
    </div>
  );
}
