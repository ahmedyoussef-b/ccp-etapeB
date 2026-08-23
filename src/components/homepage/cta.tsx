"use client";

import { Button } from "@/components/ui/button";

import Link from "next/link";

export function CTA() {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-primary px-6 py-16 sm:px-12 sm:py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
            Ready to automate your workflows?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/80">
            Join thousands of teams shipping faster with NexaFlow. Start free, upgrade when you need to.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                Get started now
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10">
                Talk to sales
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
