"use client";

import { useState, useEffect, useRef } from "react";
import { TStep } from "@/lib/procedures/services/validator.service";
import { proceduresFR } from "@/lib/i18n/procedures";
import { StepGuide } from "./StepGuide";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, SkipBack, SkipForward, Volume2, VolumeX, CheckCircle2, Pause } from "lucide-react";

interface RunningStageProps {
  steps: TStep[];
  currentStepIndex: number;
  completedSteps: Set<string>;
  advice: string;
  onPrevious: () => void;
  onNext: () => void;
  onToggleComplete: (stepId: string) => void;
  onSendMessage: (message: string) => void;
  isSpeaking: boolean;
  isAutoRead: boolean;
  onToggleAutoRead: () => void;
  onReadAloud: () => void;
  progress: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function RunningStage({
  steps,
  currentStepIndex,
  completedSteps,
  advice,
  onPrevious,
  onNext,
  onToggleComplete,
  onSendMessage,
  isSpeaking,
  isAutoRead,
  onToggleAutoRead,
  onReadAloud,
  progress,
}: RunningStageProps) {
  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;
  const isStepCompleted = completedSteps.has(currentStep?.id || "");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    onSendMessage(trimmed);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-medium text-muted-foreground truncate">
            {proceduresFR.guide.executing.stepOf
              .replace("{current}", String(currentStepIndex + 1))
              .replace("{total}", String(steps.length))}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onReadAloud}
            title={isSpeaking ? "Arrêter la lecture" : "Lire l'étape"}
          >
            {isSpeaking ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={onToggleAutoRead}
          >
            {isAutoRead ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
            {isAutoRead ? "Auto ON" : "Auto OFF"}
          </Button>
          <Badge variant="secondary" className="text-xs">
            {Math.round(progress)}%
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col lg:flex-row">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="mx-auto max-w-2xl space-y-6">
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                  {Math.round(progress)}%
                </span>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {steps.map((step, idx) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => onPrevious && idx < currentStepIndex && onPrevious()}
                    disabled={idx > currentStepIndex}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors shrink-0 ${
                      idx === currentStepIndex
                        ? "bg-primary text-primary-foreground"
                        : idx < currentStepIndex
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                        idx <= currentStepIndex ? "bg-primary/20" : "bg-muted-foreground/20"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    {step.title ? step.title.slice(0, 15) : `Étape ${idx + 1}`}
                  </button>
                ))}
              </div>

              {currentStep && (
                <StepGuide
                  step={currentStep}
                  stepIndex={currentStepIndex}
                  totalSteps={steps.length}
                  isCompleted={isStepCompleted}
                  onToggleComplete={() => onToggleComplete(currentStep.id)}
                  advice={advice}
                />
              )}

              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPrevious}
                  disabled={isFirstStep}
                  className="gap-1.5"
                >
                  <SkipBack className="h-3.5 w-3.5" />
                  {proceduresFR.guide.executing.previousStep}
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant={isStepCompleted ? "default" : "outline"}
                    size="sm"
                    onClick={() => onToggleComplete(currentStep?.id || "")}
                    className="gap-1.5"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {isStepCompleted ? "Effectuée" : "Marquer effectuée"}
                  </Button>
                  {isLastStep ? (
                    <Button size="sm" onClick={onNext} className="gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {proceduresFR.guide.executing.finishProcedure}
                    </Button>
                  ) : (
                    <Button size="sm" onClick={onNext} className="gap-1.5">
                      {proceduresFR.guide.executing.nextStep}
                      <SkipForward className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-border bg-muted/20 flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                {proceduresFR.assistant.title}
              </h3>
              {isSpeaking && (
                <Badge variant="secondary" className="text-[10px] gap-1">
                  <Volume2 className="h-2.5 w-2.5" />
                  Lecture
                </Badge>
              )}
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <Card
                      className={`max-w-[90%] text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card"
                      }`}
                    >
                      <div className="p-3">{msg.content}</div>
                    </Card>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            <div className="p-3 border-t border-border">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Posez votre question..."
                  className="h-9 text-xs"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  disabled={!input.trim()}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
