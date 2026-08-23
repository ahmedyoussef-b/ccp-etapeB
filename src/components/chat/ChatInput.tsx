"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Send, Paperclip } from "lucide-react";
import { VoiceButton } from "./VoiceButton";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onTranscript?: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ value, onChange, onSend, onTranscript, disabled, placeholder }: ChatInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSend();
      }
    },
    [onSend]
  );

  return (
    <div className="border-t border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-4xl px-4 py-3 sm:px-6 pb-5">
        <div className="relative group">
          <div
            className={cn(
              "absolute -inset-0.5 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500",
              "bg-gradient-to-r from-primary/40 via-primary/20 to-primary/40 blur-sm"
            )}
          />
          <div
            className={cn(
              "relative flex items-center gap-1 rounded-2xl border bg-background/95 backdrop-blur-sm transition-all duration-300 transform-style-3d",
              isFocused
                ? "border-primary/40 shadow-3d-lg rotate-x-1 depth-2"
                : "border-border/60 hover:border-border shadow-3d"
            )}
          >
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder || "Écrivez votre message..."}
              disabled={disabled}
              className="flex h-11 w-full rounded-2xl bg-transparent px-4 py-2 text-sm ring-offset-0 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
            />

            <div className="flex items-center gap-0.5 pr-2">
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                title="Joindre un fichier"
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              <VoiceButton onTranscript={onTranscript} />

              <Button
                variant="default"
                size="icon-sm"
                className="h-8 w-8 rounded-xl bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 transition-all active:scale-95"
                onClick={onSend}
                disabled={disabled || !value.trim()}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <p className="mt-2 text-center text-[10px] text-muted-foreground/60">
          Appuyez sur Entrée pour envoyer • Utilisez le micro pour parler
        </p>
      </div>
    </div>
  );
}
