import { NextResponse } from "next/server";
import { executionRepo } from "@/lib/procedures/services/execution-repo";
import { logExecutionEnd } from "@/lib/procedures/services/execution-logger.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    return NextResponse.json(execution);
  } catch (error) {
    console.error("Failed to fetch execution:", error);
    return NextResponse.json(
      { error: "Failed to load execution" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { phase, anomalies, globalElapsed } = body;

    if (phase && ["completed", "aborted"].includes(phase)) {
      await logExecutionEnd(
        params.id,
        phase,
        anomalies || [],
        globalElapsed || 0
      );
      return NextResponse.json({ success: true });
    }

    const updated = await executionRepo.update(Number(params.id), body);
    if (!updated) {
      return NextResponse.json(
        { error: "Execution not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update execution:", error);
    return NextResponse.json(
      { error: "Failed to update execution" },
      { status: 500 }
    );
  }
}
