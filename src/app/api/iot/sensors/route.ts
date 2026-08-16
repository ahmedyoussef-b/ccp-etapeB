import { NextResponse } from "next/server";
import { SensorData, DEFAULT_SENSOR_DATA } from "@/lib/iot/sensor-client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const procedureId = searchParams.get("procedureId");

    const simulatedData: SensorData = {
      camera: {
        active: true,
        resolution: "1920x1080",
        fps: 30,
        motionDetected: Math.random() > 0.85,
      },
      microphone: {
        active: true,
        level: Math.round(Math.max(0, Math.min(100, 45 + (Math.random() - 0.5) * 20))),
        noiseDetected: Math.random() > 0.9,
      },
      temperature: {
        active: true,
        current: Math.round((22.5 + (Math.random() - 0.5) * 0.5) * 10) / 10,
        min: 18,
        max: 35,
        unit: "C",
        alert: Math.random() > 0.95,
      },
    };

    return NextResponse.json({
      procedureId: procedureId ?? "default",
      data: simulatedData,
      timestamp: Date.now(),
      source: "simulation",
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch sensor data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sensorData, procedureId } = body;

    if (!sensorData) {
      return NextResponse.json({ error: "sensorData is required" }, { status: 400 });
    }

    const validatedData: SensorData = {
      camera: {
        active: Boolean(sensorData.camera?.active ?? DEFAULT_SENSOR_DATA.camera.active),
        resolution: String(sensorData.camera?.resolution ?? DEFAULT_SENSOR_DATA.camera.resolution),
        fps: Number(sensorData.camera?.fps ?? DEFAULT_SENSOR_DATA.camera.fps),
        motionDetected: Boolean(sensorData.camera?.motionDetected ?? false),
      },
      microphone: {
        active: Boolean(sensorData.microphone?.active ?? DEFAULT_SENSOR_DATA.microphone.active),
        level: Number(sensorData.microphone?.level ?? DEFAULT_SENSOR_DATA.microphone.level),
        noiseDetected: Boolean(sensorData.microphone?.noiseDetected ?? false),
      },
      temperature: {
        active: Boolean(sensorData.temperature?.active ?? DEFAULT_SENSOR_DATA.temperature.active),
        current: Number(sensorData.temperature?.current ?? DEFAULT_SENSOR_DATA.temperature.current),
        min: Number(sensorData.temperature?.min ?? DEFAULT_SENSOR_DATA.temperature.min),
        max: Number(sensorData.temperature?.max ?? DEFAULT_SENSOR_DATA.temperature.max),
        unit: sensorData.temperature?.unit === "F" ? "F" : "C",
        alert: Boolean(sensorData.temperature?.alert ?? false),
      },
    };

    return NextResponse.json({
      procedureId: procedureId ?? "default",
      data: validatedData,
      timestamp: Date.now(),
      source: "simulation",
      message: "Sensor data updated successfully",
    });
  } catch {
    return NextResponse.json({ error: "Failed to update sensor data" }, { status: 500 });
  }
}
