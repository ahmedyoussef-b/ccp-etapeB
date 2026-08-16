"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Plus,
  Save,
  Download,
  RotateCcw,
  Upload,
  CheckCircle2,
  AlertCircle,
  History,
  GitBranch,
} from "lucide-react";
import { proceduresFR } from "@/lib/i18n/procedures";
import { csrfFetch } from "@/lib/procedures/csrf-fetch";
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
  getVersions,
  restoreVersion,
  getProcedureById,
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
  console.log("[CREER-PROCEDURE] DynamicProcedureForm monté");
  const [procedure, setProcedure] = useState<TProcedure>(createEmptyProcedure);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [approvalStatus, setApprovalStatus] = useState<string>("draft");
  const [approverName, setApproverName] = useState<string>("");
  const [reviewDate, setReviewDate] = useState<string>("");
  const [versionHistory, setVersionHistory] = useState<Array<{ version: string; createdAt: string; comment?: string }>>([]);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState<{ version: string; body: TProcedure; createdAt: string; comment?: string } | null>(null);
  const [versionComment, setVersionComment] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUserRole = typeof window !== "undefined" ? window.sessionStorage.getItem("dashboardRole") || "rondier" : "rondier";
  const currentUserName = typeof window !== "undefined" ? localStorage.getItem("nexaflow_user_name") || "" : "";

  useEffect(() => {
    console.log("[CREER-PROCEDURE] Chargement procédure existante depuis localStorage");
    const existing = getProcedures();
    if (existing.length > 0) {
      const last = existing[existing.length - 1];
      console.log("[CREER-PROCEDURE] Procédure existante trouvée:", last.metadata.code, last.metadata.title);
      setProcedure(last);
    } else {
      console.log("[CREER-PROCEDURE] Aucune procédure existante, formulaire vide");
    }
  }, []);

  useEffect(() => {
    console.log("[CREER-PROCEDURE] Mise à jour historique versions pour code:", procedure.metadata.code || "(vide)");
    if (procedure.metadata.code) {
      const history = getVersions(procedure.metadata.code);
      setVersionHistory(history);
      console.log("[CREER-PROCEDURE] Historique chargé:", history.length, "versions");
    }
  }, [procedure.metadata.code]);

  const handleMetadataChange = useCallback((metadata: TProcedure["metadata"]) => {
    console.log("[CREER-PROCEDURE] Métadonnées modifiées:", metadata);
    setProcedure((prev) => updateMetadata(prev, metadata));
  }, []);

  const handleAddStep = useCallback(() => {
    console.log("[CREER-PROCEDURE] Ajout d'une étape. Total actuel:", procedure.steps.length);
    setProcedure((prev) => addStep(prev));
    toast.success("Étape ajoutée");
  }, [procedure.steps.length]);

  const handleDeleteStep = useCallback((stepId: string) => {
    console.log("[CREER-PROCEDURE] Suppression étape:", stepId, "Active step:", activeStepId);
    setProcedure((prev) => removeStep(prev, stepId));
    if (activeStepId === stepId) {
      setActiveStepId(null);
    }
    toast.success("Étape supprimée");
  }, [activeStepId]);

  const handleDuplicateStep = useCallback((stepId: string) => {
    console.log("[CREER-PROCEDURE] Duplication étape:", stepId);
    setProcedure((prev) => duplicateStep(prev, stepId));
    toast.success("Étape dupliquée");
  }, []);

  const handleUpdateStep = useCallback(
    (stepId: string, updates: Partial<TStep>) => {
      console.log("[CREER-PROCEDURE] Mise à jour étape:", stepId, "updates:", updates);
      setProcedure((prev) => updateStep(prev, stepId, updates));
    },
    []
  );

  const handleReorderSteps = useCallback((fromIndex: number, toIndex: number) => {
    console.log("[CREER-PROCEDURE] Réordonnancement étapes:", fromIndex, "->", toIndex);
    setProcedure((prev) => reorderSteps(prev, fromIndex, toIndex));
  }, []);

  const handleStepClick = useCallback((stepId: string) => {
    console.log("[CREER-PROCEDURE] Clic sur étape timeline:", stepId);
    setActiveStepId(stepId);
  }, []);

  const handleSaveDraft = useCallback(async () => {
    console.log("[CREER-PROCEDURE] Sauvegarde brouillon demandée. Code:", procedure.metadata.code, "| Étapes:", procedure.steps.length);
    setIsSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 400));
      saveProcedure(procedure);
      const updated = getProcedureById(procedure.metadata.code);
      if (updated) {
        console.log("[CREER-PROCEDURE] Brouillon sauvegardé avec succès. Code:", updated.metadata.code);
        setProcedure(updated);
      }
      const updatedHistory = getVersions(procedure.metadata.code);
      setVersionHistory(updatedHistory);
      toast.success(proceduresFR.actions.successSaved);
    } catch (e) {
      console.error("[CREER-PROCEDURE] Erreur sauvegarde:", e);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  }, [procedure]);

  const handleExportJson = useCallback(async () => {
    console.log("[CREER-PROCEDURE] Export JSON demandé. Code:", procedure.metadata.code);
    setIsExporting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 400));
      const validated = validateProcedure(procedure);
      console.log("[CREER-PROCEDURE] Validation OK. Export JSON:", validated.metadata.code);
      downloadJson(validated);
      toast.success(proceduresFR.actions.successExported);
    } catch (e) {
      console.error("[CREER-PROCEDURE] Erreur export:", e);
      toast.error(e instanceof Error ? e.message : proceduresFR.actions.errorStepTitleRequired);
    } finally {
      setIsExporting(false);
    }
  }, [procedure]);

  const handleReset = useCallback(() => {
    console.log("[CREER-PROCEDURE] Réinitialisation formulaire");
    setProcedure(createEmptyProcedure());
    setActiveStepId(null);
    setErrors([]);
    setFormKey((k) => k + 1);
    setApprovalStatus("draft");
    setApproverName("");
    setReviewDate("");
    toast.success("Formulaire réinitialisé");
  }, []);

  const handleImportJson = useCallback(async () => {
    const input = fileInputRef.current;
    if (!input || !input.files?.length) {
      console.log("[CREER-PROCEDURE] Import JSON: aucun fichier sélectionné");
      return;
    }
    const file = input.files[0];
    console.log("[CREER-PROCEDURE] Import JSON fichier:", file.name, "| Taille:", file.size, "bytes");
    setIsImporting(true);
    try {
      const text = await file.text();
      console.log("[CREER-PROCEDURE] Import JSON contenu lu, longueur:", text.length, "caractères");
      const parsed = JSON.parse(text);
      console.log("[CREER-PROCEDURE] Import JSON parsing OK. Code:", parsed.metadata?.code);
      const validated = validateProcedure(parsed);
      console.log("[CREER-PROCEDURE] Import JSON validation OK. Code:", validated.metadata.code, "| Étapes:", validated.steps.length);
      setProcedure(validated);
      setActiveStepId(null);
      setErrors([]);
      setFormKey((k) => k + 1);
      setApprovalStatus("draft");
      setApproverName("");
      setReviewDate("");
      toast.success(proceduresFR.actions.successImported);
    } catch (e) {
      console.error("[CREER-PROCEDURE] Erreur import JSON:", e);
      toast.error(e instanceof Error ? e.message : "JSON invalide");
    } finally {
      setIsImporting(false);
      if (input) input.value = "";
    }
  }, []);

  const handleCreateVersion = useCallback(async () => {
    console.log("[CREER-PROCEDURE] Création version demandée. Code:", procedure.metadata.code, "| Version:", procedure.metadata.version);
    if (!procedure.metadata.code) {
      console.warn("[CREER-PROCEDURE] Création version bloquée: pas de code procédure");
      toast.error("Enregistrez d'abord la procédure");
      return;
    }
    try {
      const res = await csrfFetch("/api/procedures/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: procedure.metadata.code,
          comment: versionComment || `Version ${procedure.metadata.version}`,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("[CREER-PROCEDURE] Création version échouée:", res.status, text);
        throw new Error("Création de version échouée");
      }
      const data = await res.json();
      console.log("[CREER-PROCEDURE] Version créée:", data.version);
      toast.success(proceduresFR.versioning.versionCreated.replace("{version}", data.version));
      setVersionComment("");
      setIsCreatingVersion(false);
      const updatedHistory = getVersions(procedure.metadata.code);
      setVersionHistory(updatedHistory);
      setProcedure((prev) => ({
        ...prev,
        metadata: { ...prev.metadata, version: data.version },
      }));
    } catch (e) {
      console.error("[CREER-PROCEDURE] Erreur création version:", e);
      toast.error("Erreur lors de la création de version");
    }
  }, [procedure.metadata.code, procedure.metadata.version, versionComment]);

  const handleRestoreVersion = useCallback(async (version: string) => {
    console.log("[CREER-PROCEDURE] Restauration version demandée:", version, "| Code:", procedure.metadata.code);
    if (!procedure.metadata.code) return;
    const restored = restoreVersion(procedure.metadata.code, version);
    if (restored) {
      console.log("[CREER-PROCEDURE] Version restaurée:", version);
      setProcedure(restored);
      setPreviewVersion(null);
      setSelectedVersion(null);
      toast.success(proceduresFR.versioning.restored.replace("{version}", version));
    } else {
      console.warn("[CREER-PROCEDURE] Restauration version impossible:", version);
      toast.error("Impossible de restaurer cette version");
    }
  }, [procedure.metadata.code]);

  const handleVersionSelect = useCallback((version: string) => {
    console.log("[CREER-PROCEDURE] Sélection version:", version);
    setSelectedVersion(version);
    const history = getVersions(procedure.metadata.code);
    const found = history.find((v) => v.version === version);
    if (found) {
      console.log("[CREER-PROCEDURE] Aperçu version:", version, "| Commentaire:", found.comment);
      setPreviewVersion(found);
    } else {
      console.warn("[CREER-PROCEDURE] Version non trouvée dans historique:", version);
    }
  }, [procedure.metadata.code]);

  const validate = useCallback(() => {
    console.log("[CREER-PROCEDURE] Validation demandée. Code:", procedure.metadata.code, "| Étapes:", procedure.steps.length);
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
    console.log("[CREER-PROCEDURE] Validation terminée. Erreurs:", errs.length, errs);
    return errs.length === 0;
  }, [procedure]);

  const handleValidateAndExport = useCallback(() => {
    console.log("[CREER-PROCEDURE] Valider & Exporter demandé");
    if (validate()) {
      handleExportJson();
    } else {
      console.warn("[CREER-PROCEDURE] Validation échouée, export bloqué");
      toast.error("Corrigez les erreurs avant d'exporter");
    }
  }, [validate, handleExportJson]);

  const handleApprovalAction = useCallback(async (action: "submit" | "approve" | "reject", comment?: string) => {
    console.log("[CREER-PROCEDURE] Action approbation demandée:", action, "| Code:", procedure.metadata.code, "| Rôle:", currentUserRole);
    if (!procedure.metadata.code) {
      console.warn("[CREER-PROCEDURE] Action approbation bloquée: pas de code procédure");
      toast.error("Enregistrez d'abord la procédure");
      return;
    }
    try {
      const res = await csrfFetch("/api/procedures/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: procedure.metadata.code,
          action,
          approverId: currentUserRole,
          approverName: currentUserName || currentUserRole,
          approverRole: currentUserRole,
          comment,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("[CREER-PROCEDURE] Action approbation échouée:", res.status, text);
        throw new Error("Action d'approbation échouée");
      }
      const data = await res.json();
      const newStatus = data.status || (action === "submit" ? "submitted" : action === "approve" ? "approved" : "rejected");
      console.log("[CREER-PROCEDURE] Action approbation réussie:", action, "=>", newStatus);
      setApprovalStatus(newStatus);
      if (action === "approve") {
        setApproverName(currentUserName || currentUserRole);
        setReviewDate(new Date().toISOString());
      }
      toast.success("Action d'approbation enregistrée");
    } catch (e) {
      console.error("[CREER-PROCEDURE] Erreur action approbation:", e);
      toast.error("Erreur lors de l'action d'approbation");
    }
  }, [procedure.metadata.code, currentUserRole, currentUserName]);

  const completeness = getCompleteness(procedure.steps);
  console.log("[CREER-PROCEDURE] Complétude calculée:", completeness, "% | Code:", procedure.metadata.code);

  console.log("[CREER-PROCEDURE] Rendu du formulaire. Code:", procedure.metadata.code, "| Étapes:", procedure.steps.length);
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            {proceduresFR.metadata.title}
          </h2>
          <Badge variant="secondary" className="text-xs font-mono">
            v{procedure.metadata.version || "1.0"}
          </Badge>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCreatingVersion(true)}
            disabled={isSaving || isExporting || isImporting || !procedure.metadata.code}
            className="gap-1.5"
          >
            <GitBranch className="h-3.5 w-3.5" />
            {proceduresFR.versioning.createVersion}
          </Button>
            <Select
              value={selectedVersion || ""}
              onValueChange={(value) => {
                const v = value as string;
                if (v && v !== "none") {
                  handleVersionSelect(v);
                }
              }}
            >
              <SelectTrigger className="h-9 w-[140px] gap-1.5 text-xs">
                <History className="h-3.5 w-3.5" />
                <SelectValue placeholder={proceduresFR.versioning.versionHistory} />
              </SelectTrigger>
              <SelectContent>
                {versionHistory.length === 0 ? (
                  <SelectItem value="none" disabled>
                    {proceduresFR.versioning.noHistory}
                  </SelectItem>
                ) : (
                  versionHistory.map((v) => (
                    <SelectItem key={v.version} value={v.version}>
                      v{v.version} {v.comment ? `- ${v.comment}` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
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
          {(() => { console.log("[CREER-PROCEDURE] Rendu MetadataEditor. Code:", procedure.metadata.code); return null; })()}
          <MetadataEditor
            key={formKey}
            data={procedure.metadata}
            onChange={handleMetadataChange}
            approvalStatus={approvalStatus}
            approverName={approverName}
            reviewDate={reviewDate}
            onApprovalAction={handleApprovalAction}
            currentUserRole={currentUserRole}
          />

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
            {(() => { console.log("[CREER-PROCEDURE] Rendu ProcedureTimeline. Étapes:", procedure.steps.length); return null; })()}
            <ProcedureTimeline
              steps={procedure.steps}
              onStepClick={handleStepClick}
              activeStepId={activeStepId || undefined}
            />
          </div>
        </div>
      </div>

      <Dialog open={isCreatingVersion} onOpenChange={setIsCreatingVersion}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{proceduresFR.versioning.createVersion}</DialogTitle>
            <DialogDescription>
              {proceduresFR.versioning.versionCommentPlaceholder}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Version actuelle : <span className="font-mono font-semibold">v{procedure.metadata.version || "1.0"}</span>
            </div>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={3}
              placeholder={proceduresFR.versioning.versionCommentPlaceholder}
              value={versionComment}
              onChange={(e) => setVersionComment(e.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose>
              <Button variant="outline">{proceduresFR.versioning.close}</Button>
            </DialogClose>
            <Button onClick={handleCreateVersion}>
              {proceduresFR.versioning.createVersion}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewVersion} onOpenChange={(open) => !open && setPreviewVersion(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {proceduresFR.versioning.preview} v{previewVersion?.version}
            </DialogTitle>
            {previewVersion?.comment && (
              <DialogDescription>{previewVersion.comment}</DialogDescription>
            )}
          </DialogHeader>
          <ScrollArea className="h-[50vh] rounded-md border p-4">
            {previewVersion && (
              <div className="space-y-4 text-sm">
                <div>
                  <span className="font-semibold">Titre: </span>
                  {previewVersion.body.metadata.title || <span className="text-muted-foreground">(vide)</span>}
                </div>
                <div>
                  <span className="font-semibold">Code: </span>
                  {previewVersion.body.metadata.code}
                </div>
                <div>
                  <span className="font-semibold">Description: </span>
                  {previewVersion.body.metadata.description || <span className="text-muted-foreground">(vide)</span>}
                </div>
                <Separator />
                <div>
                  <span className="font-semibold">Étapes: </span>
                  {previewVersion.body.steps.length}
                </div>
                <div className="space-y-2">
                  {previewVersion.body.steps.map((step, idx) => (
                    <div key={step.id} className="rounded-md border p-3">
                      <div className="font-medium">
                        {idx + 1}. {step.title || <span className="text-muted-foreground">(sans titre)</span>}
                      </div>
                      <div className="text-muted-foreground mt-1 line-clamp-2">
                        {step.instructions || "(aucune instruction)"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <DialogClose>
              <Button variant="outline">{proceduresFR.versioning.close}</Button>
            </DialogClose>
            {previewVersion && (
              <Button
                variant="destructive"
                onClick={() => handleRestoreVersion(previewVersion.version)}
              >
                {proceduresFR.versioning.restoreVersion}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
