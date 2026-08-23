"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TProcedure } from "@/lib/procedures/services/validator.service";
import { ProcedureExecutor } from "./ProcedureExecutor";
import { X } from "lucide-react";

interface ProcedureGuideProps {
  procedure: TProcedure;
  onClose: () => void;
}

export function ProcedureGuide({ procedure, onClose }: ProcedureGuideProps) {
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
              {procedure.metadata.code}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="text-xs">
            Guide IA
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ProcedureExecutor procedure={procedure} onClose={onClose} />
      </div>
    </div>
  );
}
