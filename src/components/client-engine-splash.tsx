"use client";

import { useEffect, useState } from "react";
import { clientEngine, ClientEngineStatus } from "@/lib/client-engine";
import { seedIfNeeded } from "@/lib/client-engine/seed";

export function ClientEngineSplash({ onReady }: { onReady: () => void }) {
  const [status, setStatus] = useState<ClientEngineStatus>({
    sqlite: false,
    vectorStore: false,
    jsonStore: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const result = await clientEngine.init();
        if (active) {
          setStatus(result);
          
          if (result.sqlite || result.vectorStore || result.jsonStore) {
            setSeeding(true);
            try {
              await seedIfNeeded();
            } catch {
              // ignore seed errors
            }
            setSeeding(false);
          }
          
          onReady();
        }
      } catch (err) {
        console.error("[ClientEngineSplash] init failed:", err);
        if (active) {
          setError(err instanceof Error ? err.message : "Initialization failed");
          onReady();
        }
      }
    }

    init();

    return () => {
      active = false;
    };
  }, [onReady]);

  const ready = status.sqlite && status.vectorStore && status.jsonStore;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-xl">
      <div className="w-full max-w-md px-6">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              NexaFlow
            </span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Initialisation du moteur local...
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border bg-card/50 p-4">
            <div className="flex items-center gap-3">
              <div className={`h-2.5 w-2.5 rounded-full ${status.sqlite ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`} />
              <span className="text-sm font-medium">SQLite (OPFS)</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {status.sqlite ? "Prêt" : "Chargement..."}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-card/50 p-4">
            <div className="flex items-center gap-3">
              <div className={`h-2.5 w-2.5 rounded-full ${status.vectorStore ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`} />
              <span className="text-sm font-medium">Vector Store (IndexedDB)</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {status.vectorStore ? "Prêt" : "Chargement..."}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-card/50 p-4">
            <div className="flex items-center gap-3">
              <div className={`h-2.5 w-2.5 rounded-full ${status.jsonStore ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`} />
              <span className="text-sm font-medium">JSON Store (IndexedDB)</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {status.jsonStore ? "Prêt" : "Chargement..."}
            </span>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Erreur: {error}
          </div>
        )}

        {ready && !error && (
          <div className="mt-6 text-center">
            {seeding ? (
              <p className="text-sm font-medium text-yellow-500">Importation des données initiales...</p>
            ) : (
              <>
                <p className="text-sm font-medium text-green-500">Moteur local prêt</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Les bases de données sont stockées localement sur votre appareil.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
