"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TProcedure } from "@/lib/procedures/services/validator.service";
import { ProcedureExecutionContext } from "@/lib/procedures/types";
import { proceduresFR } from "@/lib/i18n/procedures";
import { AlertTriangle, XCircle, Clock, FileText } from "lucide-react";

interface AbortedStageProps {
  procedure: TProcedure;
  context: ProcedureExecutionContext;
  reason: string;
  onClose: () => void;
}

export function AbortedStage({ procedure, context, reason, onClose }: AbortedStageProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border bg-card/50">
        <h2 className="text-base font-semibold text-foreground">
          {proceduresFR.guide.aborted.title}
        </h2>
      </div>

      <ScrollArea className="flex-1 p-4 sm:p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <Card className="p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {procedure.metadata.title || "Procédure sans titre"}
                </h3>
                <p className="text-xs text-muted-foreground font-mono">
                  {procedure.metadata.code}
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {proceduresFR.guide.aborted.reason}
                  </p>
                  <p className="text-sm text-foreground">{reason}</p>
                </div>
              </div>

              {context.anomalies.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Anomalies enregistrées :
                  </p>
                  <ul className="space-y-1">
                    {context.anomalies.map((anomaly, i) => (
                      <li key={i} className="text-sm text-foreground">
                        - {anomaly}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Separator />

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Démarrée à : {new Date(context.startedAt).toLocaleTimeString()}
              </span>
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {context.completedSteps.size} / {procedure.steps.length} étapes
              </span>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={onClose} variant="outline" className="gap-1.5">
                {proceduresFR.guide.aborted.closeButton}
              </Button>
            </div>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
