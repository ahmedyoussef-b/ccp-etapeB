"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Volume2, VolumeX, Play, Square, MessageSquare, Clock, AlertTriangle, CheckCircle2, Mic, MicOff } from "lucide-react";
import { useSpeech } from "@/lib/speech/use-speech";

interface VoiceOutputEntry {
  id: string;
  text: string;
  timestamp: Date;
  type: "result" | "alert" | "status" | "error";
}

interface VoiceOutputProps {
  deviceName: string;
  autoReadResults?: boolean;
}

export function VoiceOutput({ deviceName, autoReadResults = true }: VoiceOutputProps) {
  const [entries, setEntries] = useState<VoiceOutputEntry[]>([]);
  const { isSpeaking, speak, stopSpeaking, isListening, transcript, toggleListening } =
    useSpeech({ language: "fr-FR", continuous: false });

  const addEntry = useCallback(
    (text: string, type: VoiceOutputEntry["type"]) => {
      const entry: VoiceOutputEntry = {
        id: `${Date.now()}-${Math.random()}`,
        text,
        timestamp: new Date(),
        type,
      };
      setEntries((prev) => [entry, ...prev].slice(0, 50));

      if (autoReadResults && type !== "status") {
        speak(text);
      }
    },
    [speak, autoReadResults]
  );

  const handleSimulateResult = useCallback(() => {
    addEntry("Résultat de la caméra : aucune anomalie détectée.", "result");
  }, [addEntry]);

  const handleSimulateAlert = useCallback(() => {
    addEntry("Alerte température : seuil dépassé — 38.2°C détecté.", "alert");
  }, [addEntry]);

  const handleSimulateError = useCallback(() => {
    addEntry("Erreur de communication avec le détecteur de température.", "error");
  }, [addEntry]);

  const handleSimulateStatus = useCallback(() => {
    addEntry("Tous les capteurs fonctionnent normalement.", "status");
  }, [addEntry]);

  const typeConfig = {
    result: { icon: Play, color: "text-primary", bg: "bg-primary/10", border: "border-l-primary", label: "Résultat" },
    alert: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-l-amber-500", label: "Alerte" },
    error: { icon: Square, color: "text-red-500", bg: "bg-red-500/10", border: "border-l-red-500", label: "Erreur" },
    status: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-l-emerald-500", label: "Statut" },
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Volume2 className="h-4 w-4 text-primary" />
            Sortie vocale — {deviceName}
          </h3>
          <div className="flex items-center gap-1.5">
            {isSpeaking && (
              <div className="flex items-center gap-0.5">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}
            <span className="text-[10px] text-muted-foreground font-medium">
              {isSpeaking ? "Parle..." : isListening ? "Écoute..." : "Prêt"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={isListening ? "destructive" : "default"}
            size="sm"
            onClick={toggleListening}
            className="gap-1.5 text-xs"
          >
            {isListening ? (
              <>
                <MicOff className="h-3.5 w-3.5" />
                Arrêter
              </>
            ) : (
              <>
                <Mic className="h-3.5 w-3.5" />
                Écouter
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={stopSpeaking}
            disabled={!isSpeaking}
            className="gap-1.5 text-xs"
          >
            <VolumeX className="h-3.5 w-3.5" />
            Arrêter voix
          </Button>
          {isListening && transcript && (
            <Badge variant="secondary" className="text-[10px] animate-pulse">
              {transcript}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" onClick={handleSimulateResult} className="text-[10px] gap-1">
            <Play className="h-3 w-3" />
            Résultat caméra
          </Button>
          <Button variant="outline" size="sm" onClick={handleSimulateAlert} className="text-[10px] gap-1">
            <AlertTriangle className="h-3 w-3" />
            Alerte temp
          </Button>
          <Button variant="outline" size="sm" onClick={handleSimulateError} className="text-[10px] gap-1">
            <Square className="h-3 w-3" />
            Erreur capteur
          </Button>
          <Button variant="outline" size="sm" onClick={handleSimulateStatus} className="text-[10px] gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Statut OK
          </Button>
        </div>

        <ScrollArea className="h-[180px] rounded-xl border border-border/50 bg-muted/20 p-3">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-xs text-muted-foreground">Aucune sortie vocale</p>
              <p className="mt-1 text-[10px] text-muted-foreground/50">Utilisez les boutons ou la reconnaissance vocale</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => {
                const config = typeConfig[entry.type];
                const Icon = config.icon;
                return (
                  <div
                    key={entry.id}
                    className={`border-l-2 ${config.border} pl-3 py-2 rounded-r-lg bg-background/50 transition-colors hover:bg-background/80`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className={`inline-flex h-4 w-4 items-center justify-center rounded ${config.bg}`}>
                        <Icon className={`h-2.5 w-2.5 ${config.color}`} />
                      </div>
                      <Badge variant="outline" className="text-[8px] px-1.5 py-0">
                        {config.label}
                      </Badge>
                      <span className="text-[9px] text-muted-foreground flex items-center gap-1 ml-auto">
                        <Clock className="h-2 w-2" />
                        {entry.timestamp.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-foreground leading-relaxed pl-6">{entry.text}</p>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}