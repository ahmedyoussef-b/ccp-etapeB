"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { TStep, TMediaRequirement } from "@/lib/procedures/services/validator.service";
import { TriggeredAlarm, SensorData } from "@/lib/procedures/services/alert-evaluator.service";
import { proceduresFR } from "@/lib/i18n/procedures";
import { StepGuide } from "./StepGuide";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, SkipBack, SkipForward, Volume2, VolumeX, CheckCircle2, Pause, Loader2, AlertTriangle, Thermometer, Video, Mic, ScanEye } from "lucide-react";
import { useMediaCapture, MediaCaptureResult } from "@/lib/procedures/hooks/useMediaCapture";

interface RunningStageProps {
  steps: TStep[];
  currentStepIndex: number;
  completedSteps: Set<string>;
  advice: string;
  onPrevious: () => void;
  onNext: () => void;
  onToggleComplete: (stepId: string) => void;
  onSendMessage: (message: string) => Promise<string>;
  isSpeaking: boolean;
  isAutoRead: boolean;
  onToggleAutoRead: () => void;
  onReadAloud: () => void;
  progress: number;
  isAdviceLoading?: boolean;
  adviceError?: string | null;
  sensorData?: SensorData;
  activeAlarms?: TriggeredAlarm[];
  onCheckAlarms?: (sensorData: Record<string, unknown>) => TriggeredAlarm[];
  executionId?: string | null;
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
  isAdviceLoading,
  adviceError,
  sensorData,
  activeAlarms = [],
  onCheckAlarms,
  executionId,
}: RunningStageProps) {
  console.log("[RunningStage] Rendered", {
    currentStepIndex,
    totalSteps: steps.length,
    progress,
    executionId,
    activeAlarms: activeAlarms.length,
  });

  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;
  const isStepCompleted = completedSteps.has(currentStep?.id || "");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showSensorPanel, setShowSensorPanel] = useState(false);
  const [capturedMedia, setCapturedMedia] = useState<Map<string, MediaCaptureResult>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const alarmCheckRef = useRef<number | null>(null);

  const { isCapturing, capture } = useMediaCapture({
    onCapture: (result) => {
      if (currentStep) {
        setCapturedMedia((prev) => {
          const next = new Map(prev);
          next.set(`${currentStep.id}-${result.type}`, result);
          return next;
        });

        if (executionId) {
          const numericId = parseInt(executionId);
          if (!Number.isNaN(numericId)) {
            const payload = {
              executionId: numericId,
              stepId: currentStep.id,
              type: result.type,
              url: result.dataUrl,
              filename: `${currentStep.id}_${result.type}_${result.timestamp}`,
              mimeType: result.type === "photo" ? "image/jpeg" : result.type === "signature" ? "image/png" : result.type === "video" ? "video/webm" : "audio/webm",
              size: result.blob ? result.blob.size : result.dataUrl.length,
            };

            fetch(`/api/procedures/executions/${numericId}/media`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }).catch(() => {});
          }
        }
      }
    },
  });

  const handleMediaCapture = useCallback(
    async (mediaReq: TMediaRequirement) => {
      console.log("[RunningStage] Media capture requested", {
        type: mediaReq.type,
        mandatory: mediaReq.mandatory,
        stepId: currentStep?.id,
      });
      await capture(mediaReq.type);
    },
    [capture, currentStep]
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (currentStep && messages.length === 0) {
      console.log("[RunningStage] Initial AI greeting for step", {
        stepIndex: currentStepIndex,
        stepId: currentStep.id,
        stepTitle: currentStep.title,
      });
      const aiContent = `Bonjour ! Je suis votre guide technique pour cette procédure. Je vais vous accompagner étape par étape.\n\nÉtape ${currentStepIndex + 1}/${steps.length} : ${currentStep.title || "Sans titre"}.\n${currentStep.instructions || "Suivez les consignes affichées."}`;
      setMessages([
        { id: Date.now().toString(), role: "assistant", content: aiContent },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepIndex]);

  useEffect(() => {
    if (!onCheckAlarms || !sensorData) return;
    if (alarmCheckRef.current) {
      clearInterval(alarmCheckRef.current);
    }
    console.log("[RunningStage] Alarm check interval started (3s)");
    alarmCheckRef.current = window.setInterval(() => {
      onCheckAlarms(sensorData as unknown as Record<string, unknown>);
    }, 3000);
    return () => {
      if (alarmCheckRef.current) {
        clearInterval(alarmCheckRef.current);
        console.log("[RunningStage] Alarm check interval cleared");
      }
    };
  }, [onCheckAlarms, sensorData]);

  const alarmTypeSeverity: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    DANGER: {
      bg: "bg-red-50 dark:bg-red-950/30",
      border: "border-red-500",
      text: "text-red-700 dark:text-red-400",
      badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    },
    WARNING: {
      bg: "bg-amber-50 dark:bg-amber-950/30",
      border: "border-amber-500",
      text: "text-amber-700 dark:text-amber-400",
      badge: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    },
    INFO: {
      bg: "bg-blue-50 dark:bg-blue-950/30",
      border: "border-blue-500",
      text: "text-blue-700 dark:text-blue-400",
      badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    },
    SECURITY_CHECK: {
      bg: "bg-purple-50 dark:bg-purple-950/30",
      border: "border-purple-500",
      text: "text-purple-700 dark:text-purple-400",
      badge: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    },
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    console.log("[RunningStage] User chat message", {
      message: trimmed,
      stepIndex: currentStepIndex,
      stepId: currentStep?.id,
    });
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);

    try {
      const response = await onSendMessage(trimmed);
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Désolé, une erreur est survenue. Veuillez réessayer.",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const handlePreviousClick = () => {
    console.log("[RunningStage] Previous step clicked", {
      from: currentStepIndex,
      to: currentStepIndex - 1,
    });
    onPrevious();
  };

  const handleNextClick = () => {
    console.log("[RunningStage] Next step clicked", {
      from: currentStepIndex,
      to: currentStepIndex + 1,
      isLastStep,
    });
    onNext();
  };

  const handleToggleCompleteClick = () => {
    const newState = !completedSteps.has(currentStep?.id || "");
    console.log("[RunningStage] Toggle complete clicked", {
      stepId: currentStep?.id,
      stepTitle: currentStep?.title,
      newState,
    });
    onToggleComplete(currentStep?.id || "");
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
            <div className="mx-auto max-w-2xl space-y-4">
              {activeAlarms.length > 0 && (
                <div className="space-y-2">
                  {activeAlarms.map((alarm) => {
                    const severity = alarmTypeSeverity[alarm.severity] || alarmTypeSeverity.INFO;
                    return (
                      <div
                        key={`${alarm.stepId}-${alarm.triggeredAt}`}
                        className={`rounded-lg border-l-4 p-3 flex items-start gap-2 animate-pulse ${severity.bg} ${severity.border}`}
                      >
                        <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${severity.text}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${severity.badge}`}>
                              {alarm.severity}
                            </span>
                            <span className="text-xs font-medium text-foreground truncate">
                              {alarm.stepTitle}
                            </span>
                          </div>
                          <p className="text-xs text-foreground mt-0.5">{alarm.alarm.message}</p>
                          {alarm.sensorValue !== undefined && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Valeur capteur: {String(alarm.sensorValue)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

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
                  capturedMedia={capturedMedia}
                  onCaptureMedia={currentStep.mediaRequirements.length > 0 ? handleMediaCapture : undefined}
                  isCapturing={isCapturing}
                />
              )}

              {isAdviceLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Conseil IA en cours de génération...
                </div>
              )}

              {adviceError && (
                <p className="text-xs text-destructive">Erreur IA : {adviceError}</p>
              )}

              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousClick}
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
                    onClick={handleToggleCompleteClick}
                    className="gap-1.5"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {isStepCompleted ? "Effectuée" : "Marquer effectuée"}
                  </Button>
                  {isLastStep ? (
                    <Button size="sm" onClick={handleNextClick} className="gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {proceduresFR.guide.executing.finishProcedure}
                    </Button>
                  ) : (
                    <Button size="sm" onClick={handleNextClick} className="gap-1.5">
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
                {isSending && (
                  <div className="flex justify-start">
                    <Card className="max-w-[90%] text-sm leading-relaxed bg-card">
                      <div className="p-3 flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Réflexion en cours...
                      </div>
                    </Card>
                  </div>
                )}
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
                  disabled={!input.trim() || isSending}
                >
                  {isSending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </Button>
              </form>
            </div>

            {sensorData && (
              <div className="border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowSensorPanel(!showSensorPanel)}
                  className="w-full px-4 py-2.5 flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ScanEye className="h-3.5 w-3.5" />
                  Capteurs en direct
                  <span className="ml-auto flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE
                  </span>
                </button>
                {showSensorPanel && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Caméra</span>
                        <Badge variant={sensorData.camera.active ? "default" : "secondary"} className="text-[9px]">
                          {sensorData.camera.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Video className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-foreground">{sensorData.camera.resolution}</span>
                        <span className="text-[10px] text-muted-foreground">{sensorData.camera.fps} fps</span>
                      </div>
                      {sensorData.camera.motionDetected && (
                        <div className="mt-2 flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/10 border border-red-500/20">
                          <AlertTriangle className="h-3 w-3 text-red-500" />
                          <span className="text-[9px] font-bold text-red-600">MOUVEMENT DÉTECTÉ</span>
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Microphone</span>
                        <Badge variant={sensorData.microphone.active ? "default" : "secondary"} className="text-[9px]">
                          {sensorData.microphone.active ? "Actif" : "Muet"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-mono text-foreground">{Math.round(sensorData.microphone.level)}%</span>
                      </div>
                      {sensorData.microphone.noiseDetected && (
                        <div className="mt-2 flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
                          <AlertTriangle className="h-3 w-3 text-amber-500" />
                          <span className="text-[9px] font-bold text-amber-600">BRUIT DÉTECTÉ</span>
                        </div>
                      )}
                    </div>

                    <div className={`rounded-lg border p-3 ${
                      sensorData.temperature.alert
                        ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                        : "border-border bg-card"
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Température</span>
                        <Badge variant={sensorData.temperature.alert ? "destructive" : "secondary"} className="text-[9px]">
                          {sensorData.temperature.alert ? "Alerte" : "Normal"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Thermometer className={`h-3.5 w-3.5 ${sensorData.temperature.alert ? "text-red-500" : "text-muted-foreground"}`} />
                        <span className={`text-lg font-bold font-mono tabular-nums ${
                          sensorData.temperature.alert ? "text-red-500" : "text-foreground"
                        }`}>
                          {sensorData.temperature.current}
                        </span>
                        <span className="text-xs text-muted-foreground">°{sensorData.temperature.unit}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
