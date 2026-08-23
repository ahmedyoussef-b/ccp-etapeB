import fs from "fs";
import path from "path";

const DB_DIR = path.join(process.cwd(), ".local-db", "etat-des-lieux");
const DB_FILE = path.join(DB_DIR, "reports.json");

function ensureDir(): void {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

function readReports(): EtatDesLieuxReport[] {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeReports(reports: EtatDesLieuxReport[]): void {
  ensureDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(reports, null, 2), "utf-8");
}

export interface MediaAttachment {
  kind: "image" | "video";
  dataUrl: string;
  mimeType: string;
  size: number;
  thumbnailDataUrl?: string;
}

export interface EtatDesLieuxReport {
  id: string;
  title: string;
  description: string;
  location: string;
  attachments: MediaAttachment[];
  status: "draft" | "sent";
  authorName: string;
  authorRole: string;
  createdAt: string;
  updatedAt: string;
}

export function generateId(): string {
  return `edl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function getAll(): Promise<EtatDesLieuxReport[]> {
  await delay(50);
  return readReports();
}

export async function getById(id: string): Promise<EtatDesLieuxReport | undefined> {
  await delay(30);
  const reports = readReports();
  return reports.find((report) => report.id === id);
}

export async function create(report: Omit<EtatDesLieuxReport, "id" | "createdAt" | "updatedAt">): Promise<EtatDesLieuxReport> {
  await delay(50);
  const now = new Date().toISOString();
  const newReport: EtatDesLieuxReport = {
    ...report,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  const reports = readReports();
  reports.unshift(newReport);
  writeReports(reports);
  return newReport;
}

export async function update(
  id: string,
  updates: Partial<Omit<EtatDesLieuxReport, "id" | "createdAt">>
): Promise<EtatDesLieuxReport | undefined> {
  await delay(50);
  const reports = readReports();
  const index = reports.findIndex((report) => report.id === id);
  if (index === -1) return undefined;
  reports[index] = {
    ...reports[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  writeReports(reports);
  return reports[index];
}

export async function remove(id: string): Promise<boolean> {
  await delay(50);
  const reports = readReports();
  const index = reports.findIndex((report) => report.id === id);
  if (index === -1) return false;
  reports.splice(index, 1);
  writeReports(reports);
  return true;
}

function delay(ms = 30): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
