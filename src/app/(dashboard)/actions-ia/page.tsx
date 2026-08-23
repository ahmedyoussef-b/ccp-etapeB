"use client";

import { EmbeddedSystemPanel } from "@/components/embedded-system/embedded-system-panel";

export default function ActionsIAPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Actions IA</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Système embarqué connecté — surveillance, contrôle et supervision par voix.
        </p>
      </div>

      <EmbeddedSystemPanel />
    </section>
  );
}