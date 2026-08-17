import { chat as browserChat, type LLMMessage } from "@/lib/llm/client-browser";
import { localRetriever } from "./sources/local-retriever";
import { vectorRetriever } from "./sources/vector-retriever";
import { webRetriever } from "./sources/web-retriever";
import { databaseRetriever } from "./sources/database-retriever";
import type { RagContext, RagResult, RouterDecision } from "./types";

const ROUTER_SYSTEM_PROMPT = `Tu es un routeur intelligent pour un assistant RAG. Analyse la question de l'utilisateur et détermine la ou les sources de données les plus pertinentes.

Catégories de sources :
- "local" : connaissances internes, fichiers JSON locaux, base Q/R, procédures internes
- "vector" : recherche sémantique dans les documents vectorisés
- "web" : actualités, réglementations à jour, informations externes, code de la route officiel
- "database" : statistiques, comptes, données structurées (QARegistry, QAPair, Procedure, TreeNode, ExecutionStep, ExecutionMedia)

Règles de décision :
1. Si la question contient des mots comme "combien", "statistique", "nombre", "liste", "tous les", utilise "database".
2. Si la question contient des mots comme "actualité", "loi 2026", "nouveau", "réglementation", "code de la route", utilise "web".
3. Si la question contient des mots comme "procédure", "manuel", "comment faire", "mode d'emploi", utilise "local".
4. Si la question contient des mots comme "similaire", "ressemble", "contexte", "sémantique", utilise "vector".
5. Si la question est générale ou ambiguë, choisis "local" par défaut.

Réponds UNIQUEMENT par un objet JSON valide :
{
  "primary": "local" | "vector" | "web" | "database",
  "secondary": ["local", "vector", "web", "database"][] | null,
  "reason": "explication courte"
}

Ne retourne JAMAIS de texte hors du JSON.`;

export class RagOrchestrator {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async answerQuery(userQuery: string, chatHistory: string[] = []): Promise<RagResult> {
    const routerDecision = await this.routeQuery(userQuery);
    const contexts = await this.gatherContexts(userQuery, routerDecision);
    const fused = this.fuseContexts(contexts);
    const answer = await this.generateResponse(userQuery, fused, chatHistory);

    return {
      answer,
      contexts,
      route: `${routerDecision.primary}${routerDecision.secondary?.length ? `+${routerDecision.secondary.join("+")}` : ""}`,
    };
  }

  private async routeQuery(query: string): Promise<RouterDecision> {
    try {
      const messages: LLMMessage[] = [
        { role: "system", content: ROUTER_SYSTEM_PROMPT },
        { role: "user", content: query },
      ];
      const raw = await browserChat(messages, { temperature: 0, maxTokens: 150, apiKey: this.apiKey });
      const cleaned = raw.trim().replace(/^```json\n?|\n```$/g, "").replace(/^```\n?|\n```$/g, "");
      const parsed = JSON.parse(cleaned) as Omit<RouterDecision, "reason"> & { reason?: string };
      return {
        primary: parsed.primary ?? "local",
        secondary: parsed.secondary ?? [],
        reason: parsed.reason ?? "fallback",
      };
    } catch {
      return { primary: "local", secondary: [], reason: "router-failed" };
    }
  }

  private async gatherContexts(query: string, decision: RouterDecision): Promise<RagContext[]> {
    const contexts: RagContext[] = [];
    const retrievers: Record<string, typeof localRetriever> = {
      local: localRetriever,
      vector: vectorRetriever,
      web: webRetriever,
      database: databaseRetriever,
    };

    const runRetriever = async (key: "local" | "vector" | "web" | "database") => {
      const retriever = retrievers[key];
      if (!retriever) return;
      try {
        const chunks = await retriever.retrieve(query, 5);
        if (chunks.length > 0) {
          contexts.push({
            source: key as RagContext["source"],
            content: chunks.map((c) => c.content).join("\n\n"),
            metadata: { chunks: chunks.length, topScore: chunks[0].score },
          });
        }
      } catch {
        // retriever failed — skip
      }
    };

    await runRetriever(decision.primary);

    if (decision.secondary && decision.secondary.length > 0) {
      await Promise.all(decision.secondary.map((s) => runRetriever(s as "local" | "vector" | "web" | "database")));
    }

    if (contexts.length === 0) {
      await runRetriever("local");
      await runRetriever("vector");
    }

    return contexts;
  }

  private async rerank(query: string, chunks: { content: string; score: number; source: string }[]): Promise<{ content: string; score: number; source: string }[]> {
    if (chunks.length <= 3) return chunks;

    try {
      const prompt = `Tu es un re-rankeur. Évalue la pertinence de chaque chunk pour la question de l'utilisateur.
Question : "${query}"

Chunks :
${chunks.map((c, i) => `[${i}] (source: ${c.source}, score initial: ${c.score.toFixed(2)})\n${c.content.slice(0, 500)}`).join("\n\n")}

Réponds UNIQUEMENT par un tableau JSON des indices des chunks à garder, triés par ordre de pertinence décroissante, maximum 4 chunks.
Exemple : [2, 0, 3]`;

      const messages: LLMMessage[] = [
        { role: "system", content: "Tu réponds UNIQUEMENT par un tableau JSON d'indices, sans texte supplémentaire." },
        { role: "user", content: prompt },
      ];

      const raw = await browserChat(messages, { temperature: 0, maxTokens: 100, apiKey: this.apiKey });
      const cleaned = raw.trim().replace(/^```json\n?|\n```$/g, "").replace(/^```\n?|\n```$/g, "");
      const parsed = JSON.parse(cleaned) as number[];

      const validIndices = Array.isArray(parsed) ? parsed.filter((i) => i >= 0 && i < chunks.length).slice(0, 4) : [];
      if (validIndices.length > 0) {
        return validIndices.map((i) => chunks[i]);
      }
    } catch {
      // re-ranking failed — keep original order
    }

    return chunks.slice(0, 4);
  }

  private fuseContexts(contexts: RagContext[]): string {
    if (contexts.length === 0) {
      return "Aucun contexte trouvé. Réponds honnêtement que tu ne sais pas.";
    }

    const blocks = contexts.map((ctx) => {
      const label = ctx.source.toUpperCase();
      return `=== ${label} ===\n${ctx.content}`;
    });

    return blocks.join("\n\n");
  }

  private async generateResponse(
    query: string,
    fusedContext: string,
    chatHistory: string[]
  ): Promise<string> {
    const systemPrompt = `Tu es un assistant expert francophone pour le projet NexaFlow / CCP.
Tu réponds STRICTEMENT à partir du contexte fourni.
Si le contexte ne contient pas la réponse, dis honnêtement que tu ne sais pas.
Sois concis, clair et bienveillant.
Cite toujours tes sources entre crochets, ex: [LOCAL], [VECTOR], [WEB], [DATABASE].

Contexte :
${fusedContext}

Historique de conversation (si présent) :
${chatHistory.length > 0 ? chatHistory.slice(-4).join("\n") : "(aucun)"}`;

    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: query },
    ];

    return browserChat(messages, { temperature: 0.7, maxTokens: 1024, apiKey: this.apiKey });
  }
}

export function createRagOrchestrator(apiKey?: string): RagOrchestrator {
  return new RagOrchestrator(apiKey);
}
