import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth/password";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const MIRROR_PATH = path.join(DATA_DIR, "mirror_repertoire.json");

interface MirrorNode {
  name: string;
  type: "root" | "directory" | "file";
  metadata: string | null;
  order: number;
  children: MirrorNode[];
}

async function importMirror(nodes: MirrorNode[], parentId: number | null): Promise<number> {
  let created = 0;
  for (const node of nodes) {
    if (node.type === "directory" || node.type === "root") {
      const record = await prisma.treeNode.create({
        data: {
          name: node.name,
          type: node.type === "root" ? "root" : "directory",
          parentId,
          order: node.order,
          metadata: node.metadata,
        },
      });
      created += 1;
      created += await importMirror(node.children, record.id);
    } else {
      await prisma.treeNode.create({
        data: {
          name: node.name,
          type: "file",
          parentId,
          order: node.order,
          metadata: node.metadata,
        },
      });
      created += 1;
    }
  }
  return created;
}

async function importDir(dirPath: string, parentId: number | null): Promise<number> {
  const entries = fs.readdirSync(dirPath);
  let created = 0;

  for (const item of entries) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const metaPath = path.join(fullPath, ".meta.json");
      let metadata: string | null = null;
      if (fs.existsSync(metaPath)) {
        try {
          const raw = fs.readFileSync(metaPath, "utf-8");
          metadata = raw.replace(/\0/g, "");
        } catch {
          // ignore
        }
      }

      const node = await prisma.treeNode.create({
        data: {
          name: item,
          type: "directory",
          parentId,
          order: 0,
          metadata,
        },
      });
      created += 1;
      created += await importDir(fullPath, node.id);
    } else if (item !== ".meta.json" && item !== "mirror.json") {
      let metadata: string | null = null;
      try {
        const raw = fs.readFileSync(fullPath, "utf-8");
        metadata = raw.replace(/\0/g, "");
      } catch {
        // binary file — leave metadata null
      }

      await prisma.treeNode.create({
        data: {
          name: item,
          type: "file",
          parentId,
          order: 0,
          metadata,
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

  console.log("[seed] Import de l'arborescence depuis mirror_repertoire.json...");
  if (fs.existsSync(MIRROR_PATH)) {
    const raw = fs.readFileSync(MIRROR_PATH, "utf-8");
    const mirror = JSON.parse(raw) as MirrorNode[];
    const rootNode = mirror.find((n) => n.type === "root");
    if (rootNode) {
      const count = await importMirror(rootNode.children, root.id);
      console.log(`[seed] ${count} nœuds importés depuis mirror.json.`);
    }
  } else if (fs.existsSync(DATA_DIR)) {
    console.log("[seed] mirror.json introuvable, repli sur le parcours du système de fichiers...");
    const count = await importDir(DATA_DIR, root.id);
    console.log(`[seed] ${count} nœuds importés.`);
  } else {
    console.log("[seed] Répertoire .data introuvable, import sauté.");
  }

  await seedQA();
  await seedProcedures();
  await seedUsers();

  console.log("Seed completed successfully");
}

// Mapping app Role (kebab-case) -> Prisma Role (snake_case)
const APP_ROLE_TO_PRISMA: Record<string, "admin" | "superviseur" | "chef_de_bloc" | "chef_de_quart" | "rondier"> = {
  admin: "admin",
  superviseur: "superviseur",
  "chef-de-bloc": "chef_de_bloc",
  "chef-de-quart": "chef_de_quart",
  rondier: "rondier",
};

async function seedUsers() {
  console.log("[seed] Création des utilisateurs de démo...");
  const demoUsers = [
    { email: "admin@nexaflow.com", name: "Administrateur", role: "admin" as const },
    { email: "superviseur@nexaflow.com", name: "Superviseur", role: "superviseur" as const },
    { email: "chef-bloc@nexaflow.com", name: "Chef de bloc", role: "chef-de-bloc" as const },
    { email: "chef-quart@nexaflow.com", name: "Chef de quart", role: "chef-de-quart" as const },
    { email: "rondier@nexaflow.com", name: "Rondier", role: "rondier" as const },
  ];

  const password = process.env.AUTH_DEMO_PASSWORD || "password123";
  const passwordHash = await hashPassword(password);

  for (const u of demoUsers) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      console.log(`[seed] Utilisateur déjà présent: ${u.email}`);
      continue;
    }
    await prisma.user.create({
      data: {
        email: u.email,
        name: u.name,
        role: APP_ROLE_TO_PRISMA[u.role],
        passwordHash,
      },
    });
    console.log(`[seed] Utilisateur créé: ${u.email} (${u.role})`);
  }
}

interface QAPair {
  question: string;
  answer: string;
}

interface QAFile {
  type?: string;
  title?: string;
  description?: string;
  pairs?: QAPair[];
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
      const parsed = JSON.parse(raw) as QAFile;
      if (parsed.type !== "qa" || !Array.isArray(parsed.pairs) || parsed.pairs.length === 0) continue;

      const existing = await prisma.qARegistry.findFirst({ where: { title: parsed.title || file.replace(".json", "") } });
      if (existing) continue;

      await prisma.qARegistry.create({
        data: {
          title: parsed.title || file.replace(".json", ""),
          description: parsed.description || "",
          pairs: {
            create: parsed.pairs.map((p: QAPair, idx: number) => ({
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
