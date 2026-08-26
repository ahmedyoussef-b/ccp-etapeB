import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const REGISTRY_DIR = path.join(process.cwd(), ".data", "registry");

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const directories = body.directories as string[] | undefined;

    if (!Array.isArray(directories)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const created: string[] = [];

    for (const dirPath of directories) {
      const safePath = path.normalize(dirPath).replace(/^(\.\.(\/)?)+/, "");
      if (safePath.includes("..")) continue;

      const fullPath = path.join(REGISTRY_DIR, safePath);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        created.push(safePath);
      }
    }

    return NextResponse.json({ success: true, created, count: created.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
