"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TProcedure } from "@/lib/procedures/services/validator.service";
import { proceduresFR } from "@/lib/i18n/procedures";
import {
  Play,
  Clock,
  ShieldAlert,
  FileText,
  Tag,
  AlertTriangle,
} from "lucide-react";

interface BriefingStageProps {
  procedure: TProcedure;
  onStart: () => void;
}

const priorityColors: Record<string, string> = {
  basse: "bg-green-500/10 text-green-700 border-green-500/20",
  moyenne: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  haute: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  critique: "bg-destructive/10 text-destructive border-destructive/20",
};

export function BriefingStage({ procedure, onStart }: BriefingStageProps) {
  console.log("[BriefingStage] Rendered", {
    code: procedure.metadata.code,
    title: procedure.metadata.title,
    steps: procedure.steps.length,
  });

  const { metadata } = procedure;
  const stepCount = procedure.steps.length;

  const safetyItems = useMemo(() => {
    if (!metadata.globalSafetyInstructions || metadata.globalSafetyInstructions.length === 0) return [];
    return metadata.globalSafetyInstructions;
  }, [metadata.globalSafetyInstructions]);

  const handleStart = () => {
    console.log("[BriefingStage] Start clicked", {
      code: metadata.code,
      title: metadata.title,
    });
    onStart();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border bg-card/50">
        <h2 className="text-base font-semibold text-foreground">
          {proceduresFR.guide.briefing.title}
        </h2>
      </div>

      <ScrollArea className="flex-1 p-4 sm:p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <Card className="p-5 sm:p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-foreground">
                  {metadata.title || "Procédure sans titre"}
                </h3>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  {metadata.code}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {proceduresFR.guide.briefing.estimatedDuration}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {metadata.estimatedTimeMinutes} min
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Tag className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {proceduresFR.metadata.categoryLabel}
                  </p>
                  <p className="text-sm font-semibold text-foreground capitalize">
                    {metadata.category}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Étapes</p>
                  <p className="text-sm font-semibold text-foreground">
                    {stepCount} étape{stepCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                {proceduresFR.guide.briefing.objectives}
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {metadata.description || "Aucune description disponible."}
              </p>
            </div>

            {safetyItems.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                    {proceduresFR.guide.briefing.safetyInstructions}
                  </p>
                  <ul className="space-y-2">
                    {safetyItems.map((instruction, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-foreground"
                      >
                        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                        {instruction}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

             <div className="flex items-center gap-3 pt-2">
               <Button onClick={handleStart} className="gap-2">
                 <Play className="h-4 w-4" />
                 {proceduresFR.guide.briefing.startButton}
               </Button>
              <Badge
                variant="secondary"
                className={`text-xs ${priorityColors[metadata.priority] || ""}`}
              >
                {metadata.priority}
              </Badge>
            </div>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
