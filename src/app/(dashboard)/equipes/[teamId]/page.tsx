"use client";

import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  UserCheck,
  UserX,
} from "lucide-react";
import { teams, rolesConfig } from "@/data/teams";

export default function EquipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = Number(params.teamId);
  const team = teams.find((t) => t.id === teamId);

  if (!team) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="flex h-64 items-center justify-center">
          <p className="text-sm text-muted-foreground">Équipe introuvable</p>
        </Card>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{team.name}</h1>
          <p className="text-sm text-muted-foreground">{team.description}</p>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {team.members_list.map((member) => {
          const roleCfg = rolesConfig[member.role];
          const isChef = member.role === "chef_de_quart" || member.role.startsWith("chef_de_bloc");
          return (
            <Card
              key={member.id}
              className="cursor-pointer transition-all hover:shadow-md hover:border-border/80"
              onClick={() => router.push(`/equipes/${team.id}/${member.id}`)}
            >
              <div className="p-6 flex flex-col items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary mb-4">
                  {member.avatar}
                </div>
                <h3 className="text-base font-semibold text-foreground">{member.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{member.email}</p>
                <div className="mt-3">
                  <Badge variant={isChef ? "default" : "secondary"} className="text-xs">
                    {roleCfg?.label ?? member.role}
                  </Badge>
                </div>
                <div className="mt-4 flex items-center gap-1">
                  {member.status === "active" ? (
                    <UserCheck className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <UserX className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-xs text-muted-foreground capitalize">
                    {member.status === "active" ? "Actif" : "Absent"}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
