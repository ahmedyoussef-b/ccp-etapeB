import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const [totalNodes, rootNodes, directoryNodes, fileNodes, syncMetadata] = await Promise.all([
      prisma.treeNode.count(),
      prisma.treeNode.count({ where: { type: "root" } }),
      prisma.treeNode.count({ where: { type: "directory" } }),
      prisma.treeNode.count({ where: { type: "file" } }),
      prisma.syncMetadata.findMany({
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
    ]);

    const lastSyncEntry = syncMetadata.find((m) => m.key === "last_pg_to_sqlite_sync");
    const lastSync = lastSyncEntry ? lastSyncEntry.value : null;

    return NextResponse.json({
      postgresql: {
        totalNodes,
        folders: directoryNodes,
        files: fileNodes,
        roots: rootNodes,
        lastSync,
      },
      syncMetadata: syncMetadata.map((m) => ({
        key: m.key,
        value: m.value,
        updatedAt: m.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Failed to fetch BDD metrics:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const normalized = message.toLowerCase();
    const isDbUnavailable =
      normalized.includes("can't reach database server") ||
      normalized.includes("connection") ||
      normalized.includes("timeout") ||
      normalized.includes("prisma client initializationerror");

    if (isDbUnavailable) {
      return NextResponse.json(
        {
          error: "database_unavailable",
          message: "La base de données web est indisponible pour le moment.",
          details: message,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Failed to load metrics", details: message },
      { status: 500 }
    );
  }
}
