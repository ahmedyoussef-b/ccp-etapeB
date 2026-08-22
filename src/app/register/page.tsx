"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NexaFlowLogo } from "@/components/brand/nexaflow-logo";
import { ROLE_LABELS } from "@/lib/auth/roles";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [desiredRole, setDesiredRole] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!email || !name || !password || !desiredRole) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password, desiredRole, message }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'inscription");
      }

      toast.success("Votre demande d'inscription a été envoyée. Un administrateur va l'examiner.");
      router.push("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'inscription");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <section className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md p-8 sm:p-10 shadow-xl shadow-primary/5 border-border/60">
          <div className="text-center">
            <NexaFlowLogo className="mx-auto h-12 w-12" iconClassName="h-6 w-6" />
            <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
              Demande d&apos;accès
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Soumettez votre demande pour accéder à NexaFlow
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 rounded-xl border-border/60 bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nom complet</Label>
              <Input
                id="name"
                type="text"
                placeholder="Jean Dupont"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-11 rounded-xl border-border/60 bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="desiredRole">Rôle souhaité</Label>
              <Select value={desiredRole} onValueChange={(value) => setDesiredRole(value as string)}>
                <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background/50">
                  <SelectValue placeholder="Sélectionnez un rôle" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-11 rounded-xl border-border/60 bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="h-11 rounded-xl border-border/60 bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message (optionnel)</Label>
              <Textarea
                id="message"
                placeholder="Présentez-vous et expliquez pourquoi vous souhaitez accéder à l'application..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="rounded-xl border-border/60 bg-background/50"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 rounded-xl text-base font-medium shadow-lg shadow-primary/20"
            >
              {isLoading ? "Envoi en cours..." : "Soumettre ma demande"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Déjà inscrit ?{" "}
            <Link href="/login" className="text-primary hover:underline font-semibold">
              Se connecter
            </Link>
          </p>
        </Card>
      </section>
    </div>
  );
}
