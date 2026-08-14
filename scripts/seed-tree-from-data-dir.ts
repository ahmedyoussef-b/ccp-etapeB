import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/prisma";

const DATA_DIR = path.join(process.cwd(), ".data");

function walk(dir: string): { relative: string; name: string; type: "directory" | "file" }[] {
  const entries: { relative: string; name: string; type: "directory" | "file" }[] = [];
  if (!fs.existsSync(dir)) return entries;

  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    const relative = path.relative(DATA_DIR, fullPath);
    if (stat.isDirectory()) {
      entries.push({ relative, name: item, type: "directory" });
      entries.push(...walk(fullPath));
    } else {
      entries.push({ relative, name: item, type: "file" });
    }
  }
  return entries;
}

async function main() {
  console.log("[tree-data] Scanning .data directory...");
  const entries = walk(DATA_DIR);
  console.log(`[tree-data] ${entries.length} entries found.`);

  const directories = entries.filter((e) => e.type === "directory");
  console.log(`[tree-data] ${directories.length} directories to import.`);

  let root = await prisma.treeNode.findFirst({ where: { name: "BDD web", type: "root" } });
  if (!root) {
    const existing = await prisma.treeNode.findFirst({ where: { name: ".data", type: "root" } });
    if (existing) {
      root = await prisma.treeNode.update({ where: { id: existing.id }, data: { name: "BDD web" } });
    } else {
      root = await prisma.treeNode.create({ data: { name: "BDD web", type: "root", order: 0 } });
    }
  }
  console.log("[tree-data] Root node ready.");

  const nodeMap = new Map<string, { id: number; parentId: number | null }>();
  nodeMap.set(path.join(DATA_DIR, "."), { id: root.id, parentId: null });

  for (const dir of directories) {
    const absolutePath = path.join(DATA_DIR, dir.relative);
    const parentRelative = path.dirname(dir.relative);
    const parentAbsolute = parentRelative === "." ? path.join(DATA_DIR, ".") : path.join(DATA_DIR, parentRelative);
    const parent = nodeMap.get(parentAbsolute)!;

    const existing = await prisma.treeNode.findFirst({
      where: { name: dir.name, type: "directory", parentId: parent.id },
    });

    const node = existing
      ? existing
      : await prisma.treeNode.create({
          data: { name: dir.name, type: "directory", parentId: parent.id, order: 0 },
        });

    nodeMap.set(absolutePath, { id: node.id, parentId: parent.id });
  }

  console.log(`[tree-data] Imported ${nodeMap.size} nodes.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
