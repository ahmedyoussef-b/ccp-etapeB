"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, RefreshCw, Bell, BellOff } from "lucide-react";
import { clientEngine, type IotHistoryEntry } from "@/lib/client-engine";

function playAlertSound() {
  try {
    const AudioContext = window.AudioContext || (window as unknown as Record<string, unknown>).webkitAudioContext as typeof window.AudioContext | undefined;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // ignore audio errors
  }
}

function requestNotificationPermission() {
  if (typeof window === "undefined") return;
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

export default function AlarmesActivesPage() {
  const [alarms, setAlarms] = useState<IotHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const previousCountRef = useRef(0);

  const loadAlarms = useCallback(async () => {
    try {
      await clientEngine.init();
      const active = await clientEngine.getActiveAlarms(200);
      setAlarms(active);

      if (active.length > previousCountRef.current && previousCountRef.current > 0) {
        const newAlarms = active.slice(0, active.length - previousCountRef.current);
        const hasNew = newAlarms.some((a) => a.alert);
        if (hasNew) {
          if (soundEnabled) playAlertSound();
          if (notificationsEnabled && "Notification" in window && Notification.permission === "granted") {
            const title = "Nouvelle alerte IoT";
            const body = `${newAlarms[0].entityId}: ${newAlarms[0].newValue}`;
            try {
              new Notification(title, { body, icon: "/icon.png" });
            } catch {
              // ignore notification errors
            }
          }
        }
      }
      previousCountRef.current = active.length;
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [notificationsEnabled, soundEnabled]);

  useEffect(() => {
    loadAlarms();
    const interval = setInterval(loadAlarms, 5000);
    return () => clearInterval(interval);
  }, [loadAlarms]);

  useEffect(() => {
    requestNotificationPermission();
    const stored = localStorage.getItem("nexaflow_iot_notifications");
    if (stored === "1") setNotificationsEnabled(true);
    const storedSound = localStorage.getItem("nexaflow_iot_sound");
    if (storedSound !== "0") setSoundEnabled(true);
  }, []);

  const handleAcknowledge = async (id: number) => {
    try {
      await clientEngine.acknowledgeAlarm(id);
      setAlarms((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // ignore
    }
  };

  const handleAcknowledgeAll = async () => {
    try {
      await clientEngine.acknowledgeAllAlarms();
      setAlarms([]);
    } catch {
      // ignore
    }
  };

  const toggleNotifications = () => {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    localStorage.setItem("nexaflow_iot_notifications", next ? "1" : "0");
    if (next) requestNotificationPermission();
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("nexaflow_iot_sound", next ? "1" : "0");
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Alarmes actives</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {alarms.length} alerte{alarms.length > 1 ? "s" : ""} non résolue{alarms.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={notificationsEnabled ? "default" : "outline"}
            size="sm"
            onClick={toggleNotifications}
            className="gap-1.5 text-xs"
          >
            {notificationsEnabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
            {notificationsEnabled ? "Notifications ON" : "Notifications OFF"}
          </Button>
          <Button
            variant={soundEnabled ? "default" : "outline"}
            size="sm"
            onClick={toggleSound}
            className="gap-1.5 text-xs"
          >
            {soundEnabled ? "Son ON" : "Son OFF"}
          </Button>
          <Button variant="outline" size="sm" onClick={loadAlarms} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
          {alarms.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleAcknowledgeAll} className="gap-1.5 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Tout acquitter
            </Button>
          )}
        </div>
      </div>

      {alarms.length === 0 && !loading && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            Aucune alarme active. Le système fonctionne normalement.
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {alarms.map((alarm) => (
          <Card key={alarm.id} className="overflow-hidden border-red-500/30 bg-red-500/5">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-foreground">{alarm.entityId}</span>
                      <Badge variant="destructive" className="text-[9px]">
                        {alarm.entityType === "sensor" ? "Capteur" : "Actionneur"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">Champ : {alarm.field}</p>
                    <p className="text-sm text-foreground">
                      {alarm.oldValue ? `${alarm.oldValue} → ` : ""}
                      <span className="font-semibold text-red-600">{alarm.newValue}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(alarm.createdAt).toLocaleString("fr-FR")}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAcknowledge(alarm.id)}
                  className="gap-1.5 text-xs"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Accusé réception
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
