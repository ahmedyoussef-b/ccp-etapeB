import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");

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
  console.log("[seed] Démarrage du seed...");

  console.log("[seed] Nettoyage de l'arborescence...");
  await prisma.treeNode.deleteMany({});
  console.log("[seed] Arborescence nettoyée.");

  console.log("[seed] Création du root...");
  const root = await prisma.treeNode.create({
    data: { name: ".data", type: "root", order: 0 },
  });
  console.log("[seed] Root créé.");

  console.log("[seed] Import de l'arborescence depuis .data...");
  if (fs.existsSync(DATA_DIR)) {
    const count = await importDir(DATA_DIR, root.id);
    console.log(`[seed] ${count} nœuds importés.`);
  } else {
    console.log("[seed] Répertoire .data introuvable, import sauté.");
  }

  console.log("Seed completed successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
