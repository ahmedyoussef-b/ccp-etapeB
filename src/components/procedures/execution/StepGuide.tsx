"use client";

import { useMemo } from "react";
import Image from "next/image"; // ✅ DOIT être présent
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { TStep, TMediaRequirement } from "@/lib/procedures/services/validator.service";
import { proceduresFR } from "@/lib/i18n/procedures";
import {
  AlertTriangle,
  Camera,
  Mic,
  Video,
  Hand,
  Clock,
  ShieldAlert,
  Paperclip,
  FileText,
} from "lucide-react";

interface StepGuideProps {
  step: TStep;
  stepIndex: number;
  totalSteps: number;
  isCompleted: boolean;
  onToggleComplete: () => void;
  advice: string;
  capturedMedia?: Map<string, { dataUrl: string; type: string }>;
  onCaptureMedia?: (mediaReq: TMediaRequirement) => void;
  isCapturing?: boolean;
}

const stepTypeLabels: Record<string, string> = {
  consigne_simple: "Consigne simple",
  saisie_donnees: "Saisie de données",
  inspection_visuelle: "Inspection visuelle",
  validation_securite: "Validation de sécurité",
  mesure_numerique: "Mesure numérique",
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

export function StepGuide({
  step,
  stepIndex,
  totalSteps,
  isCompleted,
  onToggleComplete,
  advice,
  capturedMedia,
  onCaptureMedia,
  isCapturing,
}: StepGuideProps) {
  const mediaList = useMemo(() => step.mediaRequirements || [], [step.mediaRequirements]);

  return (
    <Card className="p-5 sm:p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {stepTypeLabels[step.type] || step.type}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Étape {stepIndex + 1} / {totalSteps}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-foreground mt-1">
            {step.title || `Étape ${stepIndex + 1}`}
          </h3>
          {step.subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{step.subtitle}</p>
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
              {step.instructions || "Aucune instruction fournie pour cette étape."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Checkbox
              id={`guide-mandatory-${step.id}`}
              checked={step.isMandatory}
              disabled
            />
            <Label
              htmlFor={`guide-mandatory-${step.id}`}
              className="text-xs text-muted-foreground cursor-default"
            >
              {proceduresFR.steps.mandatoryLabel}
            </Label>
          </div>
          <div className="flex items-center gap-1.5">
            <Checkbox
              id={`guide-complete-${step.id}`}
              checked={isCompleted}
              onCheckedChange={onToggleComplete}
            />
            <Label htmlFor={`guide-complete-${step.id}`} className="text-xs cursor-pointer">
              Marquer comme effectuée
            </Label>
          </div>
          {step.timerEnabled && step.timerSeconds > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {Math.floor(step.timerSeconds / 60)}:
              {(step.timerSeconds % 60).toString().padStart(2, "0")}
            </div>
          )}
        </div>

        {mediaList.length > 0 && (
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              {proceduresFR.media.title}
            </Label>
            <div className="flex flex-wrap gap-2">
              {mediaList.map((media, i) => {
                const captured = capturedMedia?.get(`${step.id}-${media.type}`);
                return (
                  <div key={i} className="flex flex-col gap-1">
                    <Badge
                      variant={captured ? "default" : "secondary"}
                      className={`gap-1.5 text-xs ${media.mandatory && !captured ? "border-primary/30" : ""}`}
                    >
                      {mediaTypeIcons[media.type]}
                      {proceduresFR.media[media.type] || media.type}
                      {media.mandatory && " *"}
                      {(media.options?.geolocation || media.options?.timestamp) && (
                        <span className="text-[10px] text-muted-foreground">
                          (
                          {[media.options?.geolocation && "Géo", media.options?.timestamp && "Horodatage"]
                            .filter(Boolean)
                            .join(" + ")}
                          )
                        </span>
                      )}
                    </Badge>
                    {!captured && onCaptureMedia && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] gap-1"
                        onClick={() => onCaptureMedia(media)}
                        disabled={isCapturing}
                      >
                        <Camera className="h-3 w-3" />
                        Capturer
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
            {mediaList.some((m) => capturedMedia?.has(`${step.id}-${m.type}`)) && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {mediaList
                  .filter((m) => capturedMedia?.has(`${step.id}-${m.type}`))
                  .map((media, i) => {
                    const captured = capturedMedia?.get(`${step.id}-${media.type}`);
                    if (!captured) return null;
                    return (
                      <div
                        key={i}
                        className="rounded-lg border border-border overflow-hidden bg-muted/30"
                      >
                        {media.type === "signature" || media.type === "photo" ? (
                        <Image
  src={captured.dataUrl}
  alt={media.type}
  width={200}
  height={96}
  className="w-full h-24 object-contain bg-white"
  unoptimized // Nécessaire pour les data URLs
/>
                        ) : media.type === "video" || media.type === "audio" ? (
                          <video
                            src={captured.dataUrl}
                            controls
                            className="w-full h-24 object-cover"
                          />
                        ) : null}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {step.alarms.length > 0 && (
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              {proceduresFR.alarms.title}
            </Label>
            <div className="space-y-2">
              {step.alarms.map((alarm, i) => (
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

        {step.attachments.length > 0 && (
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              {proceduresFR.steps.attachmentsLabel}
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {step.attachments.map((att, i) => (
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

      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5" />
          {proceduresFR.assistant.contextTitle}
        </p>
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {advice || proceduresFR.assistant.noAdvice}
        </p>
      </div>
    </Card>
  );
}
