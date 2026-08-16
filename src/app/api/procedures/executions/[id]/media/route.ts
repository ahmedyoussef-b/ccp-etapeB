import { NextResponse } from "next/server";
import { executionRepo } from "@/lib/procedures/services/execution-repo";
import { logMediaCapture } from "@/lib/procedures/services/execution-logger.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { stepId, type, url, filename, mimeType, size, geolocation } = body;

    console.log("[API] Media capture received", {
      executionId: params.id,
      stepId,
      type,
      filename,
      mimeType,
      size,
    });

    await logMediaCapture({
      executionId: params.id,
      stepId,
      type,
      url,
      filename,
      mimeType,
      size,
      geolocation,
    });

    console.log("[API] Media capture logged successfully", {
      executionId: params.id,
      stepId,
      type,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Failed to log media capture:", error);
    return NextResponse.json(
      { error: "Failed to log media capture" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const execution = await executionRepo.getById(Number(params.id));
    if (!execution) {
      return NextResponse.json(
        { error: "Execution not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(execution.media || []);
  } catch (error) {
    console.error("Failed to fetch media:", error);
    return NextResponse.json(
      { error: "Failed to load media" },
      { status: 500 }
    );
  }
}
