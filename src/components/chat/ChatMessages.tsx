"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronDown, Bot, Sparkles } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import type { Message } from "@/app/(dashboard)/chat-ia/ChatIAPageClient";
import { use3DTilt } from "@/hooks/use3DTilt";

interface ChatMessagesProps {
  messages: Message[];
  isTyping: boolean;
  copiedId: string | null;
  onCopy: (id: string, content: string) => void;
}

export function ChatMessages({ messages, isTyping, copiedId, onCopy }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const containerRef = use3DTilt({ intensity: 5, scale: 1.01 });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    const area = scrollAreaRef.current;
    if (!area) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = area;
      setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 120);
    };
    area.addEventListener("scroll", handleScroll);
    return () => area.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden perspective-1000">
      <ScrollArea className="h-full px-4 py-6 sm:px-6" ref={scrollAreaRef}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in duration-700">
            <div className="relative mb-4 animate-float">
              <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-2xl" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-3d-lg transform-style-3d rotate-y-neg-2">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              Bienvenue sur NexaFlow
            </p>
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
              Je suis votre assistant intelligent. Posez-moi vos questions ou utilisez le micro pour parler.
            </p>
          </div>
        )}

        <div className="space-y-1 pb-4">
          {messages.map((message, index) => {
            const isUser = message.role === "user";
            const showAvatar = !isUser && (index === 0 || messages[index - 1].role !== "assistant");

            return (
              <ChatMessage
                key={message.id}
                message={message}
                isUser={isUser}
                showAvatar={showAvatar}
                copiedId={copiedId}
                onCopy={onCopy}
                index={index}
              />
            );
          })}

          {isTyping && (
            <div className="flex items-end gap-2.5 mt-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Avatar className="h-8 w-8 shrink-0 ring-2 ring-primary/10 animate-pulse">
                <AvatarFallback className="rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted/70 backdrop-blur-md border border-border/50 rounded-2xl rounded-bl-md px-4 py-3 shadow-3d transform-style-3d depth-1">
                <div className="flex items-center gap-1.5">
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">L&apos;assistant réfléchit</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {showScrollBtn && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 animate-in fade-in slide-in-from-bottom-2">
          <Button
            variant="secondary"
            size="icon-sm"
            className="rounded-full shadow-lg border border-border/60 bg-background/90 backdrop-blur-sm hover:bg-background"
            onClick={scrollToBottom}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
