import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import fs from "fs";
import path from "path";

const DATA_DIR = process.cwd() + "/.data";

async function importDir(tx: any, dirPath: string, parentId: number | null): Promise<number> {
  const entries = fs.readdirSync(dirPath);
  let created = 0;

  for (const item of entries) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const node = await tx.treeNode.create({
        data: {
          name: item,
          type: "directory",
          parentId,
          order: 0,
        },
      });
      created += 1;
      created += await importDir(tx, fullPath, node.id);
    } else if (item !== ".meta.json") {
      await tx.treeNode.create({
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

export async function seedTreeFromDataDir(tx: any): Promise<number> {
  await tx.treeNode.deleteMany({});
  const root = await tx.treeNode.create({
    data: { name: ".data", type: "root", order: 0 },
  });
  const count = fs.existsSync(DATA_DIR) ? await importDir(tx, DATA_DIR, root.id) : 0;
  return count + 1;
}

async function main() {
  const count = await seedTreeFromDataDir(prisma);
  console.log(`[tree-data] Imported ${count} nodes.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
