"use client";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Check, Copy, CheckCheck, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/app/(dashboard)/chat-ia/ChatIAPageClient";
import { use3DTilt } from "@/hooks/use3DTilt";

interface ChatMessageProps {
  message: Message;
  isUser: boolean;
  showAvatar: boolean;
  copiedId: string | null;
  onCopy: (id: string, content: string) => void;
  index: number;
}

export function ChatMessage({ message, isUser, showAvatar, copiedId, onCopy, index }: ChatMessageProps) {
  const isCopied = copiedId === message.id;
  const tiltRef = use3DTilt({ intensity: 8, scale: 1.02, speed: 300 });

  return (
    <div
      ref={tiltRef}
      className={cn(
        "flex items-end gap-2.5 animate-in fade-in slide-in-from-bottom-3 duration-500 transform-style-3d",
        isUser ? "flex-row-reverse" : "flex-row",
        showAvatar ? "mt-5" : "mt-1.5"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {showAvatar ? (
        <Avatar className="h-8 w-8 shrink-0 ring-2 ring-primary/10">
          <AvatarFallback className="rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="w-8 shrink-0" />
      )}

      <div
        className={cn(
          "group flex flex-col",
          isUser ? "items-end" : "items-start",
          "max-w-[85%] sm:max-w-[75%]"
        )}
      >
        <div
          className={cn(
            "relative px-4 py-2.5 text-sm leading-relaxed shadow-3d transform-style-3d transition-transform duration-300 hover:rotate-y-1 hover:depth-1",
            isUser
              ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-2xl rounded-br-md"
              : "bg-muted/70 backdrop-blur-md border border-border/50 text-foreground rounded-2xl rounded-bl-md"
          )}
        >
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        </div>

        <div
          className={cn(
            "flex items-center gap-1.5 mt-1 px-1",
            isUser ? "flex-row-reverse" : "flex-row"
          )}
        >
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {message.timestamp.toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {isUser && (
            <span className="text-muted-foreground/60" title="Vu">
              <CheckCheck className="h-3 w-3" />
            </span>
          )}
          {!isUser && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <Button
                variant="ghost"
                size="icon-xs"
                className="h-6 w-6 rounded-md"
                onClick={() => onCopy(message.id, message.content)}
              >
                {isCopied ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3 text-muted-foreground" />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
