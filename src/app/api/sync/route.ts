import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const SyncPayloadSchema = z.object({
  procedureExecutions: z.array(z.any()).optional(),
  mediaCaptured: z.array(z.any()).optional(),
  etatDesLieux: z.array(z.any()).optional(),
  iotData: z.object({
    sensorConfigs: z.array(z.any()).optional(),
    actuatorStates: z.array(z.any()).optional(),
  }).optional(),
});

const MAX_SYNC_MEDIA_BYTES = 4.5 * 1024 * 1024;

function isMediaPayloadTooLarge(media: unknown): boolean {
  if (!media || typeof media !== 'object') return false;
  const record = media as Record<string, unknown>;
  const size = typeof record.size === 'number' ? record.size : 0;
  return size > MAX_SYNC_MEDIA_BYTES;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const payload = SyncPayloadSchema.parse(body);

    if (payload.mediaCaptured && payload.mediaCaptured.length > 0) {
      const oversized = payload.mediaCaptured.find(isMediaPayloadTooLarge);
      if (oversized) {
        return NextResponse.json({ success: false, error: 'Media payload too large for sync. Use blob storage for media files.' }, { status: 413 });
      }
    }

    const synced: { executions: number; media: number } = { executions: 0, media: 0 };

    if (payload.procedureExecutions && payload.procedureExecutions.length > 0) {
      for (const exec of payload.procedureExecutions) {
        const execution = await prisma.procedureExecution.create({
          data: {
            procedureId: exec.procedureId ?? 0,
            userId: exec.userId,
            userName: exec.userName,
            userRole: exec.userRole,
            phase: exec.phase ?? 'briefing',
            currentStepIndex: exec.currentStepIndex ?? 0,
            completedSteps: exec.completedSteps ?? [],
            startedAt: new Date(exec.startedAt ?? Date.now()),
            finishedAt: exec.finishedAt ? new Date(exec.finishedAt) : null,
            anomalies: exec.anomalies ?? [],
            globalElapsed: exec.globalElapsed ?? 0,
          },
        });

        if (exec.steps && Array.isArray(exec.steps)) {
          await prisma.executionStep.createMany({
            data: exec.steps.map((step: {
              stepId: string;
              stepOrder: number;
              title: string;
              type: string;
              isMandatory?: boolean;
              isCompleted?: boolean;
              timerEnabled?: boolean;
              timerSeconds?: number;
              startedAt?: string;
              finishedAt?: string;
              anomaly?: string;
            }) => ({
              executionId: execution.id,
              stepId: step.stepId,
              stepOrder: step.stepOrder,
              title: step.title,
              type: step.type,
              isMandatory: step.isMandatory ?? false,
              isCompleted: step.isCompleted ?? false,
              timerEnabled: step.timerEnabled ?? false,
              timerSeconds: step.timerSeconds ?? 0,
              startedAt: step.startedAt ? new Date(step.startedAt) : null,
              finishedAt: step.finishedAt ? new Date(step.finishedAt) : null,
              anomaly: step.anomaly ?? null,
            })),
          });
        }

        if (exec.media && Array.isArray(exec.media)) {
          await prisma.executionMedia.createMany({
            data: exec.media.map((m: {
              stepId: string;
              type: string;
              url?: string;
              filename?: string;
              mimeType?: string;
              size?: number;
              geolocation?: unknown;
              capturedAt?: string;
            }) => ({
              executionId: execution.id,
              stepId: m.stepId,
              type: m.type,
              url: m.url ?? null,
              filename: m.filename ?? null,
              mimeType: m.mimeType ?? null,
              size: m.size ?? null,
              geolocation: m.geolocation ?? null,
              capturedAt: m.capturedAt ? new Date(m.capturedAt) : new Date(),
            })),
          });
        }

        synced.executions++;
      }
    }

    if (payload.mediaCaptured && payload.mediaCaptured.length > 0) {
      for (const media of payload.mediaCaptured) {
        await prisma.executionMedia.create({
          data: {
            executionId: media.executionId ?? null,
            stepId: media.stepId ?? 'unknown',
            type: media.type,
            url: media.url ?? null,
            filename: media.filename ?? null,
            mimeType: media.mimeType ?? null,
            size: media.size ?? null,
            geolocation: media.geolocation ?? null,
            capturedAt: media.capturedAt ? new Date(media.capturedAt) : new Date(),
          },
        });
        synced.media++;
      }
    }

    if (payload.etatDesLieux && payload.etatDesLieux.length > 0) {
      console.log('[Sync] etatDesLieux received (no Prisma model yet):', payload.etatDesLieux.length, 'items');
    }

    if (payload.iotData) {
      const { sensorConfigs, actuatorStates } = payload.iotData;

      if (sensorConfigs && sensorConfigs.length > 0) {
        for (const sensor of sensorConfigs) {
          try {
            await prisma.iotSensorState.upsert({
              where: { id: sensor.id },
              update: {
                name: sensor.name,
                type: sensor.type,
                value: sensor.value,
                unit: sensor.unit,
                threshold: sensor.threshold,
                updatedAt: new Date(sensor.updatedAt),
              },
              create: {
                id: sensor.id,
                name: sensor.name,
                type: sensor.type,
                value: sensor.value,
                unit: sensor.unit,
                threshold: sensor.threshold,
                updatedAt: new Date(sensor.updatedAt),
              },
            });
          } catch {
            // ignore individual sensor sync errors
          }
        }
      }

      if (actuatorStates && actuatorStates.length > 0) {
        for (const actuator of actuatorStates) {
          try {
            await prisma.iotActuatorState.upsert({
              where: { id: actuator.id },
              update: {
                name: actuator.name,
                type: actuator.type,
                isOn: actuator.isOn,
                position: actuator.position ?? null,
                updatedAt: new Date(actuator.updatedAt),
              },
              create: {
                id: actuator.id,
                name: actuator.name,
                type: actuator.type,
                isOn: actuator.isOn,
                position: actuator.position ?? null,
                updatedAt: new Date(actuator.updatedAt),
              },
            });
          } catch {
            // ignore individual actuator sync errors
          }
        }
      }
    }

    return NextResponse.json({ success: true, synced });
  } catch (error) {
    console.error('Sync Error:', error);
    return NextResponse.json({ success: false, error: 'Sync failed' }, { status: 500 });
  }
}
