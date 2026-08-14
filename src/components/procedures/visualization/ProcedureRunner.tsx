"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSpeech } from "@/lib/speech/use-speech";
import {
  TProcedure,
  TStep,
} from "@/lib/procedures/services/validator.service";
import { proceduresFR } from "@/lib/i18n/procedures";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  CheckCircle2,
  Send,
  AlertTriangle,
  Camera,
  ShieldAlert,
  Clock,
  FileText,
  Tag,
  X,
  Bot,
  Mic,
  Hand,
  Video,
  Paperclip,
} from "lucide-react";

interface ProcedureRunnerProps {
  procedure: TProcedure;
  onClose: () => void;
}

type MessageRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
}

const stepTypeIcons: Record<string, React.ReactNode> = {
  consigne_simple: <FileText className="h-4 w-4" />,
  saisie_donnees: <Tag className="h-4 w-4" />,
  inspection_visuelle: <Camera className="h-4 w-4" />,
  validation_securite: <ShieldAlert className="h-4 w-4" />,
  mesure_numerique: <Clock className="h-4 w-4" />,
};

const mediaTypeIcons: Record<string, React.ReactNode> = {
  photo: <Camera className="h-3.5 w-3.5" />,
  video: <Video className="h-3.5 w-3.5" />,
  audio: <Mic className="h-3.5 w-3.5" />,
  signature: <Hand className="h-3.5 w-3.5" />,
};

const alarmTypeLabels: Record<string, string> = {
  DANGER: "Danger",
  WARNING: "Avertissement",
  INFO: "Information",
  SECURITY_CHECK: "Contrôle sécurité",
};

const stepTypeLabels: Record<string, string> = {
  consigne_simple: "Consigne simple",
  saisie_donnees: "Saisie de données",
  inspection_visuelle: "Inspection visuelle",
  validation_securite: "Validation de sécurité",
  mesure_numerique: "Mesure numérique",
};

function buildStepScript(step: TStep, index: number, total: number): string {
  const parts: string[] = [];
  parts.push(`Étape ${index + 1} sur ${total}.`);
  if (step.title) parts.push(`Titre : ${step.title}.`);
  if (step.subtitle) parts.push(`Sous-titre : ${step.subtitle}.`);
  if (step.instructions) parts.push(`Instructions : ${step.instructions}.`);
  if (step.isMandatory) parts.push("Cette étape est obligatoire et ne peut pas être ignorée.");
  if (step.timerEnabled && step.timerSeconds > 0) {
    const mins = Math.floor(step.timerSeconds / 60);
    const secs = step.timerSeconds % 60;
    parts.push(`Chronomètre activé : durée maximale ${mins} minute${mins > 1 ? "s" : ""}${secs > 0 ? ` et ${secs} seconde${secs > 1 ? "s" : ""}` : ""}.`);
  }
  if (step.mediaRequirements.length > 0) {
    const mediaList = step.mediaRequirements
      .map((m) => {
        const parts: string[] = [];
        parts.push(proceduresFR.media[m.type] || m.type);
        if (m.mandatory) parts.push("obligatoire");
        if (m.options?.geolocation) parts.push("avec géolocalisation");
        if (m.options?.timestamp) parts.push("avec horodatage");
        return parts.join(" ");
      })
      .join(", ");
    parts.push(`Captures requises : ${mediaList}.`);
  }
  if (step.alarms.length > 0) {
    parts.push(`Attention : ${step.alarms.length} alerte(s) configurée(s) sur cette étape.`);
    step.alarms.forEach((alarm) => {
      parts.push(
        `Alerte ${alarm.type} : ${alarm.condition}${alarm.threshold ? ` (seuil ${alarm.threshold})` : ""}. Message : ${alarm.message}.`
      );
    });
  }
  return parts.join(" ");
}

function getStepAIContent(step: TStep, index: number, total: number): string {
  const lines: string[] = [];
  lines.push(`📌 **Étape ${index + 1}/${total}** — ${step.title || "Sans titre"}`);

  if (step.type === "consigne_simple") {
    lines.push(
      "Suivez attentivement les consignes décrites ci-dessus. N'hésitez pas à relire les instructions avant d'agir."
    );
  } else if (step.type === "saisie_donnees") {
    lines.push(
      "Assurez-vous de saisir les données exactement comme indiqué. Toute erreur de saisie peut compromettre la procédure."
    );
  } else if (step.type === "inspection_visuelle") {
    lines.push(
      "Vérifiez minutieusement l'état de l'équipement ou de l'environnement. Signalez toute anomalie avant de continuer."
    );
  } else if (step.type === "validation_securite") {
    lines.push(
      "⚠️ Cette étape est critique pour la sécurité. Vérifiez scrupuleusement chaque point avant de valider."
    );
  } else if (step.type === "mesure_numerique") {
    lines.push(
      "Utilisez l'appareil de mesure calibré. Notez la valeur avec précision et vérifiez l'unité."
    );
  }

  if (step.isMandatory) {
    lines.push("🔒 Cette étape est **obligatoire**. Vous ne pourrez pas passer à la suite sans l'avoir complétée.");
  }

  if (step.timerEnabled && step.timerSeconds > 0) {
    const mins = Math.floor(step.timerSeconds / 60);
    lines.push(`⏱️ Chronomètre activé : vous disposez de ${mins} minute${mins > 1 ? "s" : ""} maximum.`);
  }

  if (step.mediaRequirements.length > 0) {
    lines.push("📸 N'oubliez pas les captures média requises :");
    step.mediaRequirements.forEach((m) => {
      const constraints: string[] = [proceduresFR.media[m.type] || m.type];
      if (m.mandatory) constraints.push("obligatoire");
      if (m.options?.geolocation) constraints.push("géolocalisation");
      if (m.options?.timestamp) constraints.push("horodatage");
      lines.push(`  - ${constraints.join(" · ")}`);
    });
  }

  if (step.alarms.length > 0) {
    lines.push("🚨 Alertes configurées sur cette étape :");
    step.alarms.forEach((alarm) => {
      lines.push(
        `  - [${alarm.type}] ${alarm.condition}${alarm.threshold ? ` → seuil ${alarm.threshold}` : ""} : ${alarm.message}`
      );
    });
  }

  if (index === 0) {
    lines.push("🚀 C'est la première étape de la procédure. Prenez le temps de bien comprendre les consignes.");
  } else if (index === total - 1) {
    lines.push("🏁 Dernière étape ! Une fois terminée, la procédure sera achevée.");
  }

  if (step.dependencies.length > 0) {
    lines.push("🔗 Cette étape dépend d'autres étapes. Assurez-vous qu'elles sont bien complétées.");
  }

  return lines.join("\n");
}

function getChatResponse(
  userMessage: string,
  step: TStep,
  stepIndex: number,
  totalSteps: number
): string {
  const lower = userMessage.toLowerCase();

  if (lower.includes("étape") || lower.includes("step") || lower.includes("quoi faire")) {
    return `Étape ${stepIndex + 1} : "${step.title || "Sans titre"}". ${step.instructions || "Suivez les consignes affichées."}`;
  }

  if (lower.includes("sécurité") || lower.includes("danger") || lower.includes("alerte")) {
    if (step.alarms.length > 0) {
      const alarmDetails = step.alarms
        .map((a) => `[${a.type}] ${a.condition}${a.threshold ? ` (seuil ${a.threshold})` : ""}`)
        .join(" ; ");
      return `Cette étape comporte ${step.alarms.length} alerte(s) : ${alarmDetails}. ${step.alarms.find((a) => a.type === "DANGER")?.message || "Soyez vigilant."}`;
    }
    return "Aucune alerte spécifique sur cette étape. Respectez les consignes générales de sécurité.";
  }

  if (lower.includes("média") || lower.includes("photo") || lower.includes("vidéo") || lower.includes("capture")) {
    if (step.mediaRequirements.length > 0) {
      const mediaList = step.mediaRequirements
        .map((m) => `${proceduresFR.media[m.type] || m.type}${m.mandatory ? " (obligatoire)" : ""}`)
        .join(", ");
      return `Captures requises : ${mediaList}. ${step.mediaRequirements.some((m) => m.options?.geolocation) ? "La géolocalisation est activée." : ""} ${step.mediaRequirements.some((m) => m.options?.timestamp) ? "L'horodatage est activé." : ""}`;
    }
    return "Aucune capture média n'est requise pour cette étape.";
  }

  if (lower.includes("obligatoire") || lower.includes("mandatory") || lower.includes("bloquant")) {
    if (step.isMandatory) {
      return "Oui, cette étape est obligatoire. Vous ne pouvez pas la skipper. Assurez-vous de bien la compléter avant de passer à la suivante.";
    }
    return "Cette étape n'est pas obligatoire, mais elle est recommandée pour garantir la qualité de la procédure.";
  }

  if (lower.includes("temps") || lower.includes("durée") || lower.includes("timer")) {
    if (step.timerEnabled && step.timerSeconds > 0) {
      const mins = Math.floor(step.timerSeconds / 60);
      const secs = step.timerSeconds % 60;
      return `Chronomètre activé : durée maximale ${mins} minute${mins > 1 ? "s" : ""}${secs > 0 ? ` et ${secs} seconde${secs > 1 ? "s" : ""}` : ""}. Si le délai est dépassé, une alerte peut se déclencher.`;
    }
    return "Aucun chronomètre n'est configuré pour cette étape.";
  }

  if (lower.includes("début") || lower.includes("commencer") || lower.includes("débutant")) {
    return `Vous êtes à l'étape ${stepIndex + 1} sur ${totalSteps}. ${stepIndex === 0 ? "C'est le début de la procédure. Lisez bien les consignes." : `Il vous reste ${totalSteps - stepIndex - 1} étape(s) après celle-ci.`}`;
  }

  if (lower.includes("fin") || lower.includes("terminer") || lower.includes("finir")) {
    return `Il vous reste ${totalSteps - stepIndex - 1} étape(s) après celle-ci. ${stepIndex === totalSteps - 1 ? "C'est la dernière étape ! Terminez-la pour achever la procédure." : ""}`;
  }

  if (lower.includes("type") || lower.includes("catégorie")) {
    const labels: Record<string, string> = {
      consigne_simple: "Consigne simple",
      saisie_donnees: "Saisie de données",
      inspection_visuelle: "Inspection visuelle",
      validation_securite: "Validation de sécurité",
      mesure_numerique: "Mesure numérique",
    };
    return `Type d'étape : ${labels[step.type] || step.type}. Cela détermine la nature de l'action attendue.`;
  }

  const defaultResponses = [
    `Je vous accompagne sur l'étape ${stepIndex + 1} : "${step.title || "étape sans titre"}". ${step.instructions || "Suivez les consignes affichées."}`,
    `Pour cette étape, concentrez-vous sur : ${step.instructions || "les consignes affichées"}. ${step.isMandatory ? "N'oubliez pas qu'elle est obligatoire." : ""}`,
    `Restez concentré sur l'étape en cours. Si vous avez une question spécifique sur les consignes, je peux vous aider.`,
  ];

  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

export function ProcedureRunner({ procedure, onClose }: ProcedureRunnerProps) {
  const steps = useMemo(
    () => [...procedure.steps].sort((a, b) => a.order - b.order),
    [procedure.steps]
  );

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isAutoRead, setIsAutoRead] = useState(true);
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasAutoGreeted = useRef(false);

  const { speak, stopSpeaking, isSpeaking, error } = useSpeech({
    language: "fr-FR",
    continuous: false,
  });

  const currentStep = steps[currentStepIndex];
  const progress = steps.length > 0 ? ((currentStepIndex + 1) / steps.length) * 100 : 0;
  const isLastStep = currentStepIndex === steps.length - 1;
  const isFirstStep = currentStepIndex === 0;
  const isStepCompleted = completedSteps.has(currentStepIndex);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [aiMessages, scrollToBottom]);

  useEffect(() => {
    if (isAutoRead && currentStep && !hasAutoGreeted.current) {
      hasAutoGreeted.current = true;
      const script = buildStepScript(currentStep, currentStepIndex, steps.length);
      speak(script);
      const aiContent = getStepAIContent(currentStep, currentStepIndex, steps.length);
      setAiMessages([
        { id: Date.now().toString(), role: "assistant", content: `Bonjour ! Je suis votre guide technique pour la procédure « ${procedure.metadata.title || "Sans titre"} ». Je vais vous accompagner étape par étape.\n\n` + aiContent },
      ]);
    }
  }, [currentStepIndex, isAutoRead, currentStep, procedure.metadata.title, steps.length, speak]);

  useEffect(() => {
    if (!isAutoRead || !currentStep) return;
    const timer = setTimeout(() => {
      const script = buildStepScript(currentStep, currentStepIndex, steps.length);
      speak(script);
      const aiContent = getStepAIContent(currentStep, currentStepIndex, steps.length);
      setAiMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "assistant", content: aiContent },
      ]);
    }, 600);
    return () => clearTimeout(timer);
  }, [currentStepIndex, isAutoRead, currentStep, steps.length, speak]);

  const handleReadAloud = useCallback(() => {
    if (isSpeaking) {
      stopSpeaking();
    } else if (currentStep) {
      const script = buildStepScript(currentStep, currentStepIndex, steps.length);
      speak(script);
    }
  }, [isSpeaking, stopSpeaking, speak, currentStep, currentStepIndex, steps.length]);

  const handleNext = useCallback(() => {
    if (!isLastStep) {
      setCompletedSteps((prev) => new Set(prev).add(currentStepIndex));
      setCurrentStepIndex((prev) => prev + 1);
      stopSpeaking();
    }
  }, [isLastStep, currentStepIndex, stopSpeaking]);

  const handlePrevious = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStepIndex((prev) => prev - 1);
      stopSpeaking();
    }
  }, [isFirstStep, stopSpeaking]);

  const handleToggleComplete = useCallback(() => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(currentStepIndex)) {
        next.delete(currentStepIndex);
      } else {
        next.add(currentStepIndex);
      }
      return next;
    });
  }, [currentStepIndex]);

  const handleFinish = useCallback(() => {
    setCompletedSteps((prev) => new Set(prev).add(currentStepIndex));
    stopSpeaking();
    onClose();
  }, [currentStepIndex, stopSpeaking, onClose]);

  const handleSendAiMessage = useCallback(() => {
    const trimmed = aiInput.trim();
    if (!trimmed || !currentStep) return;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
    };
    setAiMessages((prev) => [...prev, userMsg]);
    setAiInput("");

    setTimeout(() => {
      const response = getChatResponse(trimmed, currentStep, currentStepIndex, steps.length);
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
      };
      setAiMessages((prev) => [...prev, aiMsg]);
    }, 500);
  }, [aiInput, currentStep, currentStepIndex, steps.length]);

  if (steps.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center p-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium text-foreground">Aucune étape à afficher</p>
        <p className="text-sm text-muted-foreground mt-1">Cette procédure ne contient pas d&apos;étapes.</p>
        <Button variant="outline" className="mt-4" onClick={onClose}>
          Fermer
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground truncate">
              {procedure.metadata.title || "Procédure sans titre"}
            </h2>
            <p className="text-xs text-muted-foreground truncate">
              Étape {currentStepIndex + 1} / {steps.length} — {currentStep?.title || "Sans titre"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleReadAloud}
            title={isSpeaking ? "Arrêter la lecture" : "Lire l'étape"}
          >
            {isSpeaking ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
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

              <Card className="p-5 sm:p-6 space-y-5">
                <div className="flex items-start gap-3">
                  <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {stepTypeIcons[currentStep?.type || "consigne_simple"] || <FileText className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {proceduresFR.steps.typeLabel}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {stepTypeLabels[currentStep?.type || ""] || currentStep?.type || "—"}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mt-1">
                      {currentStep?.title || `Étape ${currentStepIndex + 1}`}
                    </h3>
                    {currentStep?.subtitle && (
                      <p className="text-sm text-muted-foreground mt-0.5">{currentStep.subtitle}</p>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      {proceduresFR.steps.instructionsLabel}
                    </Label>
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {currentStep?.instructions || "Aucune instruction fournie pour cette étape."}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        id={`runner-mandatory-${currentStep?.id}`}
                        checked={currentStep?.isMandatory || false}
                        disabled
                      />
                      <Label htmlFor={`runner-mandatory-${currentStep?.id}`} className="text-xs text-muted-foreground cursor-default">
                        {proceduresFR.steps.mandatoryLabel}
                      </Label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        id={`runner-complete-${currentStep?.id}`}
                        checked={isStepCompleted}
                        onCheckedChange={handleToggleComplete}
                      />
                      <Label htmlFor={`runner-complete-${currentStep?.id}`} className="text-xs cursor-pointer">
                        Marquer comme effectuée
                      </Label>
                    </div>
                    {currentStep?.timerEnabled && currentStep.timerSeconds > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {Math.floor(currentStep.timerSeconds / 60)}:
                        {(currentStep.timerSeconds % 60).toString().padStart(2, "0")}
                      </div>
                    )}
                  </div>

                  {currentStep?.mediaRequirements && currentStep.mediaRequirements.length > 0 && (
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                        {proceduresFR.media.title}
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {currentStep.mediaRequirements.map((media, i) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            className={`gap-1.5 text-xs ${media.mandatory ? "border-primary/30" : ""}`}
                          >
                            {mediaTypeIcons[media.type]}
                            {proceduresFR.media[media.type] || media.type}
                            {media.mandatory && " *"}
                            {(media.options?.geolocation || media.options?.timestamp) && (
                              <span className="text-[10px] text-muted-foreground">
                                ({[media.options?.geolocation && "Géo", media.options?.timestamp && "Horodatage"].filter(Boolean).join(" + ")})
                              </span>
                            )}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentStep?.alarms && currentStep.alarms.length > 0 && (
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                        {proceduresFR.alarms.title}
                      </Label>
                      <div className="space-y-2">
                        {currentStep.alarms.map((alarm, i) => (
                          <div
                            key={i}
                            className={`rounded-lg border-l-4 p-3 ${
                              alarm.type === "DANGER"
                                ? "border-l-alarm-danger bg-alarm-danger-bg"
                                : alarm.type === "WARNING"
                                ? "border-l-alarm-warning bg-alarm-warning-bg"
                                : alarm.type === "INFO"
                                ? "border-l-alarm-info bg-alarm-info-bg"
                                : "border-l-alarm-security bg-alarm-security-bg"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-xs font-semibold uppercase tracking-wide">
                                {alarmTypeLabels[alarm.type] || alarm.type}
                              </span>
                            </div>
                            <p className="text-sm mt-1 text-foreground">{alarm.message}</p>
                            {(alarm.condition || alarm.threshold) && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Condition : {alarm.condition}
                                {alarm.threshold ? ` → Seuil : ${alarm.threshold}` : ""}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentStep?.attachments && currentStep.attachments.length > 0 && (
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                        {proceduresFR.steps.attachmentsLabel}
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {currentStep.attachments.map((att, i) => (
                          <Badge key={i} variant="secondary" className="text-xs gap-1">
                            <Paperclip className="h-3 w-3" />
                            {att}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevious}
                    disabled={isFirstStep}
                    className="gap-1.5"
                  >
                    <SkipBack className="h-3.5 w-3.5" />
                    Précédent
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={isStepCompleted ? "default" : "outline"}
                      size="sm"
                      onClick={handleToggleComplete}
                      className="gap-1.5"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {isStepCompleted ? "Effectuée" : "Marquer effectuée"}
                    </Button>
                    {isLastStep ? (
                      <Button size="sm" onClick={handleFinish} className="gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Terminer la procédure
                      </Button>
                    ) : (
                      <Button size="sm" onClick={handleNext} className="gap-1.5">
                        Suivant
                        <SkipForward className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <div className="lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-border bg-muted/20 flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Accompagnement IA</h3>
              {isSpeaking && (
                <Badge variant="secondary" className="text-[10px] gap-1">
                  <Volume2 className="h-2.5 w-2.5" />
                  Lecture en cours
                </Badge>
              )}
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {aiMessages.map((msg) => (
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
                  handleSendAiMessage();
                }}
                className="flex gap-2"
              >
                <Input
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Posez votre question..."
                  className="h-9 text-xs"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  disabled={!aiInput.trim()}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </form>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => setIsAutoRead((prev) => !prev)}
                  >
                    {isAutoRead ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                    {isAutoRead ? "Lecture auto ON" : "Lecture auto OFF"}
                  </Button>
                </div>
                {error && <p className="text-[10px] text-destructive">{error}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
