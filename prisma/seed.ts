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

async function seedProcedures() {
  console.log("[seed] Import des procédures depuis .registry/procedures...");
  const proceduresDir = path.join(process.cwd(), ".registry", "procedures");
  if (!fs.existsSync(proceduresDir)) {
    console.log("[seed] Dossier .registry/procedures introuvable, import procédures sauté.");
    return;
  }

  const files: string[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (entry.endsWith(".json")) {
        files.push(full);
      }
    }
  }
  walk(proceduresDir);

  let imported = 0;

  for (const fullPath of files) {
    try {
      const raw = fs.readFileSync(fullPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (!parsed.metadata || !parsed.metadata.code) continue;

      const existing = await prisma.procedure.findFirst({ where: { code: parsed.metadata.code } });
      if (existing) continue;

      await prisma.procedure.create({
        data: {
          code: parsed.metadata.code,
          title: parsed.metadata.title || path.basename(fullPath, ".json"),
          description: parsed.metadata.description || "",
          category: parsed.metadata.category || "production",
          priority: parsed.metadata.criticality || parsed.metadata.priority || "moyenne",
          estimatedTimeMinutes: parsed.metadata.estimatedTimeMinutes || 30,
          requiredRoles: parsed.metadata.requiredRoles || [],
          globalSafetyInstructions: parsed.metadata.globalSafetyInstructions || [],
          status: "approved",
          authorId: parsed.metadata.author?.id || "system",
          authorName: parsed.metadata.author?.name || "System",
          approverId: parsed.metadata.approvers?.[0]?.id || "system",
          approverName: parsed.metadata.approvers?.[0]?.name || "System",
          reviewDate: parsed.metadata.reviewDate ? new Date(parsed.metadata.reviewDate) : undefined,
          version: parsed.metadata.version || "1.0",
          tags: parsed.metadata.tags || [],
          language: parsed.metadata.language || "fr-FR",
          body: parsed,
        },
      });
      imported++;
    } catch (e) {
      console.warn(`[seed] Échec import ${fullPath}:`, e);
    }
  }

  console.log(`[seed] ${imported} procédure(s) importée(s).`);
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
  const DATA_DIR = path.join(process.cwd(), ".data");
  if (fs.existsSync(DATA_DIR)) {
    const count = await importDir(DATA_DIR, root.id);
    console.log(`[seed] ${count} nœuds importés.`);
  } else {
    console.log("[seed] Répertoire .data introuvable, import sauté.");
  }

  await seedQA();
  await seedProcedures();

  console.log("Seed completed successfully");
}

async function seedQA() {
  console.log("[seed] Import des Q/R depuis .registry/items...");
  const itemsDir = path.join(process.cwd(), ".registry", "items");
  if (!fs.existsSync(itemsDir)) {
    console.log("[seed] Dossier .registry/items introuvable, import Q/R sauté.");
    return;
  }

  const files = fs.readdirSync(itemsDir).filter((f) => f.endsWith(".json"));
  let imported = 0;

  for (const file of files) {
    const fullPath = path.join(itemsDir, file);
    if (!fs.statSync(fullPath).isFile()) continue;

    try {
      const raw = fs.readFileSync(fullPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.type !== "qa" || !Array.isArray(parsed.pairs) || parsed.pairs.length === 0) continue;

      const existing = await prisma.qARegistry.findFirst({ where: { title: parsed.title || file.replace(".json", "") } });
      if (existing) continue;

      await prisma.qARegistry.create({
        data: {
          title: parsed.title || file.replace(".json", ""),
          description: parsed.description || "",
          pairs: {
            create: parsed.pairs.map((p: any, idx: number) => ({
              question: p.question,
              answer: p.answer,
              order: idx,
            })),
          },
        },
      });
      imported++;
    } catch (e) {
      console.warn(`[seed] Échec import ${file}:`, e);
    }
  }

  console.log(`[seed] ${imported} registre(s) Q/R importé(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
