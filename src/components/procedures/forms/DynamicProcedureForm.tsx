"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Plus, Save, Download, RotateCcw, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { proceduresFR } from "@/lib/i18n/procedures";
import {
  createEmptyProcedure,
  addStep,
  removeStep,
  duplicateStep,
  reorderSteps,
  updateStep,
  updateMetadata,
  saveProcedure,
  downloadJson,
  getProcedures,
} from "@/lib/procedures/services/procedure-manager.service";
import {
  hasCircularDependencies,
  getCompleteness,
  validateProcedure,
  TProcedure,
  TStep,
} from "@/lib/procedures/services/validator.service";
import { MetadataEditor } from "@/components/procedures/forms/MetadataEditor";
import { StepEditor, StepDndWrapper } from "@/components/procedures/forms/StepEditor";
import { ProcedureTimeline } from "@/components/procedures/visualization/ProcedureTimeline";

export function DynamicProcedureForm() {
  const [procedure, setProcedure] = useState<TProcedure>(createEmptyProcedure);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const existing = getProcedures();
    if (existing.length > 0) {
      setProcedure(existing[existing.length - 1]);
    }
  }, []);

  const handleMetadataChange = useCallback((metadata: TProcedure["metadata"]) => {
    setProcedure((prev) => updateMetadata(prev, metadata));
  }, []);

  const handleAddStep = useCallback(() => {
    setProcedure((prev) => addStep(prev));
    toast.success("Étape ajoutée");
  }, []);

  const handleDeleteStep = useCallback((stepId: string) => {
    setProcedure((prev) => removeStep(prev, stepId));
    if (activeStepId === stepId) {
      setActiveStepId(null);
    }
    toast.success("Étape supprimée");
  }, [activeStepId]);

  const handleDuplicateStep = useCallback((stepId: string) => {
    setProcedure((prev) => duplicateStep(prev, stepId));
    toast.success("Étape dupliquée");
  }, []);

  const handleUpdateStep = useCallback(
    (stepId: string, updates: Partial<TStep>) => {
      setProcedure((prev) => updateStep(prev, stepId, updates));
    },
    []
  );

  const handleReorderSteps = useCallback((fromIndex: number, toIndex: number) => {
    setProcedure((prev) => reorderSteps(prev, fromIndex, toIndex));
  }, []);

  const handleStepClick = useCallback((stepId: string) => {
    setActiveStepId(stepId);
  }, []);

  const handleSaveDraft = useCallback(async () => {
    setIsSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 400));
      saveProcedure(procedure);
      toast.success(proceduresFR.actions.successSaved);
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  }, [procedure]);

  const handleExportJson = useCallback(async () => {
    setIsExporting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 400));
      const validated = validateProcedure(procedure);
      downloadJson(validated);
      toast.success(proceduresFR.actions.successExported);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : proceduresFR.actions.errorStepTitleRequired);
    } finally {
      setIsExporting(false);
    }
  }, [procedure]);

  const handleReset = useCallback(() => {
    setProcedure(createEmptyProcedure());
    setActiveStepId(null);
    setErrors([]);
    setFormKey((k) => k + 1);
    toast.success("Formulaire réinitialisé");
  }, []);

  const handleImportJson = useCallback(async () => {
    const input = fileInputRef.current;
    if (!input || !input.files?.length) return;
    const file = input.files[0];
    setIsImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const validated = validateProcedure(parsed);
      setProcedure(validated);
      setActiveStepId(null);
      setErrors([]);
      setFormKey((k) => k + 1);
      toast.success(proceduresFR.actions.successImported);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "JSON invalide");
    } finally {
      setIsImporting(false);
      if (input) input.value = "";
    }
  }, []);

  const validate = useCallback(() => {
    const errs: string[] = [];

    if (!procedure.metadata.title.trim()) {
      errs.push(proceduresFR.actions.errorTitleRequired);
    }

    if (procedure.steps.length === 0) {
      errs.push(proceduresFR.actions.errorMinSteps);
    }

    for (const step of procedure.steps) {
      if (!step.title.trim()) {
        errs.push(proceduresFR.actions.errorStepTitleRequired);
        break;
      }
    }

    if (hasCircularDependencies(procedure.steps)) {
      errs.push(proceduresFR.actions.errorCircularDeps);
    }

    setErrors(errs);
    return errs.length === 0;
  }, [procedure]);

  const handleValidateAndExport = useCallback(() => {
    if (validate()) {
      handleExportJson();
    } else {
      toast.error("Corrigez les erreurs avant d'exporter");
    }
  }, [validate, handleExportJson]);

  const completeness = getCompleteness(procedure.steps);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            {proceduresFR.metadata.title}
          </h2>
          <Badge variant="secondary" className="text-xs">
            {proceduresFR.actions.completeness}: {completeness}%
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImportJson}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSaving || isExporting || isImporting}
            className="gap-1.5"
          >
            {isImporting ? <Skeleton className="h-3.5 w-3.5 rounded-full" /> : <Upload className="h-3.5 w-3.5" />}
            {isImporting ? "Import..." : proceduresFR.actions.importJson}
          </Button>
          <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={isSaving || isExporting || isImporting} className="gap-1.5">
            {isSaving ? <Skeleton className="h-3.5 w-3.5 rounded-full" /> : <Save className="h-3.5 w-3.5" />}
            {isSaving ? "Sauvegarde..." : proceduresFR.actions.saveDraft}
          </Button>
          <Button size="sm" onClick={handleValidateAndExport} disabled={isSaving || isExporting || isImporting} className="gap-1.5">
            {isExporting ? <Skeleton className="h-3.5 w-3.5 rounded-full" /> : <Download className="h-3.5 w-3.5" />}
            {isExporting ? "Export..." : proceduresFR.actions.validateExport}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset} disabled={isSaving || isExporting || isImporting} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            {proceduresFR.actions.reset}
          </Button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="mx-4 mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
          {errors.map((err, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {err}
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <MetadataEditor key={formKey} data={procedure.metadata} onChange={handleMetadataChange} />

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">
                {proceduresFR.steps.title}
              </h3>
              <Button size="sm" onClick={handleAddStep} disabled={isSaving || isExporting} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                {proceduresFR.steps.addStep}
              </Button>
            </div>

            {procedure.steps.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">{proceduresFR.steps.noSteps}</p>
              </div>
            ) : (
              <StepDndWrapper steps={procedure.steps} onDragEnd={handleReorderSteps}>
                <div className="space-y-3">
                  {procedure.steps.map((step) => (
                    <StepEditor
                      key={step.id}
                      step={step}
                      allSteps={procedure.steps}
                      onUpdate={handleUpdateStep}
                      onDelete={handleDeleteStep}
                      onDuplicate={handleDuplicateStep}
                    />
                  ))}
                </div>
              </StepDndWrapper>
            )}
          </div>
        </div>

        <div className="lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-border bg-muted/20 flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {proceduresFR.timeline.title}
            </h3>
          </div>
          <div className="flex-1 overflow-hidden p-4">
            <ProcedureTimeline
              steps={procedure.steps}
              onStepClick={handleStepClick}
              activeStepId={activeStepId || undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}