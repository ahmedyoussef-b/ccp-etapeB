import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const OUTPUT = path.join(process.cwd(), ".data", "mirror_repertoire.json");

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

let totalNodes = 0;

function walk(dirPath: string, parentId: number | null, orderStart: number): MirrorNode[] {
  const entries = fs.readdirSync(dirPath).sort();
  const nodes: MirrorNode[] = [];
  let order = orderStart;

  for (const entry of entries) {
    if (entry === ".meta.json" || entry === "mirror.json" || entry === "mirror_repertoire.json") continue;
    const fullPath = path.join(dirPath, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const id = totalNodes + 1;
      totalNodes++;

      const metaPath = path.join(fullPath, ".meta.json");
      let metadata: string | null = null;
      if (fs.existsSync(metaPath)) {
        try {
          metadata = fs.readFileSync(metaPath, "utf-8").replace(/\0/g, "");
        } catch {}
      }
      const now = new Date().toISOString();
      const children = walk(fullPath, id, 0);
      nodes.push({
        id,
        name: entry,
        type: "directory",
        metadata,
        parentId,
        order,
        createdAt: now,
        updatedAt: now,
        children,
      });
    }
    order++;
  }

  return nodes;
}

const rootId = totalNodes + 1;
totalNodes++;
const rootChildren = walk(DATA_DIR, rootId, 0);
const now = new Date().toISOString();

const mirror: MirrorNode[] = [
  {
    id: rootId,
    name: ".data",
    type: "root",
    metadata: null,
    parentId: null,
    order: 0,
    createdAt: now,
    updatedAt: now,
    children: rootChildren,
  },
];

fs.writeFileSync(OUTPUT, JSON.stringify(mirror, null, 2));
console.log(`Generated ${OUTPUT} with ${totalNodes} nodes`);
