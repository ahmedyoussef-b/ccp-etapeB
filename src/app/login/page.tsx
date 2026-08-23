"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn, getSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { NexaFlowLogo } from "@/components/brand/nexaflow-logo";
import { Role } from "@/lib/auth/roles";

const ROLE_HOME: Record<Role, string> = {
  admin: "/admin",
  superviseur: "/admin",
  "chef-de-bloc": "/chef-de-bloc",
  "chef-de-quart": "/chef-de-quart",
  rondier: "/rondier",
};

function setLegacySession(role: Role, email: string, id: string) {
  if (typeof window === "undefined") return;
  const maxAge = 60 * 60 * 24 * 7;
  try {
    window.sessionStorage.setItem("dashboardRole", role);
    window.sessionStorage.setItem("dashboardUserId", id);
    window.sessionStorage.setItem("dashboardUserEmail", email);
  } catch {}
  document.cookie = `role=${role}; path=/; max-age=${maxAge}`;
  document.cookie = `userId=${id}; path=/; max-age=${maxAge}`;
  document.cookie = `userEmail=${encodeURIComponent(email)}; path=/; max-age=${maxAge}`;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    console.log("[NexaFlow][Login] Tentative de connexion:", email);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        console.error("[NexaFlow][Login] Erreur:", result.error);
        setError("Email ou mot de passe incorrect");
        setIsLoading(false);
        return;
      }

      const session = await getSession();
      const role = (session?.user?.role ?? "rondier") as Role;
      const id = session?.user?.id ?? `user_${Date.now()}`;
      console.log("[NexaFlow][Login] Connexion réussie", { email, role });

      setLegacySession(role, email, id);

      const callbackUrl = searchParams.get("callbackUrl");
      const target =
        callbackUrl && callbackUrl.startsWith("/")
          ? callbackUrl
          : ROLE_HOME[role];

      router.push(target);
      router.refresh();
    } catch (err) {
      console.error("[NexaFlow][Login] Erreur inattendue:", err);
      setError("Une erreur est survenue lors de la connexion");
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
              Connexion
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Connectez-vous à votre compte NexaFlow
            </p>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="email@nexaflow.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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

            <Button type="submit" disabled={isLoading} className="w-full h-11 rounded-xl text-base font-medium shadow-lg shadow-primary/20">
              {isLoading ? "Connexion..." : "Se connecter"}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Démo : admin@nexaflow.com / password123
            </p>

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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Chargement…</div>}>
      <LoginForm />
    </Suspense>
  );
}
