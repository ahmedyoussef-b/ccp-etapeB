'use client';

import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { clientEngine, ClientEngineStatus } from '@/lib/client-engine';

interface ClientEngineContextValue {
  status: ClientEngineStatus;
  initialized: boolean;
  engine: typeof clientEngine;
}

const ClientEngineContext = createContext<ClientEngineContextValue | null>(null);

export function useClientEngine() {
  const context = useContext(ClientEngineContext);
  if (!context) {
    throw new Error('useClientEngine must be used within ClientEngineProvider');
  }
  return context;
}

export function ClientEngineProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ClientEngineStatus>({
    sqlite: false,
    vectorStore: false,
    jsonStore: false,
  });
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const result = await clientEngine.init();
        if (active) {
          setStatus(result);
          setInitialized(true);
        }
      } catch (error) {
        console.error('[ClientEngineProvider] Initialization failed:', error);
        if (active) {
          setInitialized(true);
        }
      }
    }

    init();

    return () => {
      active = false;
    };
  }, []);

  return (
    <ClientEngineContext.Provider value={{ status, initialized, engine: clientEngine }}>
      {children}
    </ClientEngineContext.Provider>
  );
}

export default function ClientEngine() {
  const [status, setStatus] = useState<ClientEngineStatus>({
    sqlite: false,
    vectorStore: false,
    jsonStore: false,
  });
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const result = await clientEngine.init();
        if (active) {
          setStatus(result);
          console.log('[ClientEngine] Moteur client initialisé avec succès:', result);
        }
      } catch (error) {
        console.error('[ClientEngine] Erreur d\'initialisation:', error);
        if (active) {
          setInitError(error instanceof Error ? error.message : 'Erreur inconnue');
        }
      }
    }

    init();

    return () => {
      active = false;
    };
  }, []);

  if (initError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Erreur d&apos;initialisation du moteur local: {initError}
      </div>
    );
  }

  const allReady = status.sqlite && status.vectorStore && status.jsonStore;

  return (
    <div className="rounded-lg border border-border bg-card/50 p-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-block h-2 w-2 rounded-full ${allReady ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
        <span className="font-medium">
          {allReady ? 'Moteur local prêt' : 'Initialisation du moteur local...'}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="flex items-center gap-1.5">
          <span className={status.sqlite ? 'text-green-500' : 'text-yellow-500'}>
            {status.sqlite ? '●' : '○'}
          </span>
          <span>SQLite (OPFS)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={status.vectorStore ? 'text-green-500' : 'text-yellow-500'}>
            {status.vectorStore ? '●' : '○'}
          </span>
          <span>Vector Store (IndexedDB)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={status.jsonStore ? 'text-green-500' : 'text-yellow-500'}>
            {status.jsonStore ? '●' : '○'}
          </span>
          <span>JSON Store (IndexedDB)</span>
        </div>
      </div>
      <p className="mt-2 text-[10px] opacity-70">
        Les bases de données sont stockées localement sur votre appareil. Aucune donnée n&apos;est envoyée au serveur.
      </p>
    </div>
  );
}
