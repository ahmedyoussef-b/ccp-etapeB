"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Copy, Trash2, Paperclip, X, Clock } from "lucide-react";
import { proceduresFR } from "@/lib/i18n/procedures";
import { TStep } from "@/lib/procedures/services/validator.service";
import { MediaCaptureField } from "@/components/procedures/forms/MediaCaptureField";
import { AlarmDisplay } from "@/components/procedures/shared/AlarmDisplay";

function restrictToVerticalAxis({
  transform,
}: {
  transform: { x: number; y: number; scaleX: number; scaleY: number };
}) {
  return {
    ...transform,
    x: 0,
  };
}

interface StepEditorProps {
  step: TStep;
  allSteps: TStep[];
  onUpdate: (stepId: string, updates: Partial<TStep>) => void;
  onDelete: (stepId: string) => void;
  onDuplicate: (stepId: string) => void;
}

function SortableStepContent({
  step,
  allSteps,
  onUpdate,
  onDelete,
  onDuplicate,
}: {
  step: TStep;
  allSteps: TStep[];
  onUpdate: (stepId: string, updates: Partial<TStep>) => void;
  onDelete: (stepId: string) => void;
  onDuplicate: (stepId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const otherSteps = allSteps.filter((s) => s.id !== step.id);

  return (
    <Card ref={setNodeRef} style={style} className="transition-shadow hover:shadow-md">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="mt-1 cursor-grab rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title={proceduresFR.steps.dragHandle}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">#{step.order + 1}</span>
              <Input
                placeholder="Titre de l'étape"
                value={step.title}
                onChange={(e) => onUpdate(step.id, { title: e.target.value })}
                className="font-medium"
              />
            </div>

            <Input
              placeholder="Sous-titre (optionnel)"
              value={step.subtitle || ""}
              onChange={(e) => onUpdate(step.id, { subtitle: e.target.value })}
            />

            <Textarea
              placeholder="Instructions détaillées pour l'opérateur..."
              value={step.instructions}
              onChange={(e) => onUpdate(step.id, { instructions: e.target.value })}
              rows={3}
            />

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">
                  {proceduresFR.steps.typeLabel}
                </Label>
                <Select
                  value={step.type}
                  onValueChange={(v) => onUpdate(step.id, { type: v as TStep["type"] })}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consigne_simple">
                      {proceduresFR.steps.typeConsigneSimple}
                    </SelectItem>
                    <SelectItem value="saisie_donnees">
                      {proceduresFR.steps.typeSaisieDonnees}
                    </SelectItem>
                    <SelectItem value="inspection_visuelle">
                      {proceduresFR.steps.typeInspectionVisuelle}
                    </SelectItem>
                    <SelectItem value="validation_securite">
                      {proceduresFR.steps.typeValidationSecurite}
                    </SelectItem>
                    <SelectItem value="mesure_numerique">
                      {proceduresFR.steps.typeMesureNumerique}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1.5">
                <Checkbox
                  id={`mandatory-${step.id}`}
                  checked={step.isMandatory}
                  onCheckedChange={(checked) => onUpdate(step.id, { isMandatory: checked as boolean })}
                />
                <Label htmlFor={`mandatory-${step.id}`} className="text-xs cursor-pointer">
                  {proceduresFR.steps.mandatoryLabel}
                </Label>
              </div>

              <div className="flex items-center gap-1.5">
                <Checkbox
                  id={`timer-${step.id}`}
                  checked={step.timerEnabled}
                  onCheckedChange={(checked) => onUpdate(step.id, { timerEnabled: checked as boolean })}
                />
                <Label htmlFor={`timer-${step.id}`} className="text-xs cursor-pointer flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {proceduresFR.steps.timerEnable}
                </Label>
              </div>

              {step.timerEnabled && (
                <div className="flex items-center gap-2">
                  <Input
                    id={`timer-seconds-${step.id}`}
                    type="number"
                    min={0}
                    placeholder={proceduresFR.steps.timerSecondsPlaceholder}
                    value={step.timerSeconds}
                    onChange={(e) => onUpdate(step.id, { timerSeconds: Number(e.target.value) })}
                    className="h-7 w-24 text-xs"
                  />
                  {step.timerSeconds > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {Math.floor(step.timerSeconds / 60)}:{(step.timerSeconds % 60).toString().padStart(2, '0')}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4 pt-2 border-t border-border">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {proceduresFR.steps.dependenciesLabel}
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {otherSteps.map((other) => {
                    const selected = step.dependencies.includes(other.id);
                    return (
                      <Badge
                        key={other.id}
                        variant={selected ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() => {
                          const next = selected
                            ? step.dependencies.filter((d) => d !== other.id)
                            : [...step.dependencies, other.id];
                          onUpdate(step.id, { dependencies: next });
                        }}
                      >
                        {other.title || `Étape ${other.order + 1}`}
                      </Badge>
                    );
                  })}
                  {otherSteps.length === 0 && (
                    <span className="text-xs text-muted-foreground">
                      Aucune autre étape disponible
                    </span>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {proceduresFR.media.title}
                </Label>
                <MediaCaptureField
                  value={step.mediaRequirements}
                  onChange={(media) => onUpdate(step.id, { mediaRequirements: media })}
                />
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {proceduresFR.alarms.title}
                </Label>
                <AlarmDisplay
                  value={step.alarms}
                  onChange={(alarms) => onUpdate(step.id, { alarms })}
                />
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {proceduresFR.steps.attachmentsLabel}
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ajouter un fichier..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.currentTarget.value.trim()) {
                        const next = [...step.attachments, e.currentTarget.value.trim()];
                        onUpdate(step.id, { attachments: next });
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {step.attachments.map((att, i) => (
                    <Badge key={i} variant="secondary" className="text-xs gap-1">
                      <Paperclip className="h-3 w-3" />
                      {att}
                      <button
                        type="button"
                        className="ml-0.5"
                        onClick={() => {
                          const next = step.attachments.filter((_, idx) => idx !== i);
                          onUpdate(step.id, { attachments: next });
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title={proceduresFR.steps.dragHandle}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title={proceduresFR.steps.duplicateStep}
              onClick={() => onDuplicate(step.id)}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              title={proceduresFR.steps.deleteStep}
              onClick={() => onDelete(step.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function StepEditor({
  step,
  allSteps,
  onUpdate,
  onDelete,
  onDuplicate,
}: StepEditorProps) {
  return (
    <SortableStepContent
      step={step}
      allSteps={allSteps}
      onUpdate={onUpdate}
      onDelete={onDelete}
      onDuplicate={onDuplicate}
    />
  );
}

export function StepDndWrapper({
  steps,
  onDragEnd,
  children,
}: {
  steps: TStep[];
  onDragEnd: (fromIndex: number, toIndex: number) => void;
  children: React.ReactNode;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (over && active.id !== over.id) {
      const fromIndex = steps.findIndex((s) => s.id === active.id);
      const toIndex = steps.findIndex((s) => s.id === over.id);
      if (fromIndex >= 0 && toIndex >= 0) {
        onDragEnd(fromIndex, toIndex);
      }
    }
  };

  const activeStep = steps.find((s) => s.id === activeId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis]}
    >
      <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
      <DragOverlay>
        {activeStep ? (
          <Card className="shadow-lg opacity-80">
            <CardContent className="p-4">
              <p className="text-sm font-medium">{activeStep.title || `Étape ${activeStep.order + 1}`}</p>
            </CardContent>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
