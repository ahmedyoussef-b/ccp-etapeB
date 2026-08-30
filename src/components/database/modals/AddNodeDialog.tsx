"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AddNodeDialog({
  isOpen,
  onOpenChange,
  defaultName = "",
  defaultType = "directory",
  onConfirm,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName?: string;
  defaultType?: "file" | "directory";
  onConfirm: (name: string, type: "file" | "directory") => void;
}) {
  const [name, setName] = useState(defaultName);
  const [type, setType] = useState<"file" | "directory">(defaultType);

  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
      setType(defaultType);
    }
  }, [isOpen, defaultName, defaultType]);

  const handleConfirm = () => {
    if (!name.trim()) return;
    onConfirm(name, type);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un nœud</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Nom</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom du nœud"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Type</label>
            <Select value={type} onValueChange={(value) => setType(value as "file" | "directory")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="directory">Dossier</SelectItem>
                <SelectItem value="file">Fichier</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleConfirm}>Ajouter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
