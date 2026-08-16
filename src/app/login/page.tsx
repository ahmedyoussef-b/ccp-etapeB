"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { NexaFlowLogo } from "@/components/brand/nexaflow-logo";

export default function LoginPage() {
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.querySelector("#email") as HTMLInputElement)?.value || "";
    const lower = email.toLowerCase();
    const role = lower.includes("admin")
      ? "admin"
      : lower.includes("chef-de-quart")
        ? "chef-de-quart"
        : lower.includes("chef-de-bloc")
          ? "chef-de-bloc"
          : "rondier";
    if (typeof window !== "undefined") {
      const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem("dashboardRole", role);
      sessionStorage.setItem("dashboardUserId", userId);
      sessionStorage.setItem("dashboardUserEmail", email);
      document.cookie = `role=${role}; path=/; max-age=${60 * 60 * 24 * 7}`;
      document.cookie = `userId=${userId}; path=/; max-age=${60 * 60 * 24 * 7}`;
      document.cookie = `userEmail=${encodeURIComponent(email)}; path=/; max-age=${60 * 60 * 24 * 7}`;
    }
    const route = role === "admin" ? "/admin" : `/${role}`;
    router.push(route);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <section className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md p-8 sm:p-10 shadow-xl shadow-primary/5 border-border/60">
          <div className="text-center">
            <NexaFlowLogo className="mx-auto h-12 w-12" iconClassName="h-6 w-6" />
            <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
              Connexion
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Connectez-vous à votre compte NexaFlow
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="vous@exemple.com"
                autoComplete="email"
                className="h-11 rounded-xl border-border/60 bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground" htmlFor="password">
                Mot de passe
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                className="h-11 rounded-xl border-border/60 bg-background/50"
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2.5 text-muted-foreground cursor-pointer">
                <input type="checkbox" className="h-4 w-4 rounded border-border accent-primary" />
                Se souvenir de moi
              </label>
              <Link href="#" className="text-primary hover:underline font-medium">
                Mot de passe oublié ?
              </Link>
            </div>

            <Button type="submit" className="w-full h-11 rounded-xl text-base font-medium shadow-lg shadow-primary/20">
              Se connecter
            </Button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-3 text-muted-foreground font-medium">ou</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" type="button" className="w-full text-sm h-11 rounded-xl border-border/60 hover:bg-muted" onClick={() => alert("Connexion Google non disponible")}>
                Google
              </Button>
              <Button variant="outline" type="button" className="w-full text-sm h-11 rounded-xl border-border/60 hover:bg-muted" onClick={() => alert("Connexion Microsoft non disponible")}>
                Microsoft
              </Button>
            </div>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Pas encore de compte ?{" "}
            <Link href="#" className="text-primary hover:underline font-semibold">
              S&apos;inscrire
            </Link>
          </p>
        </Card>
      </section>
    </div>
  );
}
