import { NextResponse } from "next/server";
import { executionRepo } from "@/lib/procedures/services/execution-repo";
import { logExecutionStart } from "@/lib/procedures/services/execution-logger.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const executions = await executionRepo.getAll();
    return NextResponse.json(executions);
  } catch (error) {
    console.error("Failed to fetch executions:", error);
    return NextResponse.json(
      { error: "Failed to load executions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { procedureId, userId, userRole } = body;

    if (!procedureId) {
      return NextResponse.json(
        { error: "procedureId is required" },
        { status: 400 }
      );
    }

    const executionId = await logExecutionStart(
      Number(procedureId),
      userId,
      userRole
    );

    return NextResponse.json({ executionId }, { status: 201 });
  } catch (error) {
    console.error("Failed to start execution:", error);
    return NextResponse.json(
      { error: "Failed to start execution" },
      { status: 500 }
    );
  }
}
