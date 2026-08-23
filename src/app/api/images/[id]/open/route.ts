import { NextResponse } from "next/server";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { getById, getItemDir, getMediaDir } from "@/lib/images/server-store";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Ouverture disque désactivée en production" }, { status: 403 });
    }

    const item = await getById(params.id);
    if (!item) {
      return NextResponse.json({ error: "Image non trouvée" }, { status: 404 });
    }

    const itemDir = path.resolve(getItemDir(item));
    const mediaDir = path.resolve(getMediaDir());

    if (!itemDir.startsWith(mediaDir)) {
      return NextResponse.json({ error: "Chemin invalide" }, { status: 400 });
    }

    const target = fs.existsSync(itemDir) ? itemDir : mediaDir;

    let command: string;
    let args: string[];
    if (process.platform === "win32") {
      command = "explorer";
      args = [target];
    } else if (process.platform === "darwin") {
      command = "open";
      args = [target];
    } else {
      command = "xdg-open";
      args = [target];
    }

    execFile(command, args, (err) => {
      if (err) console.error("[OpenFolder] échec ouverture", err);
    });

    return NextResponse.json({ success: true, path: target });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to open folder";
    console.error("[OpenFolder] error", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
