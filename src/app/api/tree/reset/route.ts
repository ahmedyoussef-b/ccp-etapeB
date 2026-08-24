import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { generateUUID } from "@/lib/prisma";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DATA_DIR = path.join(process.cwd(), ".data");
const MIRROR_PATH = path.join(DATA_DIR, "mirror_repertoire.json");

interface MirrorNode {
  id: number;
  name: string;
  type: "root" | "directory";
  metadata: string | null;
  parentId: number | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  children: MirrorNode[];
}

async function importMirror(nodes: MirrorNode[], parentId: number | null): Promise<number> {
  const { prisma } = await import("@/lib/prisma");
  let created = 0;
  for (const node of nodes) {
    const record = await prisma.treeNode.create({
      data: {
        uuid: generateUUID(),
        name: node.name,
        type: node.type === "root" ? "root" : "directory",
        parentId,
        order: node.order,
        metadata: node.metadata,
      },
    });
    created += 1;
    created += await importMirror(node.children, record.id);
  }
  return created;
}

export async function POST() {
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.treeNode.deleteMany({});

    const root = await prisma.treeNode.create({
      data: { uuid: generateUUID(), name: ".data", type: "root", order: 0 },
    });

    let count = 1;
    if (fs.existsSync(MIRROR_PATH)) {
      const raw = fs.readFileSync(MIRROR_PATH, "utf-8");
      const mirror = JSON.parse(raw) as MirrorNode[];
      const rootNode = mirror.find((n) => n.type === "root");
      if (rootNode) {
        count += await importMirror(rootNode.children, root.id);
      }
    }

    console.log(`[TreeReset] Web tree reset completed with ${count} nodes`);
    return NextResponse.json({ success: true, message: `Web tree reset successfully (${count} nodes)` });
  } catch (error) {
    console.error("[TreeReset] Failed to reset web tree:", error);
    return NextResponse.json({ error: "Failed to reset web tree" }, { status: 500 });
  }
}
