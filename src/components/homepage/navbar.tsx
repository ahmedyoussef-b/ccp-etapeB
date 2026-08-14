import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { NexaFlowLogo } from "@/components/brand/nexaflow-logo";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <NexaFlowLogo className="h-9 w-9" />
          <span className="text-xl font-bold tracking-tight">NexaFlow</span>
          <Badge variant="secondary" className="hidden text-xs font-medium md:inline-flex rounded-full px-2.5 py-0.5">
            v2.0
          </Badge>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden sm:inline-flex rounded-xl border border-solid border-transparent bg-transparent px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
