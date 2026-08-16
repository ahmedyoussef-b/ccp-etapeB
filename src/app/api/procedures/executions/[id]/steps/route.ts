import { NextResponse } from "next/server";
import { executionRepo } from "@/lib/procedures/services/execution-repo";
import { logStepStart, logStepEnd } from "@/lib/procedures/services/execution-logger.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { event, stepId, stepOrder, title, type, isMandatory, isCompleted, anomaly } =
      body;

    if (event === "start") {
      await logStepStart({
        executionId: params.id,
        stepId,
        stepOrder,
        title,
        type,
        isMandatory,
      });
    } else if (event === "end") {
      await logStepEnd(params.id, stepId, isCompleted || false, anomaly);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to log step event:", error);
    return NextResponse.json(
      { error: "Failed to log step event" },
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
    return NextResponse.json(execution.steps || []);
  } catch (error) {
    console.error("Failed to fetch steps:", error);
    return NextResponse.json(
      { error: "Failed to load steps" },
      { status: 500 }
    );
  }
}
