import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getById as getDiskById, getItemMetadataPath } from "@/lib/images/server-store";
import { getItemById as getPrismaById } from "@/lib/images/server-store-prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ─── GET /api/images/[id]/metadata ───────────────────────────────────────────
// Returns the raw JSON metadata file content for a media item.
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  console.log(`[API][GET /api/images/${params.id}/metadata]`);
  let item = await getDiskById(params.id);
  if (!item) {
    item = await getPrismaById(params.id);
  }

  if (!item) {
    return NextResponse.json({ message: "Image not found" }, { status: 404 });
  }

  const metadataPath = getItemMetadataPath(item);
  if (!fs.existsSync(metadataPath)) {
    // If json file is missing, synthesize from item
    const { dataUrl: _dataUrl, ...cleanMeta } = item; // eslint-disable-line @typescript-eslint/no-unused-vars
    return NextResponse.json({ metadata: cleanMeta, path: metadataPath });
  }

  try {
    const raw = fs.readFileSync(metadataPath, "utf-8");
    const parsed = JSON.parse(raw);
    return NextResponse.json({ metadata: parsed, path: metadataPath });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read metadata";
    console.error(`[API][GET /api/images/${params.id}/metadata] ERROR:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── PUT /api/images/[id]/metadata ───────────────────────────────────────────
// Overwrites the JSON metadata file with the supplied body AND syncs with PostgreSQL (BDD Web).
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  console.log(`[API][PUT /api/images/${params.id}/metadata]`);
  let item = await getDiskById(params.id);
  if (!item) {
    item = await getPrismaById(params.id);
  }

  if (!item) {
    return NextResponse.json({ message: "Image not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const metadataPath = getItemMetadataPath(item);
  const metadataDir = path.dirname(metadataPath);
  if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir, { recursive: true });
  }

  try {
    // 1. Update JSON file in .data/registry/<category>/<slug>/<slug>.json
    const updated = {
      ...body,
      id: item.id,
      createdAt: item.createdAt,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(metadataPath, JSON.stringify(updated, null, 2), "utf-8");
    console.log(`[API][PUT /api/images/${params.id}/metadata] - saved to ${metadataPath}`);

    // 2. Synchronize to PostgreSQL (BDD Web / Prisma)
    try {
      const { prisma } = await import("@/lib/prisma");
      const dbUpdates: Record<string, unknown> = {};
      if (typeof body.title === "string") dbUpdates.title = body.title;
      if (typeof body.description === "string") dbUpdates.description = body.description;
      if (typeof body.category === "string") dbUpdates.category = body.category;
      if (Array.isArray(body.tags)) dbUpdates.tags = body.tags;
      if (typeof body.kind === "string" && (body.kind === "image" || body.kind === "video")) {
        dbUpdates.kind = body.kind;
      }
      if (body.geolocation) dbUpdates.geolocation = JSON.stringify(body.geolocation);

      if (Object.keys(dbUpdates).length > 0) {
        await prisma.mediaItem.update({
          where: { id: item.id },
          data: dbUpdates,
        });
        console.log(`[API][PUT /api/images/${params.id}/metadata] - synced to PostgreSQL Prisma`);
      }
    } catch (dbErr) {
      console.warn(`[API][PUT /api/images/${params.id}/metadata] - Prisma sync warning (skipped if no DB):`, dbErr);
    }

    return NextResponse.json({ success: true, metadata: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to write metadata";
    console.error(`[API][PUT /api/images/${params.id}/metadata] ERROR:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
