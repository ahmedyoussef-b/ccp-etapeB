import { Prisma, PrismaClient, SyncStatus } from "@prisma/client";
import { randomUUID } from "crypto";

export function generateUUID(): string {
  return randomUUID();
}

const LOG_PREFIX = "[DB:POSTGRES]";

const logger = {
  postgres: (action: string, data?: unknown) => {
    const payload = data ? ` ${JSON.stringify(data, null, 2)}` : "";
    console.log(`${LOG_PREFIX} ${action}${payload}`);
  },
  postgresError: (action: string, error: unknown) => {
    const payload = error instanceof Error ? error.message : String(error);
    console.error(`${LOG_PREFIX} [ERROR] ${action} ${payload}`);
  },
};

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaConnected: boolean | undefined;
};

const prismaClientSingleton = (): PrismaClient => {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
  });
};

const SYNCABLE_MODELS = [
  "Procedure",
  "ProcedureExecution",
  "ExecutionStep",
  "ExecutionMedia",
  "Approval",
  "ProcedureVersion",
  "TreeNode",
  "QARegistry",
  "QAPair",
  "MediaItem",
  "IotSensorState",
  "IotActuatorState",
  "ProcedureRequiredRole",
  "ProcedureSafetyInstruction",
  "ProcedureTag",
  "ExecutionCompletedStep",
  "ExecutionAnomaly",
  "MediaItemTag",
  "SyncLog",
] as const;

type SyncableModel = (typeof SYNCABLE_MODELS)[number];

interface SyncableModelDelegate {
  findMany: (args?: Record<string, unknown>) => Promise<unknown[]>;
  findUnique: (args?: Record<string, unknown>) => Promise<unknown | null>;
  findFirst: (args?: Record<string, unknown>) => Promise<unknown | null>;
  update: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<unknown>;
  create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  upsert: (args: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown>;
}

function isSyncableModel(model: string): model is SyncableModel {
  return (SYNCABLE_MODELS as readonly string[]).includes(model);
}

function getModelDelegate(model: SyncableModel): SyncableModelDelegate {
  return (prisma as unknown as Record<string, SyncableModelDelegate>)[model];
}

async function ensureConnected(): Promise<void> {
  if (!globalForPrisma.prismaConnected) {
    try {
      await prisma.$connect();
      globalForPrisma.prismaConnected = true;
      logger.postgres("connected", { provider: "postgresql" });
    } catch (err) {
      logger.postgresError("connect", err);
      throw new Error("Failed to connect to PostgreSQL");
    }
  }
}

let prisma: PrismaClient;

try {
  prisma = globalForPrisma.prisma ?? prismaClientSingleton();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
  }

  void ensureConnected().catch((err) => {
    logger.postgresError("init_connection", err);
  });
} catch (err) {
  logger.postgresError("init", err);
  throw err;
}

export type PrismaClientType = typeof prisma;
export type { Prisma, SyncStatus };

export const syncHelpers = {
  /**
   * Récupère tous les enregistrements nécessitant une synchronisation pour un modèle.
   * Filtre sur les statuts: pending, local_only, conflict (exclut deletedAt)
   */
  getPendingRecords: async (model: SyncableModel): Promise<unknown[]> => {
    if (!isSyncableModel(model)) {
      throw new Error(`Model "${model}" is not a syncable model`);
    }
    const delegate = getModelDelegate(model);
    return delegate.findMany({
      where: {
        OR: [
          { syncStatus: "pending" },
          { syncStatus: "local_only" },
          { syncStatus: "conflict" },
        ],
        deletedAt: null,
      },
      orderBy: { updatedAt: "desc" },
    });
  },

  /**
   * Marque un enregistrement comme synchronisé via son uuid
   */
  markAsSynced: async (model: SyncableModel, uuid: string): Promise<unknown> => {
    if (!isSyncableModel(model)) {
      throw new Error(`Model "${model}" is not a syncable model`);
    }
    const delegate = getModelDelegate(model);
    return delegate.update({
      where: { uuid },
      data: { syncStatus: "synced" },
    });
  },

  /**
   * Soft delete d'un enregistrement via son uuid
   * (marque deletedAt et passe le syncStatus à 'pending')
   */
  softDelete: async (model: SyncableModel, uuid: string): Promise<unknown> => {
    if (!isSyncableModel(model)) {
      throw new Error(`Model "${model}" is not a syncable model`);
    }
    const delegate = getModelDelegate(model);
    return delegate.update({
      where: { uuid },
      data: {
        deletedAt: new Date(),
        syncStatus: "pending",
      },
    });
  },

  /**
   * Vérifie le syncStatus d'un enregistrement via son uuid
   */
  getSyncStatus: async (model: SyncableModel, uuid: string): Promise<SyncStatus | null> => {
    if (!isSyncableModel(model)) {
      throw new Error(`Model "${model}" is not a syncable model`);
    }
    const delegate = getModelDelegate(model);
    const record = await delegate.findUnique({
      where: { uuid },
      select: { syncStatus: true },
    });
    if (record && typeof record === "object" && "syncStatus" in record) {
      return (record as { syncStatus: SyncStatus }).syncStatus;
    }
    return null;
  },
};

export { prisma };
export default prisma;
