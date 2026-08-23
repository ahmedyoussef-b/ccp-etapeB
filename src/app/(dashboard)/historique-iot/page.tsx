"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, History, RefreshCw, Filter } from "lucide-react";
import { clientEngine, type IotHistoryEntry } from "@/lib/client-engine";

export default function HistoriqueIotPage() {
  const [history, setHistory] = useState<IotHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "alerts">("all");

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      await clientEngine.init();
      const entries = filter === "alerts"
        ? await clientEngine.getIotHistory(200).then((all) => all.filter((e) => e.alert))
        : await clientEngine.getIotHistory(200);
      setHistory(entries);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const grouped = history.reduce<Record<string, IotHistoryEntry[]>>((acc, entry) => {
    const key = entry.entityId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Historique IoT</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Journal des changements d&apos;état des capteurs et actionneurs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
            className="gap-1.5 text-xs"
          >
            <History className="h-3.5 w-3.5" />
            Tout
          </Button>
          <Button
            variant={filter === "alerts" ? "destructive" : "outline"}
            size="sm"
            onClick={() => setFilter("alerts")}
            className="gap-1.5 text-xs"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Alertes
          </Button>
          <Button variant="outline" size="sm" onClick={loadHistory} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {history.length === 0 && !loading && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Aucune entrée d&apos;historique pour le moment.
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {Object.entries(grouped).map(([entityId, entries]) => {
          const latest = entries[0];
          const label = latest.entityType === "sensor" ? "Capteur" : "Actionneur";
          return (
            <Card key={entityId} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Filter className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold text-foreground">
                        {label} — {latest.entityId}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {entries.length} entrée{entries.length > 1 ? "s" : ""} dans l&apos;historique
                      </p>
                    </div>
                  </div>
                  {entries.some((e) => e.alert) && (
                    <Badge variant="destructive" className="gap-1 text-[10px]">
                      <AlertTriangle className="h-3 w-3" />
                      Alertes détectées
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[240px] rounded-xl border border-border/50 bg-muted/20">
                  <div className="p-3 space-y-2">
                    {entries.map((entry) => (
                      <div
                        key={entry.id}
                        className={`flex items-start justify-between rounded-lg border p-3 transition-colors ${
                          entry.alert
                            ? "border-red-500/30 bg-red-500/5"
                            : "border-border/50 bg-background/50"
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-foreground">{entry.field}</span>
                            {entry.alert && (
                              <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                                Alerte
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {entry.oldValue ? `${entry.oldValue} → ` : ""}
                            <span className="font-medium text-foreground">{entry.newValue}</span>
                          </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-3">
                          {new Date(entry.createdAt).toLocaleString("fr-FR")}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
