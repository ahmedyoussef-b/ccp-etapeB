"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Thermometer, Video, MicOff, AlertTriangle, ScanEye } from "lucide-react";
import { clientEngine } from "@/lib/client-engine";

interface SensorData {
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

interface SensorReadingsProps {
  deviceName: string;
  initialData?: SensorData;
}

const DEFAULT_SENSOR_DATA: SensorData = {
  camera: { active: true, resolution: "1920x1080", fps: 30, motionDetected: false },
  microphone: { active: true, level: 45, noiseDetected: false },
  temperature: { active: true, current: 22.5, min: 18, max: 35, unit: "C", alert: false },
};

async function seedSensorConfigsIfNeeded() {
  const existing = await clientEngine.getAllSensorConfigs();
  if (existing.length > 0) return existing;

  const defaults = [
    { id: "camera-main", name: "Caméra principale", type: "camera", value: 1, unit: "active", threshold: 1 },
    { id: "mic-main", name: "Micro principal", type: "microphone", value: 45, unit: "%", threshold: 80 },
    { id: "temp-main", name: "Température principale", type: "temperature", value: 22.5, unit: "°C", threshold: 35 },
  ];

  for (const cfg of defaults) {
    await clientEngine.upsertSensorConfig(cfg);
  }

  return defaults.map((cfg) => ({
    id: cfg.id,
    name: cfg.name,
    type: cfg.type,
    value: cfg.value,
    unit: cfg.unit,
    threshold: cfg.threshold,
    updatedAt: new Date().toISOString(),
  }));
}

export function SensorReadings({ deviceName, initialData }: SensorReadingsProps) {
  const [sensorData, setSensorData] = useState<SensorData>(initialData ?? DEFAULT_SENSOR_DATA);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        await clientEngine.init();
        const configs = await seedSensorConfigsIfNeeded();

        if (!active) return;

        const mapped: SensorData = { ...DEFAULT_SENSOR_DATA };
        for (const cfg of configs) {
          if (cfg.type === "camera") {
            mapped.camera.active = cfg.value === 1;
            mapped.camera.motionDetected = false;
          } else if (cfg.type === "microphone") {
            mapped.microphone.active = true;
            mapped.microphone.level = Math.max(0, Math.min(100, cfg.value));
            mapped.microphone.noiseDetected = false;
          } else if (cfg.type === "temperature") {
            mapped.temperature.active = true;
            mapped.temperature.current = cfg.value;
            mapped.temperature.alert = cfg.value > cfg.threshold;
          }
        }

        setSensorData(mapped);
        setLoaded(true);
      } catch {
        // ignore load errors, keep defaults
        setLoaded(true);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;

    const interval = setInterval(() => {
      setSensorData((prev) => {
        const next: SensorData = {
          camera: {
            ...prev.camera,
            motionDetected: Math.random() > 0.85,
          },
          microphone: {
            ...prev.microphone,
            level: Math.max(0, Math.min(100, prev.microphone.level + (Math.random() - 0.5) * 20)),
            noiseDetected: Math.random() > 0.9,
          },
          temperature: {
            ...prev.temperature,
            current: Math.round((prev.temperature.current + (Math.random() - 0.5) * 0.5) * 10) / 10,
            alert: Math.random() > 0.95,
          },
        };

        clientEngine.upsertSensorConfig({
          id: "camera-main",
          name: "Caméra principale",
          type: "camera",
          value: next.camera.active ? 1 : 0,
          unit: "active",
          threshold: 1,
        }).catch(() => {});

        clientEngine.upsertSensorConfig({
          id: "mic-main",
          name: "Micro principal",
          type: "microphone",
          value: next.microphone.level,
          unit: "%",
          threshold: 80,
        }).catch(() => {});

        clientEngine.upsertSensorConfig({
          id: "temp-main",
          name: "Température principale",
          type: "temperature",
          value: next.temperature.current,
          unit: "°C",
          threshold: 35,
        }).catch(() => {});

        return next;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [loaded]);

  useEffect(() => {
    if (!loaded) return;
    const syncInterval = setInterval(() => {
      clientEngine.syncIotMetadata().catch(() => {});
    }, 10000);
    return () => clearInterval(syncInterval);
  }, [loaded]);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <ScanEye className="h-4 w-4 text-primary" />
            Capteurs — {deviceName}
          </h3>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-muted-foreground font-medium">LIVE</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="group relative rounded-xl border border-border/50 bg-card overflow-hidden transition-all hover:border-primary/30">
            <div className="relative aspect-video bg-muted/30 flex items-center justify-center">
              {sensorData.camera.active ? (
                <>
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
                  <div className="relative w-full h-full flex items-center justify-center">
                    <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                      <div className="text-center">
                        <Video className="h-8 w-8 text-primary/40 mx-auto mb-2" />
                        <p className="text-[10px] text-primary/60 font-medium">{sensorData.camera.resolution}</p>
                        <p className="text-[10px] text-muted-foreground">{sensorData.camera.fps} fps</p>
                      </div>
                    </div>
                    {sensorData.camera.motionDetected && (
                      <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/90 backdrop-blur-sm">
                        <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                        <span className="text-[9px] font-bold text-white">MOUVEMENT</span>
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/50 backdrop-blur-sm">
                      <span className="text-[9px] text-white font-mono">REC</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Video className="h-8 w-8 opacity-30" />
                  <span className="text-[10px] font-medium">Inactive</span>
                </div>
              )}
            </div>
            <div className="p-3 border-t border-border/50">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-medium">Caméra</span>
                <Badge variant={sensorData.camera.active ? "default" : "secondary"} className="text-[9px]">
                  {sensorData.camera.active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="group relative rounded-xl border border-border/50 bg-card p-4 transition-all hover:border-primary/30">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Microphone</span>
              <Badge variant={sensorData.microphone.active ? "default" : "secondary"} className="text-[9px]">
                {sensorData.microphone.active ? "Actif" : "Muet"}
              </Badge>
            </div>
            {sensorData.microphone.active ? (
              <>
                <div className="space-y-3">
                  <div className="flex items-end gap-1 h-10">
                    {Array.from({ length: 20 }).map((_, i) => {
                      const h = Math.max(4, sensorData.microphone.level * (0.5 + Math.random() * 0.5));
                      return (
                        <div
                          key={i}
                          className={`flex-1 rounded-sm transition-all duration-300 ${
                            h < 30
                              ? "bg-emerald-500"
                              : h < 60
                                ? "bg-amber-500"
                                : "bg-red-500"
                          }`}
                          style={{ height: `${h}%` }}
                        />
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Niveau audio</span>
                    <span className="text-[10px] font-mono text-foreground">{Math.round(sensorData.microphone.level)}%</span>
                  </div>
                </div>
                {sensorData.microphone.noiseDetected && (
                  <div className="mt-3 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                    <span className="text-[10px] font-medium text-amber-600">Bruit détecté</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <MicOff className="h-6 w-6 opacity-30 mb-2" />
                <span className="text-[10px] font-medium">Inactif</span>
              </div>
            )}
          </div>

          <div className="group relative rounded-xl border border-border/50 bg-card p-4 transition-all hover:border-primary/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Température</span>
              <Badge variant={sensorData.temperature.alert ? "destructive" : "secondary"} className="text-[9px]">
                {sensorData.temperature.alert ? "Alerte" : "Normal"}
              </Badge>
            </div>
            {sensorData.temperature.active ? (
              <>
                <div className="text-center py-2">
                  <span
                    className={`text-3xl font-bold font-mono tabular-nums ${
                      sensorData.temperature.alert ? "text-red-500" : "text-foreground"
                    }`}
                  >
                    {sensorData.temperature.current}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">°{sensorData.temperature.unit}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-muted/30 p-2 text-center">
                    <span className="text-[9px] text-muted-foreground block">Min</span>
                    <span className="text-xs font-semibold text-foreground">{sensorData.temperature.min}°{sensorData.temperature.unit}</span>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2 text-center">
                    <span className="text-[9px] text-muted-foreground block">Max</span>
                    <span className="text-xs font-semibold text-foreground">{sensorData.temperature.max}°{sensorData.temperature.unit}</span>
                  </div>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      sensorData.temperature.current > 30
                        ? "bg-gradient-to-r from-red-500 to-red-400"
                        : sensorData.temperature.current > 25
                          ? "bg-gradient-to-r from-amber-500 to-amber-400"
                          : "bg-gradient-to-r from-emerald-500 to-emerald-400"
                    }`}
                    style={{
                      width: `${Math.min(100, ((sensorData.temperature.current - sensorData.temperature.min) / (sensorData.temperature.max - sensorData.temperature.min)) * 100)}%`,
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <Thermometer className="h-6 w-6 opacity-30 mb-2" />
                <span className="text-[10px] font-medium">Inactif</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
