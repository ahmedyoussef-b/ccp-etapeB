"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeviceConnection } from "./device-connection";
import { SensorReadings } from "./sensor-readings";
import { ActuatorControl } from "./actuator-control";
import { VoiceOutput } from "./voice-output";
import { Cpu, Cable, Activity, Gauge, Radio, Zap } from "lucide-react";

interface EmbeddedSystemPanelProps {
  deviceName?: string;
}

export function EmbeddedSystemPanel({ deviceName = "Embarqué #01" }: EmbeddedSystemPanelProps) {
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-foreground">
                  Système embarqué
                </CardTitle>
                <p className="text-xs text-muted-foreground">{deviceName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-medium text-emerald-600">En ligne</span>
              </div>
              <Badge variant="outline" className="text-[10px]">
                <Radio className="h-3 w-3 mr-1" />
                IoT
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-muted/30 p-3 border border-border/30">
              <div className="flex items-center gap-2 mb-1">
                <Cable className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-[10px] text-muted-foreground font-medium">Connexion</span>
              </div>
              <p className="text-sm font-semibold text-foreground">Sans fil</p>
              <p className="text-[10px] text-muted-foreground">Wi-Fi · RSSI -42 dBm</p>
            </div>
            <div className="rounded-xl bg-muted/30 p-3 border border-border/30">
              <div className="flex items-center gap-2 mb-1">
                <Gauge className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-[10px] text-muted-foreground font-medium">Capteurs</span>
              </div>
              <p className="text-sm font-semibold text-foreground">3 actifs</p>
              <p className="text-[10px] text-muted-foreground">Caméra · Micro · Temp</p>
            </div>
            <div className="rounded-xl bg-muted/30 p-3 border border-border/30">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[10px] text-muted-foreground font-medium">Actionneurs</span>
              </div>
              <p className="text-sm font-semibold text-foreground">0 actif(s)</p>
              <p className="text-[10px] text-muted-foreground">3 disponibles</p>
            </div>
            <div className="rounded-xl bg-muted/30 p-3 border border-border/30">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-3.5 w-3.5 text-violet-500" />
                <span className="text-[10px] text-muted-foreground font-medium">Voix</span>
              </div>
              <p className="text-sm font-semibold text-foreground">Prêt</p>
              <p className="text-[10px] text-muted-foreground">Synthèse vocale active</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="lg:row-span-2">
          <DeviceConnection deviceName={deviceName} initialType="wireless" initialStatus="connected" />
        </Card>

        <Card className="lg:col-span-2">
          <SensorReadings deviceName={deviceName} />
        </Card>

        <Card>
          <ActuatorControl deviceName={deviceName} />
        </Card>

        <Card>
          <VoiceOutput deviceName={deviceName} />
        </Card>
      </div>
    </div>
  );
}