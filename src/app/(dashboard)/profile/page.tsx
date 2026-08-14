"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Shield, Bell, Palette, Globe } from "lucide-react";

export default function ProfilePage() {
  const [name, setName] = useState("Admin User");
  const [email, setEmail] = useState("admin@nexaflow.com");
  const [role] = useState("Administrateur");
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      alert("Profil mis à jour");
    }, 800);
  };

  return (
    <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Mon profil
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez vos informations personnelles et vos préférences.
          </p>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
              AD
            </div>
            <h2 className="mt-4 text-lg font-semibold text-foreground">{name}</h2>
            <p className="text-sm text-muted-foreground">{email}</p>
            <Badge variant="secondary" className="mt-2">
              {role}
            </Badge>
          </div>

          <Separator className="my-6" />

          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Membre depuis</span>
            </div>
            <p className="text-sm text-foreground">Janvier 2024</p>

            <div className="flex items-center gap-3 text-sm">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Langue</span>
            </div>
            <p className="text-sm text-foreground">Français</p>

            <div className="flex items-center gap-3 text-sm">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Authentification</span>
            </div>
            <p className="text-sm text-foreground">Mot de passe</p>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h3 className="text-base font-semibold text-foreground">Informations personnelles</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Mettez à jour votre nom et adresse email.
          </p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-foreground">Nom complet</label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label htmlFor="role" className="text-sm font-medium text-foreground">Rôle</label>
              <Input id="role" value={role} disabled />
            </div>

            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium text-foreground">Téléphone</label>
              <Input id="phone" placeholder="+33 6 12 34 56 78" />
            </div>
          </div>

          <Separator className="my-8" />

          <h3 className="text-base font-semibold text-foreground">Préférences</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez vos notifications et l&apos;apparence de l&apos;interface.
          </p>

          <div className="mt-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Notifications</p>
                  <p className="text-xs text-muted-foreground">Recevoir des alertes par email</p>
                </div>
              </div>
              <Button variant="outline" size="sm">Configurer</Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Apparence</p>
                  <p className="text-xs text-muted-foreground">Thème clair / sombre</p>
                </div>
              </div>
              <Button variant="outline" size="sm">Changer</Button>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
