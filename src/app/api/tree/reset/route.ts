import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");

async function importDir(dirPath: string, parentId: number | null): Promise<number> {
  const entries = fs.readdirSync(dirPath);
  let created = 0;

  for (let i = 0; i < entries.length; i++) {
    const item = entries[i];
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const node = await prisma.treeNode.create({
        data: {
          name: item,
          type: "directory",
          parentId,
          order: i,
        },
      });
      created += 1;
      created += await importDir(fullPath, node.id);
    } else if (item !== ".meta.json") {
      await prisma.treeNode.create({
        data: {
          name: item,
          type: "file",
          parentId,
          order: i,
        },
      });
      created += 1;
    }
  }

  return created;
}

export async function POST() {
  try {
    await prisma.treeNode.deleteMany({});

    const root = await prisma.treeNode.create({
      data: { name: ".data", type: "root", order: 0 },
    });

    let count = 1;
    if (fs.existsSync(DATA_DIR)) {
      count += await importDir(DATA_DIR, root.id);
    }

    return NextResponse.json({ success: true, message: `Web tree reset successfully (${count} nodes)` });
  } catch (error) {
    console.error("Failed to reset web tree:", error);
    return NextResponse.json({ error: "Failed to reset web tree" }, { status: 500 });
  }
}
