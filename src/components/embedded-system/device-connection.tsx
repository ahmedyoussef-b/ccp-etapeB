"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cable, Wifi, Power, RotateCcw, WifiOff } from "lucide-react";

type ConnectionType = "cable" | "wireless" | "disconnected";
type ConnectionStatus = "connected" | "connecting" | "disconnected";

interface DeviceConnectionProps {
  deviceName: string;
  initialType?: ConnectionType;
  initialStatus?: ConnectionStatus;
}

export function DeviceConnection({
  deviceName,
  initialType = "wireless",
  initialStatus = "connected",
}: DeviceConnectionProps) {
  const [connectionType, setConnectionType] = useState<ConnectionType>(initialType);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(initialStatus);

  const handleConnect = () => {
    if (connectionType === "disconnected") return;
    setConnectionStatus("connecting");
    setTimeout(() => setConnectionStatus("connected"), 1500);
  };

  const handleDisconnect = () => setConnectionStatus("disconnected");

  const handleCycleConnection = () => {
    setConnectionType((prev) =>
      prev === "cable" ? "wireless" : prev === "wireless" ? "cable" : "wireless"
    );
    setConnectionStatus("disconnected");
  };

  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";

  return (
    <Card className="relative overflow-hidden">
      <div
        className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 transition-colors duration-700 ${
          isConnected ? "bg-emerald-500" : isConnecting ? "bg-amber-500" : "bg-muted"
        }`}
      />
      <CardContent className="relative p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className={`h-3 w-3 rounded-full transition-all duration-500 ${
                  isConnected
                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                    : isConnecting
                      ? "bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                      : "bg-muted-foreground"
                }`}
              />
              {isConnected && (
                <div className="absolute inset-0 h-3 w-3 rounded-full bg-emerald-500 animate-ping opacity-20" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{deviceName}</p>
              <p className="text-[11px] text-muted-foreground">
                {isConnected ? "En ligne" : isConnecting ? "Connexion en cours..." : "Hors ligne"}
              </p>
            </div>
          </div>
          <Badge
            variant={isConnected ? "default" : "secondary"}
            className="text-[10px] font-medium"
          >
            {isConnected ? "Connecté" : isConnecting ? "Connexion..." : "Déconnecté"}
          </Badge>
        </div>

        {connectionType !== "disconnected" && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40">
            {connectionType === "cable" ? (
              <Cable className="h-3.5 w-3.5 text-blue-500" />
            ) : (
              <Wifi className="h-3.5 w-3.5 text-violet-500" />
            )}
            <span className="text-[11px] text-muted-foreground font-medium">
              {connectionType === "cable" ? "USB / Ethernet" : "Wi-Fi / Bluetooth"}
            </span>
            <span className="ml-auto text-[10px] text-muted-foreground/60">
              {connectionType === "wireless" ? "RSSI: -42 dBm" : "Débit: 1 Gbps"}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {!isConnected ? (
            <Button
              variant="default"
              size="sm"
              onClick={handleConnect}
              disabled={isConnecting || connectionType === "disconnected"}
              className="flex-1 text-xs gap-1.5"
            >
              {isConnecting ? (
                <>
                  <RotateCcw className="h-3 w-3 animate-spin" />
                  Connexion...
                </>
              ) : (
                <>
                  <Power className="h-3 w-3" />
                  Connecter
                </>
              )}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              className="flex-1 text-xs gap-1.5"
            >
              <WifiOff className="h-3 w-3" />
              Déconnecter
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCycleConnection}
            className="text-xs"
            title="Changer type de connexion"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
