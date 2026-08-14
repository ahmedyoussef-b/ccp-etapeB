import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function parseSchema(filePath: string) {
  const content = fs.readFileSync(filePath, "utf-8");

  const modelDefinitions = new Map<string, { lineStart: number; lineEnd: number }>();
  const modelRegex = /model\s+(\w+)\s*\{/g;
  let modelMatch;
  while ((modelMatch = modelRegex.exec(content)) !== null) {
    const name = modelMatch[1];
    const start = modelMatch.index;
    const end = content.indexOf("}", start);
    modelDefinitions.set(name, { lineStart: start, lineEnd: end >= 0 ? end : content.length });
  }

  function isModelType(type: string): boolean {
    const base = type.replace(/\[\]$/, "");
    return modelDefinitions.has(base);
  }

  const models: Array<{
    name: string;
    description: string | null;
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
      defaultValue: string | null;
      isPrimary: boolean;
      isForeign: boolean;
      references: string | null;
      isUnique: boolean;
      isUpdatedAt: boolean;
    }>;
    indexes: string[];
    relations: string[];
  }> = [];

  for (const [modelName, bounds] of modelDefinitions) {
    const body = content.slice(bounds.lineStart, bounds.lineEnd);

    const columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
      defaultValue: string | null;
      isPrimary: boolean;
      isForeign: boolean;
      references: string | null;
      isUnique: boolean;
      isUpdatedAt: boolean;
    }> = [];
    const indexes: string[] = [];
    const relations: string[] = [];

    const lines = body.split("\n").map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith("//"));

    for (const line of lines) {
      if (line.startsWith("model ") || line === "}" || line.startsWith("@@")) {
        if (line.startsWith("@@")) {
          const blockAttr = line.replace(/@@\w+\(?\[?/, "").replace(/\]?\)?/, "").trim();
          if (line.startsWith("@@unique")) {
            indexes.push(`unique(${blockAttr})`);
          } else if (line.startsWith("@@index")) {
            indexes.push(`index(${blockAttr})`);
          } else if (line.startsWith("@@id")) {
            columns.forEach((col) => {
              if (blockAttr.includes(col.name)) {
                col.isPrimary = true;
              }
            });
          }
        }
        continue;
      }

      const attrRegex = /@(\w+)(?:\(([^)]*)\))?/g;
      const attrMatches: Array<{ key: string; value?: string }> = [];
      let attrMatch;
      while ((attrMatch = attrRegex.exec(line)) !== null) {
        attrMatches.push({ key: attrMatch[1], value: attrMatch[2] });
      }

      const cleanLine = line.replace(/@\w+(?:\([^)]*\))?/g, "").trim();
      const parts = cleanLine.split(/\s+/);
      if (parts.length < 2) continue;

      const fieldName = parts[0];
      let rawType = parts[1];
      const nullable = rawType.endsWith("?");
      if (nullable) rawType = rawType.slice(0, -1);

      const isPrimary = attrMatches.some((a) => a.key === "id");
      const isUpdatedAt = attrMatches.some((a) => a.key === "updatedAt");
      const isUnique = attrMatches.some((a) => a.key === "unique");
      const hasIndex = attrMatches.some((a) => a.key === "index");
      const relationMatch = attrMatches.find((a) => a.key === "relation");
      const defaultMatch = attrMatches.find((a) => a.key === "default");

      const isForeign = !!relationMatch || isModelType(rawType);

      let references: string | null = null;
      if (relationMatch && relationMatch.value) {
        const refMatch = relationMatch.value.match(/references:\s*(\w+)/);
        references = refMatch ? refMatch[1] : null;
      } else if (isForeign) {
        const baseType = rawType.replace(/\[\]$/, "");
        references = baseType;
      }

      if (relationMatch) {
        relations.push(`${modelName}.${fieldName} -> ${references ? `...(${references})` : "..."}`);
      }

      if (isUnique) indexes.push(`unique(${fieldName})`);
      if (hasIndex) indexes.push(`index(${fieldName})`);

      let defaultValue: string | null = null;
      if (defaultMatch && defaultMatch.value) {
        const defMatch = defaultMatch.value.match(/\(([^)]+)\)/);
        defaultValue = defMatch ? defMatch[1] : null;
      }

      columns.push({
        name: fieldName,
        type: rawType,
        nullable,
        defaultValue,
        isPrimary,
        isForeign,
        references,
        isUnique,
        isUpdatedAt,
      });
    }

    models.push({
      name: modelName,
      description: null,
      columns,
      indexes,
      relations,
    });
  }

  return { schemaName: path.basename(filePath, ".prisma"), models };
}

export async function GET() {
  try {
    const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
    const data = parseSchema(schemaPath);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to parse Prisma schema:", error);
    return NextResponse.json({ error: "Failed to load schema" }, { status: 500 });
  }
}
