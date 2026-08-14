"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  UserPlus,
  Search,
  Crown,
} from "lucide-react";
import { teams } from "@/data/teams";

export default function EquipesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filteredTeams = teams.filter((team) => {
    const q = search.toLowerCase();
    return (
      team.name.toLowerCase().includes(q) ||
      team.description.toLowerCase().includes(q)
    );
  });

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Équipes</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {teams.length} équipes · {teams.reduce((acc, t) => acc + t.members, 0)} postes
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher une équipe..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-64"
            />
          </div>
          <Button onClick={() => alert("Créer une équipe")}>
            <UserPlus className="h-4 w-4 mr-2" />
            Nouvelle équipe
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-3">
          {filteredTeams.map((team) => (
            <Card
              key={team.id}
              className="p-4 cursor-pointer transition-all hover:border-border/80"
              onClick={() => router.push(`/equipes/${team.id}`)}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${team.color} bg-opacity-10`}
                >
                  <Users className={`h-5 w-5 ${team.color.replace("bg-", "text-")}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground truncate">{team.name}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {team.members}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{team.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Crown className="h-3 w-3 text-amber-500" />
                      1 chef de quart
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">2 chefs de bloc</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">4 rondiers</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-2">
          <Card className="flex h-full flex-col items-center justify-center p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm font-medium text-foreground">Sélectionnez une équipe</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cliquez sur une équipe pour accéder à sa page détaillée et voir ses membres.
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
}
