"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Bell, LogOut, User, Sun, Moon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/components/theme-provider";
import { useSession } from "@/hooks/useSession";

export function DashboardTopNav() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, role } = useSession();

  const initials = (user?.name || user?.email || "UT")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
      <div className="flex items-center gap-2">
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <Button variant="ghost" size="icon" className="rounded-xl hover:bg-muted" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
          {theme === "light" ? <Moon className="h-5 w-5 text-foreground/70" /> : <Sun className="h-5 w-5 text-foreground/70" />}
          <span className="sr-only">Toggle theme</span>
        </Button>

        <Button variant="ghost" size="icon" className="relative rounded-xl hover:bg-muted">
          <Bell className="h-5 w-5 text-foreground/70" />
          <Badge className="absolute -top-0.5 -right-0.5 h-4 w-4 min-w-4 justify-center rounded-full bg-primary p-0 text-[10px] text-primary-foreground">
            3
          </Badge>
          <span className="sr-only">Notifications</span>
        </Button>

        <Button variant="ghost" size="icon" className="rounded-xl hover:bg-muted" onClick={() => router.push("/profile")}>
          <User className="h-5 w-5 text-foreground/70" />
          <span className="sr-only">Profile</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl hover:bg-muted"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-5 w-5 text-foreground/70" />
          <span className="sr-only">Déconnexion</span>
        </Button>

        <Avatar className="h-9 w-9 rounded-xl border border-border" title={role ?? undefined}>
          <AvatarFallback className="rounded-xl text-xs font-semibold">{initials || "UT"}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
