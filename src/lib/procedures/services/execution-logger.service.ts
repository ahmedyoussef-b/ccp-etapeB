import { executionRepo, memorySteps } from "./execution-repo";

function generateClientExecutionId(): string {
  return `exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export type ExecutionId = string;
export type StepEventPayload = {
  executionId: ExecutionId;
  stepId: string;
  stepOrder: number;
  title: string;
  type: string;
  isMandatory?: boolean;
};

type MediaPayload = {
  executionId: ExecutionId;
  stepId: string;
  type: string;
  url?: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  geolocation?: Record<string, unknown>;
};

let clientExecutionId: ExecutionId | null = null;

export function getOrCreateClientExecutionId(): ExecutionId {
  if (!clientExecutionId) {
    clientExecutionId = generateClientExecutionId();
  }
  return clientExecutionId;
}

export async function logExecutionStart(
  procedureId: number | string,
  userId?: string,
  userRole?: string
): Promise<ExecutionId> {
  const numericProcedureId =
    typeof procedureId === "string" ? parseInt(procedureId, 10) : procedureId;

  const record = await executionRepo.create({
    procedureId: Number.isNaN(numericProcedureId) ? 0 : numericProcedureId,
    userId,
    userRole,
    phase: "briefing",
  });

  return record.id.toString();
}

export async function logStepStart({
  executionId,
  stepId,
  stepOrder,
  title,
  type,
  isMandatory = false,
}: StepEventPayload): Promise<void> {
  const numericExecutionId = parseInt(executionId);
  if (Number.isNaN(numericExecutionId)) return;

  await executionRepo.addStep({
    executionId: numericExecutionId,
    stepId,
    stepOrder,
    title,
    type,
    isMandatory,
    startedAt: new Date(),
  });
}

export async function logStepEnd(
  executionId: string,
  stepId: string,
  isCompleted: boolean,
  anomaly?: string
): Promise<void> {
  const numericExecutionId = parseInt(executionId);
  if (Number.isNaN(numericExecutionId)) return;

  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.executionStep.updateMany({
      where: { executionId: numericExecutionId, stepId },
      data: {
        isCompleted,
        finishedAt: new Date(),
        anomaly,
      },
    });
  } catch {
    const step = memorySteps.find(
      (s: typeof memorySteps[0]) => s.executionId === numericExecutionId && s.stepId === stepId
    );
    if (step) {
      step.isCompleted = isCompleted;
      step.finishedAt = new Date();
      step.anomaly = anomaly ?? null;
    }
  }
}

export async function logMediaCapture(data: MediaPayload): Promise<void> {
  const numericExecutionId = parseInt(data.executionId);
  if (Number.isNaN(numericExecutionId)) return;

  await executionRepo.addMedia({
    executionId: numericExecutionId,
    stepId: data.stepId,
    type: data.type,
    url: data.url,
    filename: data.filename,
    mimeType: data.mimeType,
    size: data.size,
    geolocation: data.geolocation,
  });
}

export async function logExecutionEnd(
  executionId: string,
  phase: "completed" | "aborted",
  anomalies: string[],
  globalElapsed: number
): Promise<void> {
  const numericExecutionId = parseInt(executionId);
  if (Number.isNaN(numericExecutionId)) return;

  await executionRepo.update(numericExecutionId, {
    phase,
    finishedAt: new Date(),
    anomalies,
    globalElapsed,
  });
}
