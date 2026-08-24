import { Prisma } from "@prisma/client";
import type {
  ProcedureExecution,
  ExecutionStep,
  ExecutionMedia,
} from "@prisma/client";
import { generateUUID } from "@/lib/prisma";

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
      const { anomalies, ...rest } = data;
      const created = await prisma.procedureExecution.create({
        data: {
          uuid: generateUUID(),
          procedureId: rest.procedureId,
          userId: rest.userId,
          userName: rest.userName,
          userRole: rest.userRole,
          phase: rest.phase || "briefing",
        },
        include: { steps: true, media: true },
      });

      if (anomalies && anomalies.length > 0) {
        await prisma.executionAnomaly.createMany({
          data: anomalies.map((a) => ({
            uuid: generateUUID(),
            executionId: created.id,
            anomaly: a,
          })),
        });
      }

      return created;
    } catch {
      const record: ExecutionRecord = {
        id: generateClientId(),
        uuid: generateUUID(),
        procedureId: data.procedureId,
        userId: data.userId ?? null,
        userName: data.userName ?? null,
        userRole: data.userRole ?? null,
        phase: data.phase || "briefing",
        currentStepIndex: 0,
        startedAt: new Date(),
        finishedAt: null,
        globalElapsed: 0,
        syncStatus: "pending" as const,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
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
    const { anomalies } = data;
    const prismaData: Record<string, unknown> = {};
    if (data.phase) prismaData.phase = data.phase;
    if (data.currentStepIndex !== undefined) prismaData.currentStepIndex = data.currentStepIndex;
    if (data.finishedAt) prismaData.finishedAt = data.finishedAt;
    if (data.globalElapsed !== undefined) prismaData.globalElapsed = data.globalElapsed;
    try {
      const { prisma } = await import("@/lib/prisma");
      const updated = await prisma.procedureExecution.update({
        where: { id },
        data: prismaData,
        include: { steps: true, media: true },
      });

      if (anomalies) {
        await prisma.executionAnomaly.deleteMany({ where: { executionId: id } });
        if (anomalies.length > 0) {
          await prisma.executionAnomaly.createMany({
            data: anomalies.map((a) => ({
              uuid: generateUUID(),
              executionId: id,
              anomaly: a,
            })),
          });
        }
      }

      return updated;
    } catch {
      const idx = memoryStore.findIndex((e) => e.id === id);
      if (idx === -1) return null;
      const updated = { ...memoryStore[idx], ...prismaData } as ExecutionRecord;
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
          uuid: generateUUID(),
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
        uuid: generateUUID(),
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
        syncStatus: "pending" as const,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
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
          uuid: generateUUID(),
          executionId: data.executionId,
          stepId: data.stepId,
          type: data.type,
          url: data.url,
          filename: data.filename,
          mimeType: data.mimeType,
          size: data.size,
          geolocation: data.geolocation as Prisma.InputJsonValue,
        },
      });
    } catch {
      const media: ExecutionMedia = {
        id: generateClientId(),
        uuid: generateUUID(),
        executionId: data.executionId,
        stepId: data.stepId,
        type: data.type,
        url: data.url ?? null,
        filename: data.filename ?? null,
        mimeType: data.mimeType ?? null,
        size: data.size ?? null,
        geolocation: data.geolocation as Prisma.JsonValue | null,
        timestamp: new Date(),
        capturedAt: new Date(),
        syncStatus: "pending" as const,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryMedia.push(media);
      pruneMemory(memoryMedia, MAX_MEMORY_MEDIA);
      return media;
    }
  },
};
