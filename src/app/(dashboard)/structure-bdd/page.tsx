"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Database,
  Table,
  Key,
  Type,
  Search,
  ChevronRight,
  ChevronDown,
  GripVertical,
  Link as LinkIcon,
} from "lucide-react";

const schema = {
  name: "nexaflow_prod",
  tables: [
    {
      name: "users",
      description: "Utilisateurs de la plateforme",
      columns: [
        { name: "id", type: "UUID", nullable: false, defaultValue: "gen_random_uuid()", isPrimary: true },
        { name: "email", type: "VARCHAR(255)", nullable: false, defaultValue: null, isPrimary: false },
        { name: "password_hash", type: "VARCHAR(255)", nullable: false, defaultValue: null, isPrimary: false },
        { name: "name", type: "VARCHAR(100)", nullable: true, defaultValue: null, isPrimary: false },
        { name: "role", type: "ENUM", nullable: false, defaultValue: "'user'", isPrimary: false },
        { name: "is_active", type: "BOOLEAN", nullable: false, defaultValue: "true", isPrimary: false },
        { name: "created_at", type: "TIMESTAMP", nullable: false, defaultValue: "NOW()", isPrimary: false },
        { name: "updated_at", type: "TIMESTAMP", nullable: true, defaultValue: null, isPrimary: false },
      ],
      indexes: ["email_unique_idx", "role_idx"],
      relations: ["workflows.user_id", "executions.user_id"],
    },
    {
      name: "workflows",
      description: "Procédures automatiques",
      columns: [
        { name: "id", type: "UUID", nullable: false, defaultValue: "gen_random_uuid()", isPrimary: true },
        { name: "user_id", type: "UUID", nullable: false, defaultValue: null, isPrimary: false, isForeign: true, references: "users(id)" },
        { name: "name", type: "VARCHAR(150)", nullable: false, defaultValue: null, isPrimary: false },
        { name: "status", type: "ENUM", nullable: false, defaultValue: "'draft'", isPrimary: false },
        { name: "trigger_type", type: "VARCHAR(50)", nullable: true, defaultValue: null, isPrimary: false },
        { name: "config", type: "JSONB", nullable: true, defaultValue: "'{}'", isPrimary: false },
        { name: "created_at", type: "TIMESTAMP", nullable: false, defaultValue: "NOW()", isPrimary: false },
        { name: "updated_at", type: "TIMESTAMP", nullable: true, defaultValue: null, isPrimary: false },
      ],
      indexes: ["user_id_idx", "status_idx"],
      relations: ["executions.workflow_id", "workflow_steps.workflow_id"],
    },
    {
      name: "workflow_steps",
      description: "Étapes d'une procédure",
      columns: [
        { name: "id", type: "UUID", nullable: false, defaultValue: "gen_random_uuid()", isPrimary: true },
        { name: "workflow_id", type: "UUID", nullable: false, defaultValue: null, isPrimary: false, isForeign: true, references: "workflows(id)" },
        { name: "position", type: "INTEGER", nullable: false, defaultValue: "0", isPrimary: false },
        { name: "action_type", type: "VARCHAR(50)", nullable: false, defaultValue: null, isPrimary: false },
        { name: "config", type: "JSONB", nullable: true, defaultValue: "'{}'", isPrimary: false },
        { name: "next_step_id", type: "UUID", nullable: true, defaultValue: null, isPrimary: false, isForeign: true, references: "workflow_steps(id)" },
      ],
      indexes: ["workflow_id_position_idx"],
      relations: ["executions.current_step_id"],
    },
    {
      name: "executions",
      description: "Historique des exécutions",
      columns: [
        { name: "id", type: "UUID", nullable: false, defaultValue: "gen_random_uuid()", isPrimary: true },
        { name: "workflow_id", type: "UUID", nullable: false, defaultValue: null, isPrimary: false, isForeign: true, references: "workflows(id)" },
        { name: "user_id", type: "UUID", nullable: false, defaultValue: null, isPrimary: false, isForeign: true, references: "users(id)" },
        { name: "current_step_id", type: "UUID", nullable: true, defaultValue: null, isPrimary: false },
        { name: "status", type: "ENUM", nullable: false, defaultValue: "'running'", isPrimary: false },
        { name: "started_at", type: "TIMESTAMP", nullable: false, defaultValue: "NOW()", isPrimary: false },
        { name: "finished_at", type: "TIMESTAMP", nullable: true, defaultValue: null, isPrimary: false },
        { name: "error", type: "TEXT", nullable: true, defaultValue: null, isPrimary: false },
      ],
      indexes: ["workflow_id_idx", "user_id_idx", "status_idx"],
      relations: [],
    },
    {
      name: "integrations",
      description: "Intégrations connectées",
      columns: [
        { name: "id", type: "UUID", nullable: false, defaultValue: "gen_random_uuid()", isPrimary: true },
        { name: "user_id", type: "UUID", nullable: false, defaultValue: null, isPrimary: false, isForeign: true, references: "users(id)" },
        { name: "service", type: "VARCHAR(50)", nullable: false, defaultValue: null, isPrimary: false },
        { name: "credentials", type: "JSONB", nullable: true, defaultValue: "'{}'", isPrimary: false },
        { name: "is_active", type: "BOOLEAN", nullable: false, defaultValue: "true", isPrimary: false },
        { name: "created_at", type: "TIMESTAMP", nullable: false, defaultValue: "NOW()", isPrimary: false },
      ],
      indexes: ["user_id_service_idx"],
      relations: [],
    },
    {
      name: "audit_logs",
      description: "Journal d'audit",
      columns: [
        { name: "id", type: "UUID", nullable: false, defaultValue: "gen_random_uuid()", isPrimary: true },
        { name: "user_id", type: "UUID", nullable: true, defaultValue: null, isPrimary: false },
        { name: "action", type: "VARCHAR(100)", nullable: false, defaultValue: null, isPrimary: false },
        { name: "resource_type", type: "VARCHAR(50)", nullable: true, defaultValue: null, isPrimary: false },
        { name: "resource_id", type: "UUID", nullable: true, defaultValue: null, isPrimary: false },
        { name: "metadata", type: "JSONB", nullable: true, defaultValue: "'{}'", isPrimary: false },
        { name: "created_at", type: "TIMESTAMP", nullable: false, defaultValue: "NOW()", isPrimary: false },
      ],
      indexes: ["user_id_idx", "action_idx", "resource_idx"],
      relations: [],
    },
  ],
};

export default function StructureBDDPage() {
  const [search, setSearch] = useState("");
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({
    users: true,
    workflows: true,
  });
  const [activeTable, setActiveTable] = useState<string | null>(null);

  const filteredTables = schema.tables.filter((table) => {
    const matchesSearch =
      table.name.toLowerCase().includes(search.toLowerCase()) ||
      table.description.toLowerCase().includes(search.toLowerCase()) ||
      table.columns.some((col) => col.name.toLowerCase().includes(search.toLowerCase()));
    return matchesSearch;
  });

  const toggleTable = (name: string) => {
    setExpandedTables((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const totalColumns = schema.tables.reduce((acc, table) => acc + table.columns.length, 0);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Structure BDD</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {schema.name} · {schema.tables.length} tables · {totalColumns} colonnes
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher une table ou colonne..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-full sm:w-80"
          />
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tables</p>
          {filteredTables.map((table) => {
            const isExpanded = expandedTables[table.name] || false;
            const isActive = activeTable === table.name;

            return (
              <Card
                key={table.name}
                className={`p-3 cursor-pointer transition-colors ${
                  isActive ? "border-primary/50 bg-primary/5" : "hover:border-border/80"
                }`}
                onClick={() => {
                  setActiveTable(table.name);
                  toggleTable(table.name);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Table className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{table.name}</p>
                      <p className="text-xs text-muted-foreground">{table.description}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {table.columns.length}
                  </Badge>
                </div>

                {isExpanded && (
                  <div className="mt-3 ml-6 space-y-1">
                    {table.columns.map((col) => (
                      <div
                        key={col.name}
                        className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          {col.isPrimary && <Key className="h-3 w-3 text-amber-500" />}
                          {col.isForeign && <LinkIcon className="h-3 w-3 text-blue-500" />}
                          {!col.isPrimary && !col.isForeign && <GripVertical className="h-3 w-3 text-muted-foreground" />}
                          <span className="text-xs font-medium text-foreground">{col.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{col.type}</span>
                          {col.isPrimary && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1">
                              PK
                            </Badge>
                          )}
                          {col.isForeign && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1 border-blue-500/50 text-blue-600">
                              FK
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <div className="lg:col-span-2">
          {activeTable ? (
            <Card className="overflow-hidden">
              <div className="border-b border-border px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Table className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">{activeTable}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {schema.tables.find((t) => t.name === activeTable)?.columns.length} colonnes
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => alert(`Export SQL de ${activeTable}`)}>
                  Export SQL
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-2 font-medium text-muted-foreground">Colonne</th>
                      <th className="px-4 py-2 font-medium text-muted-foreground">Type</th>
                      <th className="px-4 py-2 font-medium text-muted-foreground">Nullable</th>
                      <th className="px-4 py-2 font-medium text-muted-foreground">Défaut</th>
                      <th className="px-4 py-2 font-medium text-muted-foreground">Contrainte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schema.tables
                      .find((t) => t.name === activeTable)
                      ?.columns.map((col) => (
                        <tr key={col.name} className="border-b border-border/70 last:border-0">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              {col.isPrimary && <Key className="h-3.5 w-3.5 text-amber-500" />}
                              {col.isForeign && <LinkIcon className="h-3.5 w-3.5 text-blue-500" />}
                              {!col.isPrimary && !col.isForeign && <div className="h-3.5 w-3.5" />}
                              <span className="font-medium text-foreground">{col.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <Type className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">{col.type}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant={col.nullable ? "secondary" : "outline"} className="text-xs">
                              {col.nullable ? "Oui" : "Non"}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">
                            {col.defaultValue || "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            {col.isPrimary && (
                              <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-600">
                                PRIMARY KEY
                              </Badge>
                            )}
                            {col.isForeign && (
                              <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-600">
                                FOREIGN KEY → {col.references}
                              </Badge>
                            )}
                            {!col.isPrimary && !col.isForeign && <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-border px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Indexes :</span>{" "}
                  {schema.tables.find((t) => t.name === activeTable)?.indexes.join(", ")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium">Relations :</span>{" "}
                  {schema.tables.find((t) => t.name === activeTable)?.relations.join(", ") || "Aucune"}
                </p>
              </div>
            </Card>
          ) : (
            <Card className="flex h-full flex-col items-center justify-center p-12 text-center">
              <Database className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-sm font-medium text-foreground">Sélectionnez une table</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cliquez sur une table dans la liste pour afficher ses colonnes et ses contraintes.
              </p>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}
