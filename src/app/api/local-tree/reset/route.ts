import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

const DATA_DIR = path.join(process.cwd(), ".data");
const MIRROR_FILE = path.join(DATA_DIR, "mirror.json");

export async function POST() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(MIRROR_FILE)) {
      fs.unlinkSync(MIRROR_FILE);
    }

    return NextResponse.json({
      success: true,
      message: "Local tree reset to .data directory",
    });
  } catch (error) {
    console.error("Failed to reset local tree:", error);
    return NextResponse.json({ error: "Failed to reset local tree" }, { status: 500 });
  }
}
