"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function RenameNodeDialog({
  isOpen,
  onOpenChange,
  defaultName = "",
  onConfirm,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName?: string;
  onConfirm: (newName: string) => void;
}) {
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
    }
  }, [isOpen, defaultName]);

  const handleConfirm = () => {
    onConfirm(name.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renommer</DialogTitle>
        </DialogHeader>
        <div>
          <label className="text-sm font-medium">Nouveau nom</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nouveau nom"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleConfirm}>Renommer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
