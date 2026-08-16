import { NextResponse } from "next/server";
import { chat, LLMMessage } from "@/lib/llm/client";

export const dynamic = "force-dynamic";

export interface ChatRequestBody {
  message: string;
  step: Record<string, unknown>;
  stepIndex: number;
  totalSteps: number;
  phase: string;
  procedureContext?: Record<string, unknown>;
}

function buildSystemPrompt(body: ChatRequestBody): string {
  const { step, stepIndex, totalSteps, phase, procedureContext } = body;

  let context = `Tu es un assistant technique francophone qui accompagne un utilisateur dans une procédure industrielle.\n\n`;

  if (procedureContext?.metadata) {
    const meta = procedureContext.metadata as Record<string, unknown>;
    context += `Procédure : ${meta.title || "Inconnue"} (code: ${meta.code || "N/A"})\n`;
    if (meta.description) context += `Description : ${meta.description}\n`;
    if (meta.category) context += `Catégorie : ${meta.category}\n`;
    if (Array.isArray(meta.globalSafetyInstructions)) {
      context += `Consignes de sécurité globales :\n`;
      meta.globalSafetyInstructions.forEach((instruction: string, i: number) => {
        context += `  ${i + 1}. ${instruction}\n`;
      });
    }
  }

  context += `\nPhase actuelle : ${phase}\n`;
  context += `Étape ${stepIndex + 1} sur ${totalSteps} : ${step.title || "Sans titre"}\n`;
  context += `Type : ${step.type || "inconnu"}\n`;
  if (step.instructions) context += `Instructions : ${step.instructions}\n`;
  if (step.isMandatory) context += `Cette étape est obligatoire.\n`;
  if (step.timerEnabled && typeof step.timerSeconds === "number" && step.timerSeconds > 0) {
    context += `Chronomètre : ${Math.floor(step.timerSeconds / 60)} minute(s).\n`;
  }
  if (Array.isArray(step.mediaRequirements) && step.mediaRequirements.length > 0) {
    context += `Captures média requises :\n`;
    step.mediaRequirements.forEach((m: Record<string, unknown>) => {
      const type = String(m.type || "");
      const mandatory = m.mandatory ? " (obligatoire)" : "";
      context += `  - ${type}${mandatory}\n`;
    });
  }
  if (Array.isArray(step.alarms) && step.alarms.length > 0) {
    context += `Alertes configurées sur cette étape :\n`;
    step.alarms.forEach((a: Record<string, unknown>) => {
      context += `  - [${a.type}] ${a.condition} : ${a.message}\n`;
    });
  }
  if (Array.isArray(step.dependencies) && step.dependencies.length > 0) {
    context += `Dépendances : ${step.dependencies.join(", ")}\n`;
  }

  context += `\nInstructions pour toi :\n`;
  context += `- Réponds toujours en français.\n`;
  context += `- Sois concis, clair et bienveillant.\n`;
  context += `- Si l'utilisateur demande des informations sur la sécurité, les médias, le temps ou les étapes, utilise les informations ci-dessus.\n`;
  context += `- Si tu ne sais pas, dis-le honnêtement.\n`;

  return context;
}

export async function POST(request: Request) {
  try {
    const body: ChatRequestBody = await request.json();

    if (!body.message || !body.step) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt(body);
    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: body.message },
    ];

    const response = await chat(messages, { temperature: 0.7, maxTokens: 1024 });

    return NextResponse.json({ response });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process chat" },
      { status: 500 }
    );
  }
}
