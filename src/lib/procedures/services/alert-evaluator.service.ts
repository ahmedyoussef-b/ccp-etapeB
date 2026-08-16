import { TAlarmConfig, TStep } from "@/lib/procedures/services/validator.service";

export interface TriggeredAlarm {
  alarm: TAlarmConfig;
  stepId: string;
  stepTitle: string;
  triggeredAt: number;
  sensorValue: unknown;
  severity: "DANGER" | "WARNING" | "INFO" | "SECURITY_CHECK";
}

export interface SensorData {
  camera: {
    active: boolean;
    resolution: string;
    fps: number;
    motionDetected: boolean;
  };
  microphone: {
    active: boolean;
    level: number;
    noiseDetected: boolean;
  };
  temperature: {
    active: boolean;
    current: number;
    min: number;
    max: number;
    unit: "C" | "F";
    alert: boolean;
  };
}

export type Operator = ">" | "<" | ">=" | "<=" | "==" | "!=" | "contains";

interface ConditionParseResult {
  sensorPath: string;
  operator: Operator;
  threshold: number | string | boolean;
}

function parseCondition(condition: string): ConditionParseResult | null {
  const trimmed = condition.trim();
  const operators: Operator[] = [">=", "<=", "==", "!=", ">", "<", "contains"];
  for (const op of operators) {
    const idx = trimmed.indexOf(op);
    if (idx !== -1) {
      const sensorPath = trimmed.slice(0, idx).trim();
      const thresholdStr = trimmed.slice(idx + op.length).trim();
      let threshold: number | string | boolean = thresholdStr;
      if (op !== "contains") {
        const num = Number(thresholdStr);
        if (!isNaN(num)) threshold = num;
      }
      return { sensorPath, operator: op, threshold };
    }
  }
  return null;
}

function resolveSensorValue(sensorPath: string, sensorData: SensorData): unknown {
  const parts = sensorPath.split(".");
  let current: unknown = sensorData;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function evaluateComparison(
  actual: unknown,
  operator: Operator,
  threshold: number | string | boolean
): boolean {
  if (operator === "contains") {
    if (typeof actual === "string" && typeof threshold === "string") {
      return actual.toLowerCase().includes(threshold.toLowerCase());
    }
    if (Array.isArray(actual)) {
      return actual.some((item) => String(item).toLowerCase().includes(String(threshold).toLowerCase()));
    }
    return false;
  }
  if (typeof actual !== "number" || typeof threshold !== "number") return false;
  switch (operator) {
    case ">": return actual > threshold;
    case "<": return actual < threshold;
    case ">=": return actual >= threshold;
    case "<=": return actual <= threshold;
    case "==": return actual === threshold;
    case "!=": return actual !== threshold;
    default: return false;
  }
}

export function evaluateAlarms(
  alarms: TAlarmConfig[],
  sensorData: SensorData,
  stepId: string,
  stepTitle: string
): TriggeredAlarm[] {
  const triggered: TriggeredAlarm[] = [];
  const now = Date.now();

  for (const alarm of alarms) {
    const parsed = parseCondition(alarm.condition);
    if (!parsed) continue;

    const actualValue = resolveSensorValue(parsed.sensorPath, sensorData);
    if (actualValue === undefined) continue;

    const thresholdValue = parsed.threshold;
    const isTriggered = evaluateComparison(actualValue, parsed.operator, thresholdValue);

    if (isTriggered) {
      triggered.push({
        alarm,
        stepId,
        stepTitle,
        triggeredAt: now,
        sensorValue: actualValue,
        severity: alarm.type,
      });
    }
  }

  return triggered;
}

export function evaluateAllStepAlarms(
  steps: TStep[],
  sensorData: SensorData,
  currentStepId?: string
): TriggeredAlarm[] {
  const allTriggered: TriggeredAlarm[] = [];
  for (const step of steps) {
    if (step.alarms.length === 0) continue;
    if (currentStepId && step.id !== currentStepId) continue;
    const triggered = evaluateAlarms(step.alarms, sensorData, step.id, step.title);
    allTriggered.push(...triggered);
  }
  return allTriggered;
}
