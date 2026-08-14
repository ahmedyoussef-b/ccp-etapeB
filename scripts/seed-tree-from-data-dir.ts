import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import fs from "fs";
import path from "path";

const DATA_DIR = process.cwd() + "/.data";

async function importDir(dirPath: string, parentId: number | null): Promise<number> {
  const entries = fs.readdirSync(dirPath);
  let created = 0;

  for (const item of entries) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const node = await prisma.treeNode.create({
        data: {
          name: item,
          type: "directory",
          parentId,
          order: 0,
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
          order: 0,
        },
      });
      created += 1;
    }
  }

  return created;
}

async function main() {
  console.log("[tree-data] Scanning .data directory...");

  await prisma.treeNode.deleteMany({});
  console.log("[tree-data] Cleared existing tree nodes.");

  const root = await prisma.treeNode.create({
    data: { name: ".data", type: "root", order: 0 },
  });
  console.log("[tree-data] Root node created.");

  const count = await importDir(DATA_DIR, root.id);
  console.log(`[tree-data] Imported ${count + 1} nodes.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
