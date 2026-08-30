"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export interface EditMetadataDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  defaultContent: string;
  name: string;
  onSave: (content: string) => Promise<void>;
}

export function EditMetadataDialog({
  isOpen,
  onOpenChange,
  defaultContent,
  name,
  onSave,
}: EditMetadataDialogProps) {
  const [content, setContent] = useState(defaultContent);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setContent(defaultContent);
      setSaving(false);
    }
  }, [isOpen, defaultContent]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(content);
      onOpenChange(false);
    } catch {
      // error handled by parent via toast
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Éditer les métadonnées JSON : {name}</DialogTitle>
        </DialogHeader>
        <div>
          <label className="text-sm font-medium">Contenu JSON (métadonnées du média)</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder='{ "title": "...", "description": "...", "tags": [...] }'
            className="w-full h-80 p-2 font-mono text-sm border rounded-md resize-none mt-1 bg-muted/20"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
