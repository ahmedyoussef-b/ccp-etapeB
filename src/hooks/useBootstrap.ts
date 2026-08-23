import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { csrfFetch } from "@/lib/procedures/csrf-fetch";

export type BootstrapStatusValue = "pending" | "approved" | "rejected" | "downloaded";

export interface BootstrapRequestDTO {
  id: string;
  status: BootstrapStatusValue;
  requestedAt: string;
  approvedAt: string | null;
  downloadedAt: string | null;
}

export interface WebTreeNodeLike {
  id: number | string;
  name: string;
  type: string;
  children: WebTreeNodeLike[];
}

export function useBootstrap() {
  const [status, setStatus] = useState<BootstrapRequestDTO | null>(null);
  const inProgress = useRef(false);
  const lastToastKey = useRef<string | null>(null);

  const toastOnce = (key: string, message: string, type: "info" | "warning" | "success") => {
    if (lastToastKey.current === key) return;
    lastToastKey.current = key;
    if (type === "warning") toast.warning(message);
    else if (type === "success") toast.success(message);
    else toast.info(message);
  };

  const fetchStatus = useCallback(async (): Promise<BootstrapRequestDTO | null> => {
    try {
      const res = await csrfFetch("/api/bootstrap/status");
      if (!res.ok) return null;
      const data = await res.json();
      const req = (data.request as BootstrapRequestDTO) ?? null;
      setStatus(req);
      return req;
    } catch {
      return null;
    }
  }, []);

  const requestBootstrap = useCallback(async (): Promise<BootstrapRequestDTO | null> => {
    const res = await csrfFetch("/api/bootstrap/request", { method: "POST" });
    if (!res.ok) {
      toast.error("Échec de la demande d'initialisation");
      return null;
    }
    const req = (await res.json()) as BootstrapRequestDTO;
    setStatus(req);
    return req;
  }, []);

  const completeDownload = useCallback(async (id: string) => {
    const res = await csrfFetch(`/api/bootstrap/${id}/complete`, { method: "POST" });
    if (res.ok) {
      const req = (await res.json()) as BootstrapRequestDTO;
      setStatus(req);
      lastToastKey.current = null;
      return req;
    }
    return null;
  }, []);

  const runDownload = useCallback(
    async (
      requestId: string,
      webRoots: WebTreeNodeLike[],
      downloadDirectory: (node: WebTreeNodeLike) => Promise<void>,
      reload: () => Promise<void>
    ) => {
      if (inProgress.current) return;
      inProgress.current = true;
      try {
        for (const root of webRoots) {
          await downloadDirectory(root);
        }
        await completeDownload(requestId);
        await reload();
        toastOnce(`done-${requestId}`, "✅ BDD locale initialisée (bootstrap terminé)", "success");
      } catch (err) {
        console.error("[useBootstrap] download error", err);
        toast.error("Échec du bootstrap automatique. Utilisez le bouton Télécharger.");
      } finally {
        inProgress.current = false;
      }
    },
    [completeDownload]
  );

  const checkBootstrap = useCallback(
    async (params: {
      localEmpty: boolean;
      webPopulated: boolean;
      webRoots: WebTreeNodeLike[];
      downloadDirectory: (node: WebTreeNodeLike) => Promise<void>;
      reload: () => Promise<void>;
    }) => {
      if (inProgress.current) return;
      if (!params.localEmpty || !params.webPopulated) return;

      const req = await fetchStatus();

      if (!req) {
        const created = await requestBootstrap();
        if (created) {
          toastOnce(`request-${created.id}`, "📨 Demande d'initialisation envoyée aux administrateurs.", "info");
        }
        return;
      }

      if (req.status === "pending") {
        toastOnce(`pending-${req.id}`, "⏳ Demande d'initialisation en attente d'approbation admin.", "info");
        return;
      }
      if (req.status === "rejected") {
        toastOnce(`rejected-${req.id}`, "⛔ Demande d'initialisation rejetée.", "warning");
        return;
      }
      if (req.status === "approved") {
        await runDownload(req.id, params.webRoots, params.downloadDirectory, params.reload);
        return;
      }
    },
    [fetchStatus, requestBootstrap, runDownload]
  );

  return { status, checkBootstrap, fetchStatus, requestBootstrap };
}
