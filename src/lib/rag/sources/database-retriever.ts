import type { Retriever, RetrievedChunk } from "../base";
import { clientEngine } from "@/lib/client-engine";

type KnownModel = "QARegistry" | "QAPair" | "TreeNode" | "Procedure" | "ProcedureExecution" | "ExecutionStep" | "ExecutionMedia" | "MediaItem" | "MediaCategory";

export class DatabaseRetriever implements Retriever {
  name = "database";

  async retrieve(query: string, _topK = 5): Promise<RetrievedChunk[]> {
    const model = this.detectModel(query);
    if (!model) return [];

    try {
      const results = await clientEngine.searchVector(query, _topK);
      if (results.length > 0) {
        return results.map((r) => ({
          content: r.content,
          score: r.score,
          source: `database://${model}`,
          metadata: { model, ...r.metadata },
        }));
      }

      return [
        {
          content: `Modèle ${model}: recherche effectuée mais aucun résultat trouvé pour "${query}"`,
          score: 0.5,
          source: `database://${model}`,
          metadata: { model, rowCount: 0 },
        },
      ];
    } catch {
      return [];
    }
  }

  private detectModel(query: string): KnownModel | null {
    const lower = query.toLowerCase();
    if (lower.includes("procédure") || lower.includes("procedure") || lower.includes("execution") || lower.includes("étape")) {
      if (lower.includes("media") || lower.includes("photo") || lower.includes("vidéo")) return "ExecutionMedia";
      if (lower.includes("execution") || lower.includes("statut")) return "ProcedureExecution";
      return "Procedure";
    }
    if (lower.includes("question") || lower.includes("réponse") || lower.includes("q/r") || lower.includes("paire")) {
      return "QAPair";
    }
    if (lower.includes("registre") || lower.includes("base q/r") || lower.includes("connaissance")) {
      return "QARegistry";
    }
    if (lower.includes("fichier") || lower.includes("dossier") || lower.includes("arborescence") || lower.includes("tree")) {
      return "TreeNode";
    }
    if (lower.includes("image") || lower.includes("photo") || lower.includes("vidéo") || lower.includes("vidéo") || lower.includes("média") || lower.includes("banque d'images") || lower.includes("catégorie d'image")) {
      return "MediaItem";
    }
    return null;
  }
}

export const databaseRetriever = new DatabaseRetriever();
