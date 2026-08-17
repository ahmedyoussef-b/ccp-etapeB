import fs from "fs";
import path from "path";

const VECTOR_DATA_PATH = process.env.VECTOR_DATA_PATH || ".vector-data";

export const VECTOR_DATA_DIR = path.isAbsolute(VECTOR_DATA_PATH)
  ? VECTOR_DATA_PATH
  : path.join(process.cwd(), VECTOR_DATA_PATH);

export const DOCUMENTS_DIR = path.join(VECTOR_DATA_DIR, "documents");
export const INDEX_FILE = path.join(VECTOR_DATA_DIR, "indexes", "vector-index.json");
export const METADATA_FILE = path.join(VECTOR_DATA_DIR, "metadata", "index-metadata.json");

export function ensureVectorDataDir() {
  if (!fs.existsSync(VECTOR_DATA_DIR)) {
    fs.mkdirSync(VECTOR_DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DOCUMENTS_DIR)) {
    fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
  }
  if (!fs.existsSync(INDEX_FILE)) {
    fs.writeFileSync(INDEX_FILE, JSON.stringify({ version: "1.0", documents: [], embeddings: [] }, null, 2));
  }
  if (!fs.existsSync(METADATA_FILE)) {
    fs.writeFileSync(METADATA_FILE, JSON.stringify({
      totalDocuments: 0,
      totalChunks: 0,
      lastIndexed: null,
      status: "initialized",
    }, null, 2));
  }
}
