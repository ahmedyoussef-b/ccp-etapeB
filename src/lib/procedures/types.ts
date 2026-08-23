export interface ProcedurePrerequisite {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
}

export type GuidePhase = "briefing" | "prerequisites" | "executing" | "completed" | "aborted";

export interface AssistantAdvice {
  stepId: string;
  phase: GuidePhase;
  message: string;
  timestamp: number;
}

export interface ProcedureExecutionContext {
  currentStepIndex: number;
  completedSteps: Set<string>;
  startedAt: number;
  finishedAt?: number;
  anomalies: string[];
}
