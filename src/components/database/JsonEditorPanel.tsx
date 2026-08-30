"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export interface JsonEditorPanelProps {
  node: { tree: "web" | "local"; path: string; content: string } | null;
  defaultContent: string;
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
}

export function JsonEditorPanel({ node, defaultContent, onSave, onCancel }: JsonEditorPanelProps) {
  const [content, setContent] = useState(defaultContent);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setContent(defaultContent);
    setSaving(false);
  }, [defaultContent]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(content);
      onCancel();
    } catch {
      // error handled by parent via toast
    } finally {
      setSaving(false);
    }
  };

  if (!node) return null;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Contenu</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder='{ "key": "value" }'
          className="w-full h-96 p-2 font-mono text-sm border rounded-md resize-none"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Annuler
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Enregistrement...
            </>
          ) : (
            "Enregistrer"
          )}
        </Button>
      </div>
    </div>
  );
}
