import { z } from "zod";

export const PrioritySchema = z.enum(["basse", "moyenne", "haute", "critique"]);
export const StepTypeSchema = z.enum([
  "consigne_simple",
  "saisie_donnees",
  "inspection_visuelle",
  "validation_securite",
  "mesure_numerique",
]);
export const MediaTypeSchema = z.enum(["photo", "video", "audio", "signature"]);
export const AlarmTypeSchema = z.enum(["DANGER", "WARNING", "INFO", "SECURITY_CHECK"]);

export const MediaRequirementSchema = z.object({
  type: MediaTypeSchema,
  mandatory: z.boolean().default(false),
  options: z
    .object({
      geolocation: z.boolean().default(false),
      timestamp: z.boolean().default(false),
    })
    .optional(),
  capturedUrl: z.string().optional(),
});

export const AlarmConfigSchema = z.object({
  condition: z.string().min(1, "La condition est requise"),
  threshold: z.string().optional(),
  type: AlarmTypeSchema,
  message: z.string().min(1, "Le message d'alerte est requis"),
});

export const StepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, "Le titre de l'étape est requis"),
  subtitle: z.string().optional(),
  instructions: z.string().min(1, "Les instructions sont requises"),
  type: StepTypeSchema,
  isMandatory: z.boolean().default(false),
  dependencies: z.array(z.string()).default([]),
  mediaRequirements: z.array(MediaRequirementSchema).default([]),
  alarms: z.array(AlarmConfigSchema).default([]),
  attachments: z.array(z.string()).default([]),
  order: z.number().min(0),
  timerEnabled: z.boolean().default(false),
  timerSeconds: z.number().min(0).default(0),
});

export const MetadataSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  code: z.string().min(1, "Le code/référence est requis"),
  description: z.string().optional(),
  category: z.string().min(1, "La catégorie est requise"),
  priority: PrioritySchema,
  estimatedTimeMinutes: z.number().min(1, "La durée estimée doit être supérieure à 0"),
  requiredRoles: z.array(z.string()),
  globalSafetyInstructions: z.array(z.string()),
  version: z.string().default("1.0").optional(),
});

export const ProcedureSchema = z.object({
  metadata: MetadataSchema,
  steps: z.array(StepSchema).min(1, "Au moins une étape est requise"),
});

export type TMetadata = z.infer<typeof MetadataSchema>;
export type TStep = z.infer<typeof StepSchema>;
export type TMediaRequirement = z.infer<typeof MediaRequirementSchema>;
export type TAlarmConfig = z.infer<typeof AlarmConfigSchema>;
export type TProcedure = z.infer<typeof ProcedureSchema>;

export function validateProcedure(data: unknown): TProcedure {
  return ProcedureSchema.parse(data);
}

export function validateStep(data: unknown): TStep {
  return StepSchema.parse(data);
}

export function hasCircularDependencies(steps: TStep[]): boolean {
  const adj = new Map<string, string[]>();
  for (const step of steps) {
    adj.set(step.id, step.dependencies);
  }

  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(node: string): boolean {
    visited.add(node);
    recStack.add(node);
    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        return true;
      }
    }
    recStack.delete(node);
    return false;
  }

  for (const step of steps) {
    if (!visited.has(step.id)) {
      if (dfs(step.id)) return true;
    }
  }
  return false;
}

export function getCompleteness(steps: TStep[]): number {
  if (steps.length === 0) return 0;
  const filled = steps.filter(
    (s) => s.title.trim() !== "" && s.instructions.trim() !== "" && Boolean(s.type)
  );
  return Math.round((filled.length / steps.length) * 100);
}
