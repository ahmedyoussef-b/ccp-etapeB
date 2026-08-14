"use client";

import { useState, useCallback, useRef, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useSpeech } from "@/lib/speech/use-speech";
import { Mic, MicOff, Volume2, VolumeX, Copy, RotateCcw, Send } from "lucide-react";

interface SpeechControlsProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  language?: string;
  continuous?: boolean;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
  textareaClassName?: string;
  showTextInput?: boolean;
  showActions?: boolean;
  sendOnSpeechEnd?: boolean;
  label?: string;
}

export function SpeechControls({
  value,
  onChange,
  placeholder = "Écrivez ou parlez ici...",
  language = "fr-FR",
  continuous = false,
  maxLength,
  disabled = false,
  className,
  textareaClassName,
  showTextInput = true,
  showActions = true,
  sendOnSpeechEnd = false,
  label,
}: SpeechControlsProps) {
  const {
    isListening,
    transcript,
    error,
    isSpeaking,
    speak,
    toggleListening,
  } = useSpeech({ language, continuous });

  const [localText, setLocalText] = useState(value ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (value !== undefined) {
      setLocalText(value);
    }
  }, [value]);

  useEffect(() => {
    if (transcript && onChange) {
      onChange(transcript);
    }
  }, [transcript, onChange]);

  useEffect(() => {
    if (sendOnSpeechEnd && transcript && !isListening && onChange) {
      onChange(transcript);
    }
  }, [isListening, transcript, sendOnSpeechEnd, onChange]);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      if (maxLength && val.length > maxLength) return;
      setLocalText(val);
      onChange?.(val);
    },
    [maxLength, onChange]
  );

  const handleSend = useCallback(() => {
    if (localText.trim() && onChange) {
      onChange(localText.trim());
    }
  }, [localText, onChange]);

  const handleCopy = useCallback(() => {
    const text = localText || transcript;
    if (text) {
      navigator.clipboard.writeText(text);
    }
  }, [localText, transcript]);

  const handleReset = useCallback(() => {
    setLocalText("");
    onChange?.("");
  }, [onChange]);

  const handleSpeak = useCallback(() => {
    const text = localText || transcript;
    if (text.trim()) {
      speak(text.trim());
    }
  }, [localText, transcript, speak]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const isControlled = value !== undefined;
  const displayText = isControlled ? value : localText;

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}

      <div
        className={cn(
          "relative rounded-lg border border-input bg-background transition-colors",
          "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20",
          error && "border-destructive focus-within:border-destructive",
          textareaClassName
        )}
      >
        <Textarea
          ref={textareaRef}
          value={displayText}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-[80px] resize-none border-0 bg-transparent px-3 py-2 text-base focus-visible:ring-0 placeholder:text-muted-foreground"
          maxLength={maxLength}
        />

        {showActions && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={handleCopy}
              disabled={disabled || (!displayText && !transcript)}
              className="h-7 w-7"
              title="Copier"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={handleReset}
              disabled={disabled || (!displayText && !transcript)}
              className="h-7 w-7"
              title="Réinitialiser"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {showActions && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={isListening ? "destructive" : "default"}
            size="sm"
            onClick={toggleListening}
            disabled={disabled}
            className="gap-1.5"
          >
            {isListening ? (
              <>
                <MicOff className="h-3.5 w-3.5" />
                Arrêter
              </>
            ) : (
              <>
                <Mic className="h-3.5 w-3.5" />
                {isListening ? "Écoute..." : "Micro"}
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSpeak}
            disabled={disabled || (!displayText && !transcript) || isSpeaking}
            className="gap-1.5"
          >
            {isSpeaking ? (
              <>
                <VolumeX className="h-3.5 w-3.5" />
                Arrêter
              </>
            ) : (
              <>
                <Volume2 className="h-3.5 w-3.5" />
                Lire
              </>
            )}
          </Button>

          {showTextInput && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSend}
              disabled={disabled || !displayText.trim()}
              className="gap-1.5 ml-auto"
            >
              <Send className="h-3.5 w-3.5" />
              Envoyer
            </Button>
          )}
        </div>
      )}
    </div>
  );
}