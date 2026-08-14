import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");

export async function DELETE() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      return NextResponse.json({ success: true, message: ".data directory does not exist" });
    }

    const entries = fs.readdirSync(DATA_DIR);
    for (const entry of entries) {
      const fullPath = path.join(DATA_DIR, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        fs.rmSync(fullPath, { recursive: true });
      } else {
        fs.unlinkSync(fullPath);
      }
    }

    return NextResponse.json({ success: true, message: ".data directory cleared" });
  } catch (error) {
    console.error("Failed to clear .data directory:", error);
    return NextResponse.json({ error: "Failed to clear .data directory" }, { status: 500 });
  }
}
