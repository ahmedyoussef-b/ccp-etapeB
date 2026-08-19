"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Power, Activity, AlertTriangle, Loader2 } from "lucide-react";
import { clientEngine } from "@/lib/client-engine";

interface ActuatorConfig {
  id: string;
  name: string;
  type: "relay" | "servo" | "led" | "motor" | "valve";
  icon: React.ReactNode;
  enabled: boolean;
  state: "idle" | "active" | "error";
  description: string;
}

interface ActuatorControlProps {
  deviceName: string;
  actuators?: ActuatorConfig[];
}

const DEFAULT_ACTUATORS: ActuatorConfig[] = [
  {
    id: "relay-1",
    name: "Relais principal",
    type: "relay",
    icon: <Power className="h-4 w-4" />,
    enabled: false,
    state: "idle",
    description: "Contrôle d'alimentation principale",
  },
  {
    id: "servo-1",
    name: "Servo d'orientation",
    type: "servo",
    icon: <Activity className="h-4 w-4" />,
    enabled: false,
    state: "idle",
    description: "Orientation du capteur",
  },
  {
    id: "led-1",
    name: "LED indicateur",
    type: "led",
    icon: <AlertTriangle className="h-4 w-4" />,
    enabled: false,
    state: "idle",
    description: "Signal lumineux d'alerte",
  },
];

async function seedActuatorStatesIfNeeded() {
  const existing = await clientEngine.getAllActuatorStates();
  if (existing.length > 0) return existing;

  const defaults = [
    { id: "relay-1", name: "Relais principal", type: "relay", isOn: false, position: null },
    { id: "servo-1", name: "Servo d'orientation", type: "servo", isOn: false, position: 90 },
    { id: "led-1", name: "LED indicateur", type: "led", isOn: false, position: null },
  ];

  for (const state of defaults) {
    await clientEngine.upsertActuatorState(state);
  }

  return defaults.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    isOn: s.isOn,
    position: s.position,
    updatedAt: new Date().toISOString(),
  }));
}

export function ActuatorControl({ deviceName, actuators: initialActuators }: ActuatorControlProps) {
  const [actuators, setActuators] = useState<ActuatorConfig[]>(initialActuators ?? DEFAULT_ACTUATORS);
  const [activating, setActivating] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        await clientEngine.init();
        const states = await seedActuatorStatesIfNeeded();

        if (!active) return;

        const mapped: ActuatorConfig[] = states.map((s) => {
          const base = DEFAULT_ACTUATORS.find((d) => d.id === s.id) ?? DEFAULT_ACTUATORS[0];
          return {
            ...base,
            id: s.id,
            name: s.name,
            type: s.type as ActuatorConfig["type"],
            enabled: s.isOn,
            state: s.isOn ? "active" : "idle",
          };
        });

        setActuators(mapped);
      } catch {
        // ignore load errors, keep defaults
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const handleToggle = async (id: string) => {
    if (activating !== null) return;

    setActivating(id);
    const actuator = actuators.find((a) => a.id === id);
    if (!actuator) return;

    const newState = actuator.state === "active" ? "idle" : "active";
    const newIsOn = newState === "active";

    setTimeout(async () => {
      setActuators((prev) =>
        prev.map((a) => (a.id === id ? { ...a, state: newState, enabled: newIsOn } : a))
      );
      setActivating(null);

      try {
        await clientEngine.upsertActuatorState({
          id,
          name: actuator.name,
          type: actuator.type,
          isOn: newIsOn,
          position: actuator.type === "servo" ? 90 : null,
        });
        await clientEngine.syncIotMetadata();
      } catch {
        // ignore sync errors
      }
    }, 800);
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Activity className="h-4 w-4 text-primary" />
            Actionneurs — {deviceName}
          </h3>
          <span className="text-[10px] text-muted-foreground">
            {actuators.filter((a) => a.state === "active").length} actif(s)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {actuators.map((actuator) => (
            <div
              key={actuator.id}
              className={`relative rounded-xl border p-4 transition-all duration-300 ${
                actuator.state === "active"
                  ? "border-primary/30 bg-primary/5 shadow-sm shadow-primary/10"
                  : actuator.state === "error"
                    ? "border-red-500/30 bg-red-500/5"
                    : "border-border/50 bg-card hover:border-primary/20"
              }`}
            >
              {activating === actuator.id && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/60 backdrop-blur-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}

              <div className="flex items-start justify-between mb-3">
                <div
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-300 ${
                    actuator.state === "active"
                      ? "bg-primary/10 text-primary"
                      : actuator.state === "error"
                        ? "bg-red-500/10 text-red-500"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {actuator.icon}
                </div>
                <Switch
                  checked={actuator.state === "active"}
                  onCheckedChange={() => handleToggle(actuator.id)}
                  disabled={activating !== null}
                  aria-label={`Toggle ${actuator.name}`}
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">{actuator.name}</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{actuator.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground font-medium capitalize">
                    {actuator.type}
                  </span>
                  <span
                    className={`text-[9px] font-medium ${
                      actuator.state === "active"
                        ? "text-emerald-600"
                        : actuator.state === "error"
                          ? "text-red-600"
                          : "text-muted-foreground"
                    }`}
                  >
                    {actuator.state === "active" ? "● Actif" : actuator.state === "error" ? "● Erreur" : "○ Inactif"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
