"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { clientEngine } from "@/lib/client-engine";

export function JsonImportButton({ onImported }: { onImported?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleImport = useCallback(async (file: File) => {
    setLoading(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const pairs: Array<{ question: string; answer: string }> = [];

      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.question && item.answer) {
            pairs.push({ question: item.question.trim(), answer: item.answer.trim() });
          }
        }
      } else if (data.pairs && Array.isArray(data.pairs)) {
        for (const item of data.pairs) {
          if (item.question && item.answer) {
            pairs.push({ question: item.question.trim(), answer: item.answer.trim() });
          }
        }
      }

      if (pairs.length === 0) {
        toast.error("Aucune paire Q/R valide trouvée dans le fichier");
        return;
      }

      let imported = 0;
      for (const pair of pairs) {
        try {
          await clientEngine.createQAPair(pair);
          imported++;
        } catch {
          // skip duplicates/errors
        }
      }

      toast.success(`${imported} paires Q/R importées`);
      onImported?.();
    } catch {
      toast.error("Fichier JSON invalide");
    } finally {
      setLoading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }, [onImported]);

  const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleImport(file);
  }, [handleImport]);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onFileChange}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-xl border-white/10 hover:bg-white/5"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
      >
        <Upload className="mr-1.5 h-4 w-4" />
        {loading ? "Import..." : "Importer JSON"}
      </Button>
    </div>
  );
}
