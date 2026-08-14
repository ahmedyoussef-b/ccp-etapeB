"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, AlertTriangle, Tag } from "lucide-react";
import { proceduresFR } from "@/lib/i18n/procedures";
import { MetadataSchema, TMetadata } from "@/lib/procedures/services/validator.service";

interface MetadataEditorProps {
  data: TMetadata;
  onChange: (data: TMetadata) => void;
}

export function MetadataEditor({ data, onChange }: MetadataEditorProps) {
  const form = useForm({
    resolver: zodResolver(MetadataSchema),
    defaultValues: data,
    mode: "onChange",
  });

  const { control, watch, setValue, formState } = form;
  const values = watch();

  useEffect(() => {
    const subscription = form.watch((value) => {
      onChange(value as TMetadata);
    });
    return () => subscription.unsubscribe();
  }, [form, onChange]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
      }}
      className="space-y-5"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="title" className="text-sm font-medium text-foreground">
            {proceduresFR.metadata.titleLabel}
          </Label>
          <Controller
            name="title"
            control={control}
            render={({ field }) => (
              <Input id="title" placeholder={proceduresFR.metadata.titlePlaceholder} {...field} />
            )}
          />
          {formState.errors.title && (
            <p className="text-xs text-destructive">{formState.errors.title.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="code" className="text-sm font-medium text-foreground">
            {proceduresFR.metadata.codeLabel}
          </Label>
          <Controller
            name="code"
            control={control}
            render={({ field }) => (
              <Input id="code" placeholder={proceduresFR.metadata.codePlaceholder} {...field} />
            )}
          />
          {formState.errors.code && (
            <p className="text-xs text-destructive">{formState.errors.code.message}</p>
          )}
        </div>
      </div>

        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-sm font-medium text-foreground">
            {proceduresFR.metadata.descriptionLabel}
          </Label>
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <Textarea id="description" rows={4} placeholder={proceduresFR.metadata.descriptionPlaceholder + " (markdown léger supporté)"} {...field} />
            )}
          />
          {formState.errors.description && (
            <p className="text-xs text-destructive">{formState.errors.description.message}</p>
          )}
        </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="category" className="text-sm font-medium text-foreground">
            {proceduresFR.metadata.categoryLabel}
          </Label>
          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {proceduresFR.categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {formState.errors.category && (
            <p className="text-xs text-destructive">{formState.errors.category.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="priority" className="text-sm font-medium text-foreground">
            {proceduresFR.metadata.priorityLabel}
          </Label>
          <div className="flex items-center gap-2">
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <SelectTrigger id="priority" className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basse">{proceduresFR.metadata.priorityBasse}</SelectItem>
                    <SelectItem value="moyenne">{proceduresFR.metadata.priorityMoyenne}</SelectItem>
                    <SelectItem value="haute">{proceduresFR.metadata.priorityHaute}</SelectItem>
                    <SelectItem value="critique">{proceduresFR.metadata.priorityCritique}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {values.priority && (
              <Badge
                variant="secondary"
                className={
                  values.priority === "critique"
                    ? "bg-destructive/10 text-destructive border-destructive/20"
                    : values.priority === "haute"
                    ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20"
                    : values.priority === "moyenne"
                    ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20"
                    : "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
                }
              >
                {values.priority === "critique"
                  ? "Critique"
                  : values.priority === "haute"
                  ? "Haute"
                  : values.priority === "moyenne"
                  ? "Moyenne"
                  : "Basse"}
              </Badge>
            )}
          </div>
          {formState.errors.priority && (
            <p className="text-xs text-destructive">{formState.errors.priority.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="estimatedTimeMinutes" className="text-sm font-medium text-foreground">
            {proceduresFR.metadata.estimatedTimeLabel}
          </Label>
          <Controller
            name="estimatedTimeMinutes"
            control={control}
            render={({ field }) => (
              <Input
                id="estimatedTimeMinutes"
                type="number"
                min={1}
                placeholder={proceduresFR.metadata.estimatedTimePlaceholder}
                {...field}
                onChange={(e) => field.onChange(Number(e.target.value))}
              />
            )}
          />
          {formState.errors.estimatedTimeMinutes && (
            <p className="text-xs text-destructive">{formState.errors.estimatedTimeMinutes.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground flex items-center gap-2">
          <Tag className="h-4 w-4" />
          {proceduresFR.metadata.requiredRolesLabel}
        </Label>
        <div className="flex flex-wrap gap-2">
          {proceduresFR.roles.map((role) => {
            const selected = (values.requiredRoles || []).includes(role.value);
            return (
              <Badge
                key={role.value}
                variant={selected ? "default" : "outline"}
                className="cursor-pointer select-none"
                onClick={() => {
                  const next = selected
                    ? (values.requiredRoles || []).filter((r: string) => r !== role.value)
                    : [...(values.requiredRoles || []), role.value];
                  setValue("requiredRoles", next, { shouldValidate: true });
                }}
              >
                {role.label}
              </Badge>
            );
          })}
        </div>
        {formState.errors.requiredRoles && (
          <p className="text-xs text-destructive">{formState.errors.requiredRoles.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          {proceduresFR.metadata.safetyInstructionsLabel}
        </Label>
        {values.globalSafetyInstructions && values.globalSafetyInstructions.length > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-xs text-destructive">
              {values.globalSafetyInstructions.length} consigne(s) de sécurité active(s)
            </p>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            placeholder={proceduresFR.metadata.safetyInstructionsPlaceholder}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.currentTarget.value.trim()) {
                e.preventDefault();
                const next = [...(values.globalSafetyInstructions || []), e.currentTarget.value.trim()];
                setValue("globalSafetyInstructions", next, { shouldValidate: true });
                e.currentTarget.value = "";
              }
            }}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {(values.globalSafetyInstructions || []).map((instr: string, i: number) => (
            <Badge key={i} variant="secondary" className="gap-1 border-destructive/20">
              <AlertTriangle className="h-3 w-3 text-destructive" />
              {instr}
              <button
                type="button"
                className="ml-1 rounded-full p-0.5 hover:bg-muted"
                onClick={() => {
                  const next = (values.globalSafetyInstructions || []).filter(
                    (_: string, idx: number) => idx !== i
                  );
                  setValue("globalSafetyInstructions", next, { shouldValidate: true });
                }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        {formState.errors.globalSafetyInstructions && (
          <p className="text-xs text-destructive">{formState.errors.globalSafetyInstructions.message}</p>
        )}
      </div>
    </form>
  );
}
