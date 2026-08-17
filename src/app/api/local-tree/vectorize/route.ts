import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { ensureVectorDataDir, DOCUMENTS_DIR, INDEX_FILE, METADATA_FILE } from "@/lib/vector/paths";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DATA_DIR = path.join(process.cwd(), ".data");

const EMBEDDING_MODEL = "models/text-embedding-004";
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;
const BATCH_SIZE = 100;
const PLACEHOLDER_KEYS = new Set([
  "change_me_google_genai_api_key",
  "your_api_key_here",
  "placeholder",
  "changeme",
]);

interface RawChunk {
  text: string;
  offset: number;
  length: number;
}

interface Chunk {
  index: number;
  content: string;
  embedding: number[];
  metadata: {
    offset: number;
    length: number;
  };
}

interface VectorDocument {
  id: string;
  name: string;
  originalPath: string;
  relativePath: string;
  chunks: Chunk[];
  metadata: {
    fileSize: number;
    indexedAt: string;
    embeddingModel: string;
    mimeType: string;
    chunkCount: number;
  };
}

interface FileInfo {
  relativePath: string;
  name: string;
  fullPath: string;
  size: number;
  mimeType: string;
  chunks: RawChunk[];
}

interface MirroredNode {
  id: string;
  name: string;
  type: "folder" | "file" | "vectorized";
  children: MirroredNode[];
  path: string;
  size?: number;
  chunks?: number;
  isVectorized?: boolean;
  hasVectorizedDescendant?: boolean;
}

function isPlaceholderKey(key: string | undefined): boolean {
  if (!key) return true;
  return PLACEHOLDER_KEYS.has(key.toLowerCase().trim());
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const textExts = [".txt", ".json", ".xml", ".html", ".htm", ".css", ".js", ".ts", ".tsx", ".jsx", ".py", ".md", ".csv"];
  if (textExts.includes(ext)) return "text/plain";
  return "application/octet-stream";
}

function isTextFile(filePath: string): boolean {
  return getMimeType(filePath) === "text/plain";
}

function splitIntoChunks(content: string): RawChunk[] {
  const chunks: RawChunk[] = [];
  let i = 0;
  while (i < content.length) {
    const end = Math.min(i + CHUNK_SIZE, content.length);
    const chunkText = content.slice(i, end);
    chunks.push({
      text: chunkText,
      offset: i,
      length: chunkText.length,
    });
    i = end - CHUNK_OVERLAP;
    if (i >= content.length) break;
  }
  return chunks;
}

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`Retrying after ${delay}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (isPlaceholderKey(apiKey)) {
    throw new Error(
      "GOOGLE_GENAI_API_KEY is not configured or is a placeholder. Please set a real API key in .env.local."
    );
  }

  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const requests = batch.map((text) => ({
      model: EMBEDDING_MODEL,
      content: { parts: [{ text }] },
      taskType: "RETRIEVAL_DOCUMENT",
    }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL.split("/")[1]}:batchEmbedContents?key=${apiKey}`;

    await retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requests }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Google embedding API error ${res.status}: ${errText}`);
        }

        const data = await res.json();
        for (const emb of data.embeddings) {
          allEmbeddings.push(emb.values);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    });

    if (i + BATCH_SIZE < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return allEmbeddings;
}

function walkAndCollect(dirPath: string, relativePath: string = ""): { tree: MirroredNode[]; files: FileInfo[] } {
  const nodes: MirroredNode[] = [];
  const files: FileInfo[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return { tree: nodes, files };
  }

  for (const entry of entries) {
    if (entry.name === ".meta.json") continue;
    const entryPath = path.join(dirPath, entry.name);
    const entryRel = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const { tree: childTree, files: childFiles } = walkAndCollect(entryPath, entryRel);
      nodes.push({
        id: entryRel,
        name: entry.name,
        type: "folder",
        children: childTree,
        path: entryRel,
      });
      files.push(...childFiles);
    } else {
      const stat = fs.statSync(entryPath);
      const mimeType = getMimeType(entryPath);
      nodes.push({
        id: entryRel,
        name: entry.name,
        type: "file",
        children: [],
        path: entryRel,
        size: stat.size,
      });

      if (isTextFile(entryPath)) {
        let content = "";
        try {
          content = fs.readFileSync(entryPath, "utf-8");
        } catch {
          // binary or unreadable — skip vectorization
        }
        if (content.length > 0) {
          const chunks = splitIntoChunks(content);
          files.push({
            relativePath: entryRel,
            name: entry.name,
            fullPath: entryPath,
            size: stat.size,
            mimeType,
            chunks,
          });
        }
      }
    }
  }

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { tree: nodes, files };
}

async function vectorizeLocalTree(): Promise<{
  mirrored: MirroredNode[];
  stats: { filesProcessed: number; chunksCreated: number; errors: string[] };
}> {
  ensureVectorDataDir();
  const { tree: localTree, files } = walkAndCollect(DATA_DIR);
  const stats = { filesProcessed: 0, chunksCreated: 0, errors: [] as string[] };

  const allChunkTexts: string[] = [];
  for (const file of files) {
    for (const chunk of file.chunks) {
      allChunkTexts.push(chunk.text);
    }
  }

  let embeddings: number[][] = [];
  if (allChunkTexts.length > 0) {
    embeddings = await generateEmbeddings(allChunkTexts);
  }

  let embedIdx = 0;

  const fileToVectorizedNode = new Map<string, MirroredNode>();

  for (const file of files) {
    const chunks: Chunk[] = file.chunks.map((rc, idx) => {
      const embedding = embeddings[embedIdx] ?? [];
      embedIdx++;
      return {
        index: idx,
        content: rc.text,
        embedding,
        metadata: {
          offset: rc.offset,
          length: rc.length,
        },
      };
    });

    try {
      const doc: VectorDocument = {
        id: file.relativePath,
        name: file.name,
        originalPath: file.fullPath,
        relativePath: file.relativePath,
        chunks,
        metadata: {
          fileSize: file.size,
          indexedAt: new Date().toISOString(),
          embeddingModel: EMBEDDING_MODEL,
          mimeType: file.mimeType,
          chunkCount: chunks.length,
        },
      };

      const vectorFilePath = path.join(DOCUMENTS_DIR, `${file.relativePath}.json`);
      fs.mkdirSync(path.dirname(vectorFilePath), { recursive: true });
      fs.writeFileSync(vectorFilePath, JSON.stringify(doc, null, 2));

      stats.filesProcessed++;
      stats.chunksCreated += chunks.length;

      fileToVectorizedNode.set(file.relativePath, {
        id: file.relativePath,
        name: file.name,
        type: "vectorized",
        children: [],
        path: file.relativePath,
        size: file.size,
        chunks: chunks.length,
        isVectorized: true,
      });
    } catch (error) {
      stats.errors.push(
        `Failed to vectorize ${file.relativePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  function buildMirrored(nodes: MirroredNode[]): MirroredNode[] {
    return nodes.map((node) => {
      if (node.type === "folder") {
        const children = buildMirrored(node.children);
        const hasVectorizedChild = children.some(
          (c) => c.type === "vectorized" || c.hasVectorizedDescendant === true
        );
        return { ...node, children, hasVectorizedDescendant: hasVectorizedChild };
      }

      if (node.type === "file") {
        const vecNode = fileToVectorizedNode.get(node.path);
        if (vecNode) {
          return vecNode;
        }
        return { ...node, isVectorized: false };
      }

      return node;
    });
  }

  const mirrored = buildMirrored(localTree);
  return { mirrored, stats };
}

export async function POST() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      return NextResponse.json({ error: "Local data directory not found" }, { status: 404 });
    }

    const startTime = Date.now();
    const { mirrored, stats } = await vectorizeLocalTree();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    const metadata = {
      totalDocuments: stats.filesProcessed,
      totalChunks: stats.chunksCreated,
      lastIndexed: new Date().toISOString(),
      status: stats.errors.length === 0 ? "completed" : "completed_with_errors",
    };
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));

    let existingIndex: { version: string; documents: unknown[]; embeddings: unknown[]; lastIndexed?: string };
    if (fs.existsSync(INDEX_FILE)) {
      existingIndex = JSON.parse(fs.readFileSync(INDEX_FILE, "utf-8"));
    } else {
      existingIndex = { version: "1.0", documents: [], embeddings: [] };
    }

    existingIndex.documents = [];
    existingIndex.embeddings = [];
    existingIndex.lastIndexed = new Date().toISOString();
    fs.writeFileSync(INDEX_FILE, JSON.stringify(existingIndex, null, 2));

    return NextResponse.json({
      success: true,
      tree: mirrored,
      stats: {
        ...stats,
        duration: `${duration}s`,
      },
    });
  } catch (error) {
    console.error("Failed to vectorize local tree:", error);
    return NextResponse.json(
      {
        error: "Failed to vectorize local tree",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
