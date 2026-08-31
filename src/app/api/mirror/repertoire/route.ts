import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DATA_DIR = path.join(process.cwd(), ".data");
const MIRROR_PATH = path.join(DATA_DIR, "mirror_repertoire.json");

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

export async function GET() {
  try {
    if (!fs.existsSync(MIRROR_PATH)) {
      return NextResponse.json({ error: "mirror_repertoire.json not found" }, { status: 404 });
    }
    const raw = fs.readFileSync(MIRROR_PATH, "utf-8");
    const mirror = JSON.parse(raw) as MirrorNode[];
    return NextResponse.json(mirror);
  } catch (error) {
    console.error("[API][GET /api/mirror/repertoire] error:", error);
    return NextResponse.json({ error: "Failed to load mirror repertoire" }, { status: 500 });
  }
}
