import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEVICE_STATE: Record<string, { type: string; state: boolean | number; lastCommand: string; lastCommandAt: string }> = {};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, state, type } = body;

    if (!id || state === undefined) {
      return NextResponse.json({ error: "id and state are required" }, { status: 400 });
    }

    const key = `${type ?? "unknown"}:${id}`;
    DEVICE_STATE[key] = {
      type: type ?? "unknown",
      state,
      lastCommand: `set ${id} = ${String(state)}`,
      lastCommandAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      message: `Commande simulée : ${id} → ${String(state)}`,
      device: { id, type, state, timestamp: new Date().toISOString() },
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const type = searchParams.get("type") ?? "unknown";
    const key = `${type}:${id}`;

    if (!id) {
      return NextResponse.json({ devices: DEVICE_STATE });
    }

    const device = DEVICE_STATE[key];
    if (!device) {
      return NextResponse.json({ id, type, state: null, message: "Aucune commande simulée pour ce device" });
    }

    return NextResponse.json({
      id,
      type: device.type,
      state: device.state,
      lastCommand: device.lastCommand,
      lastCommandAt: device.lastCommandAt,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
