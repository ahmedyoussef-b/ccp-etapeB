"use client";

import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { exportBackup, importBackup, downloadBlob } from "@/lib/client-engine/backup";

export function BackupButtons() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(async () => {
    try {
      const blob = await exportBackup();
      const sizeInKB = (blob.size / 1024).toFixed(1);
      const sizeInMB = (blob.size / (1024 * 1024)).toFixed(2);
      const humanSize = blob.size > 1024 * 1024 ? `${sizeInMB} Mo` : `${sizeInKB} Ko`;

      const confirmed = window.confirm(`Votre sauvegarde pèse ${humanSize}. Voulez-vous la télécharger ?`);
      if (!confirmed) return;

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      downloadBlob(blob, `nexaflow-backup-${timestamp}.json`);
      toast.success("Sauvegarde exportée avec succès");
    } catch {
      toast.error("Erreur lors de l'export");
    }
  }, []);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await importBackup(file);
      toast.success(`Sauvegarde restaurée: ${result.imported.pairs} Q/R, ${result.imported.sessions} sessions, ${result.imported.documents} documents`);
      window.location.reload();
    } catch {
      toast.error("Erreur lors de l'import. Vérifiez le format du fichier.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, []);

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-xl border-white/10 hover:bg-white/5"
        onClick={handleExport}
      >
        <Download className="mr-1.5 h-4 w-4" />
        Exporter ma base
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImport}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-xl border-white/10 hover:bg-white/5"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="mr-1.5 h-4 w-4" />
        Importer une sauvegarde
      </Button>
    </div>
  );
}
