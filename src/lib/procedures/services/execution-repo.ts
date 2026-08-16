import type {
  ProcedureExecution,
  ExecutionStep,
  ExecutionMedia,
} from "@prisma/client";

interface ExecutionRecord extends ProcedureExecution {
  steps: ExecutionStep[];
  media: ExecutionMedia[];
}

const MAX_MEMORY_RECORDS = 100;
const MAX_MEMORY_STEPS = 500;
const MAX_MEMORY_MEDIA = 1000;

const memoryStore: ExecutionRecord[] = [];
export const memorySteps: ExecutionStep[] = [];
export const memoryMedia: ExecutionMedia[] = [];

function pruneMemory<T>(store: T[], max: number): void {
  while (store.length > max) {
    store.shift();
  }
}

function generateClientId(): number {
  return Date.now() + Math.floor(Math.random() * 1000);
}

export function purgeMemoryStores(): void {
  pruneMemory(memoryStore, MAX_MEMORY_RECORDS);
  pruneMemory(memorySteps, MAX_MEMORY_STEPS);
  pruneMemory(memoryMedia, MAX_MEMORY_MEDIA);
}

export const executionRepo = {
  async getAll(): Promise<ExecutionRecord[]> {
    try {
      const { prisma } = await import("@/lib/prisma");
      return await prisma.procedureExecution.findMany({
        include: { steps: true, media: true },
        orderBy: { startedAt: "desc" },
      });
    } catch {
      return [...memoryStore];
    }
  },

  async getById(id: number): Promise<ExecutionRecord | null> {
    try {
      const { prisma } = await import("@/lib/prisma");
      return await prisma.procedureExecution.findUnique({
        where: { id },
        include: { steps: true, media: true },
      });
    } catch {
      return memoryStore.find((e) => e.id === id) || null;
    }
  },

  async create(data: {
    procedureId: number;
    userId?: string;
    userName?: string;
    userRole?: string;
    phase?: string;
    anomalies?: string[];
  }): Promise<ExecutionRecord> {
    try {
      const { prisma } = await import("@/lib/prisma");
      return await prisma.procedureExecution.create({
        data: {
          procedureId: data.procedureId,
          userId: data.userId,
          userName: data.userName,
          userRole: data.userRole,
          phase: data.phase || "briefing",
          anomalies: data.anomalies || [],
        },
        include: { steps: true, media: true },
      });
    } catch {
      const record: ExecutionRecord = {
        id: generateClientId(),
        procedureId: data.procedureId,
        userId: data.userId ?? null,
        userName: data.userName ?? null,
        userRole: data.userRole ?? null,
        phase: data.phase || "briefing",
        currentStepIndex: 0,
        completedSteps: [],
        startedAt: new Date(),
        finishedAt: null,
        anomalies: data.anomalies || [],
        globalElapsed: 0,
        steps: [],
        media: [],
      };
      memoryStore.push(record);
      purgeMemoryStores();
      return record;
    }
  },

  async update(
    id: number,
    data: Partial<{
      phase: string;
      currentStepIndex: number;
      completedSteps: string[];
      finishedAt: Date;
      anomalies: string[];
      globalElapsed: number;
    }>
  ): Promise<ExecutionRecord | null> {
    try {
      const { prisma } = await import("@/lib/prisma");
      return await prisma.procedureExecution.update({
        where: { id },
        data,
        include: { steps: true, media: true },
      });
    } catch {
      const idx = memoryStore.findIndex((e) => e.id === id);
      if (idx === -1) return null;
      const updated = { ...memoryStore[idx], ...data } as ExecutionRecord;
      memoryStore[idx] = updated;
      return updated;
    }
  },

  async addStep(data: {
    executionId: number;
    stepId: string;
    stepOrder: number;
    title: string;
    type: string;
    isMandatory?: boolean;
    isCompleted?: boolean;
    timerEnabled?: boolean;
    timerSeconds?: number;
    startedAt?: Date;
    finishedAt?: Date;
    anomaly?: string;
  }): Promise<ExecutionStep> {
    try {
      const { prisma } = await import("@/lib/prisma");
      return await prisma.executionStep.create({
        data: {
          executionId: data.executionId,
          stepId: data.stepId,
          stepOrder: data.stepOrder,
          title: data.title,
          type: data.type,
          isMandatory: data.isMandatory || false,
          isCompleted: data.isCompleted || false,
          timerEnabled: data.timerEnabled || false,
          timerSeconds: data.timerSeconds || 0,
          startedAt: data.startedAt,
          finishedAt: data.finishedAt,
          anomaly: data.anomaly,
        },
      });
    } catch {
      const step: ExecutionStep = {
        id: generateClientId(),
        executionId: data.executionId,
        stepId: data.stepId,
        stepOrder: data.stepOrder,
        title: data.title,
        type: data.type,
        isMandatory: data.isMandatory || false,
        isCompleted: data.isCompleted || false,
        timerEnabled: data.timerEnabled || false,
        timerSeconds: data.timerSeconds || 0,
        startedAt: data.startedAt ?? null,
        finishedAt: data.finishedAt ?? null,
        anomaly: data.anomaly ?? null,
      };
      memorySteps.push(step);
      purgeMemoryStores();
      return step;
    }
  },

  async addMedia(data: {
    executionId: number;
    stepId: string;
    type: string;
    url?: string;
    filename?: string;
    mimeType?: string;
    size?: number;
    geolocation?: Record<string, unknown>;
  }): Promise<ExecutionMedia> {
    try {
      const { prisma } = await import("@/lib/prisma");
      return await prisma.executionMedia.create({
        data: {
          executionId: data.executionId,
          stepId: data.stepId,
          type: data.type,
          url: data.url,
          filename: data.filename,
          mimeType: data.mimeType,
          size: data.size,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          geolocation: data.geolocation as unknown as any,
        },
      });
    } catch {
      const media: ExecutionMedia = {
        id: generateClientId(),
        executionId: data.executionId,
        stepId: data.stepId,
        type: data.type,
        url: data.url ?? null,
        filename: data.filename ?? null,
        mimeType: data.mimeType ?? null,
          size: data.size ?? null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          geolocation: data.geolocation as unknown as any,
          timestamp: new Date(),
        capturedAt: new Date(),
      };
      memoryMedia.push(media);
      purgeMemoryStores();
      return media;
    }
  },
};
