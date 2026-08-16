import { SensorData, TriggeredAlarm } from "@/lib/procedures/services/alert-evaluator.service";

export type { SensorData, TriggeredAlarm } from "@/lib/procedures/services/alert-evaluator.service";

export type SensorClientEventType = "alert" | "data" | "connected" | "disconnected";

export interface SensorClientEvent {
  type: SensorClientEventType;
  data?: SensorData;
  alerts?: TriggeredAlarm[];
  timestamp?: number;
}

type EventListener = (event: SensorClientEvent) => void;

export const DEFAULT_SENSOR_DATA: SensorData = {
  camera: {
    active: true,
    resolution: "1920x1080",
    fps: 30,
    motionDetected: false,
  },
  microphone: {
    active: true,
    level: 45,
    noiseDetected: false,
  },
  temperature: {
    active: true,
    current: 22.5,
    min: 18,
    max: 35,
    unit: "C",
    alert: false,
  },
};

export class SensorClient {
  private listeners: Set<EventListener> = new Set();
  private simulationInterval: number | null = null;
  private ws: WebSocket | null = null;
  private isConnected = false;
  private websocketUrl: string | null = null;
  private currentData: SensorData = { ...DEFAULT_SENSOR_DATA };

  constructor(websocketUrl?: string) {
    this.websocketUrl = websocketUrl ?? null;
  }

  connect(): Promise<void> {
    if (this.isConnected) return Promise.resolve();

    if (this.websocketUrl) {
      return this.connectWebSocket(this.websocketUrl);
    }

    return this.startSimulation();
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.simulationInterval !== null) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    this.isConnected = false;
    this.emit({ type: "disconnected", timestamp: Date.now() });
  }

  getCurrentData(): SensorData {
    return { ...this.currentData };
  }

  on(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private startSimulation(): Promise<void> {
    return new Promise((resolve) => {
      this.isConnected = true;
      this.emit({ type: "connected", timestamp: Date.now() });
      this.emit({ type: "data", data: this.currentData, timestamp: Date.now() });

      this.simulationInterval = window.setInterval(() => {
        this.currentData = {
          camera: {
            ...this.currentData.camera,
            motionDetected: Math.random() > 0.85,
          },
          microphone: {
            ...this.currentData.microphone,
            level: Math.max(0, Math.min(100, this.currentData.microphone.level + (Math.random() - 0.5) * 20)),
            noiseDetected: Math.random() > 0.9,
          },
          temperature: {
            ...this.currentData.temperature,
            current: Math.round((this.currentData.temperature.current + (Math.random() - 0.5) * 0.5) * 10) / 10,
            alert: Math.random() > 0.95,
          },
        };
        this.emit({ type: "data", data: this.currentData, timestamp: Date.now() });
      }, 3000);

      resolve();
    });
  }

  private connectWebSocket(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          this.isConnected = true;
          this.emit({ type: "connected", timestamp: Date.now() });
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.sensorData) {
              this.currentData = message.sensorData as SensorData;
              this.emit({ type: "data", data: this.currentData, timestamp: Date.now() });

              if (message.alerts && Array.isArray(message.alerts)) {
                this.emit({
                  type: "alert",
                  alerts: message.alerts,
                  timestamp: Date.now(),
                });
              }
            }
          } catch {
            // ignore invalid messages
          }
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.ws = null;
          this.emit({ type: "disconnected", timestamp: Date.now() });
        };

        this.ws.onerror = () => {
          this.ws?.close();
          this.ws = null;
          this.isConnected = false;
          this.emit({ type: "disconnected", timestamp: Date.now() });
          reject(new Error("WebSocket connection failed"));
        };
      } catch {
        reject(new Error("Failed to create WebSocket"));
      }
    });
  }

  private emit(event: SensorClientEvent): void {
    for (const listener of Array.from(this.listeners)) {
      try {
        listener(event);
      } catch {
        // ignore listener errors
      }
    }
  }
}

export function createSensorClient(websocketUrl?: string): SensorClient {
  return new SensorClient(websocketUrl);
}
