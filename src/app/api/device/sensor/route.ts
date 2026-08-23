import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SENSOR_STATE: Record<string, { value: number; unit: string; updatedAt: string }> = {
  "camera-main": { value: 1, unit: "active", updatedAt: new Date().toISOString() },
  "mic-main": { value: 45, unit: "%", updatedAt: new Date().toISOString() },
  "temp-main": { value: 22.5, unit: "°C", updatedAt: new Date().toISOString() },
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ sensors: SENSOR_STATE });
    }

    const sensor = SENSOR_STATE[id];
    if (!sensor) {
      return NextResponse.json({ id, value: null, unit: null, message: "Capteur introuvable" });
    }

    if (id === "temp-main") {
      const jitter = (Math.random() - 0.5) * 0.5;
      SENSOR_STATE[id] = { ...sensor, value: Math.round((sensor.value + jitter) * 10) / 10, updatedAt: new Date().toISOString() };
    } else if (id === "mic-main") {
      const jitter = (Math.random() - 0.5) * 10;
      SENSOR_STATE[id] = { ...sensor, value: Math.max(0, Math.min(100, Math.round(sensor.value + jitter))), updatedAt: new Date().toISOString() };
    }

    return NextResponse.json({
      id,
      value: SENSOR_STATE[id].value,
      unit: SENSOR_STATE[id].unit,
      updatedAt: SENSOR_STATE[id].updatedAt,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, value, unit } = body;

    if (!id || value === undefined) {
      return NextResponse.json({ error: "id and value are required" }, { status: 400 });
    }

    SENSOR_STATE[id] = {
      value: Number(value),
      unit: unit ?? "unknown",
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, id, value: SENSOR_STATE[id].value, unit: SENSOR_STATE[id].unit });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
