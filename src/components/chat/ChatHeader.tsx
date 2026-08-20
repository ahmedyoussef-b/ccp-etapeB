"use client";

import { NexaFlowLogo } from "@/components/brand/nexaflow-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatHeaderProps {
  isOnline?: boolean;
  isThinking?: boolean;
  onClear?: () => void;
}

export function ChatHeader({ isOnline = true, isThinking = false, onClear }: ChatHeaderProps) {
  const statusText = isThinking ? "En réflexion" : "En ligne";
  const statusColor = isThinking ? "bg-amber-400" : "bg-emerald-400";

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="relative animate-float-delayed">
            <NexaFlowLogo className="h-9 w-9 rounded-xl shadow-lg shadow-primary/20" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-foreground">
              Assistant IA
            </h1>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                {isOnline && !isThinking && (
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                )}
                <span className={cn("relative inline-flex rounded-full h-2 w-2", statusColor)} />
              </span>
              <p className={cn(
                "text-xs transition-colors duration-300",
                isThinking ? "text-amber-500 font-medium" : "text-muted-foreground"
              )}>
                {statusText}
              </p>
            </div>
          </div>
        </div>

        {onClear && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-xl hover:bg-muted/80 transition-colors"
            onClick={onClear}
            title="Effacer la conversation"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-foreground/60"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </Button>
        )}
      </div>
    </header>
  );
}
