import { TStep } from "../services/validator.service";
import { GuidePhase } from "../types";
import { proceduresFR } from "../../i18n/procedures";
import { csrfFetch } from "@/lib/procedures/csrf-fetch";

export interface AssistantAdvicePayload {
  step: TStep;
  stepIndex: number;
  totalSteps: number;
  phase: GuidePhase;
  userMessage?: string;
  procedureId?: string;
}

function getStepTypeAdvice(type: TStep["type"]): string {
  switch (type) {
    case "consigne_simple":
      return "Suivez attentivement les consignes. Relisez chaque point avant d'agir.";
    case "saisie_donnees":
      return "Saisissez les données avec précision. Une erreur de saisie peut compromettre la procédure.";
    case "inspection_visuelle":
      return "Vérifiez minutieusement l'état des équipements. Signalez toute anomalie.";
    case "validation_securite":
      return "Cette étape est critique pour la sécurité. Vérifiez scrupuleusement chaque point.";
    case "mesure_numerique":
      return "Utilisez l'appareil calibré. Notez la valeur et vérifiez l'unité.";
    default:
      return "Respectez les consignes affichées.";
  }
}

export function generateAssistantAdvice(payload: AssistantAdvicePayload): string {
  const { step, stepIndex, totalSteps, phase, userMessage } = payload;
  const lines: string[] = [];

  if (userMessage) {
    const lower = userMessage.toLowerCase();
    if (lower.includes("sécurité") || lower.includes("danger") || lower.includes("alerte")) {
      if (step.alarms.length > 0) {
        const dangerAlarm = step.alarms.find((a) => a.type === "DANGER");
        lines.push(
          `🚨 Alerte détectée : ${dangerAlarm?.message || "Vérifiez les conditions d'alarme sur cette étape."}`
        );
      } else {
        lines.push("✅ Aucune alerte critique sur cette étape. Restez vigilant.");
      }
      return lines.join("\n");
    }

    if (lower.includes("média") || lower.includes("photo") || lower.includes("vidéo")) {
      if (step.mediaRequirements.length > 0) {
        const mediaList = step.mediaRequirements
          .map((m) => `${proceduresFR.media[m.type] || m.type}${m.mandatory ? " (obligatoire)" : ""}`)
          .join(", ");
        lines.push(`📸 Captures requises : ${mediaList}.`);
      } else {
        lines.push("Aucune capture média n'est requise pour cette étape.");
      }
      return lines.join("\n");
    }

    if (lower.includes("obligatoire") || lower.includes("bloquant")) {
      lines.push(
        step.isMandatory
          ? "🔒 Cette étape est obligatoire. Vous ne pouvez pas la skipper."
          : "Cette étape n'est pas obligatoire, mais elle est recommandée."
      );
      return lines.join("\n");
    }

    if (lower.includes("temps") || lower.includes("durée")) {
      if (step.timerEnabled && step.timerSeconds > 0) {
        const mins = Math.floor(step.timerSeconds / 60);
        lines.push(`⏱️ Chronomètre activé : ${mins} minute(s) maximum.`);
      } else {
        lines.push("Aucun chronomètre n'est configuré pour cette étape.");
      }
      return lines.join("\n");
    }

    if (lower.includes("étape") || lower.includes("quoi faire")) {
      lines.push(`📌 Étape ${stepIndex + 1}/${totalSteps} : ${step.title || "Sans titre"}.`);
      lines.push(step.instructions || "Suivez les consignes affichées.");
      return lines.join("\n");
    }
  }

  lines.push(`📌 **Étape ${stepIndex + 1}/${totalSteps}** — ${step.title || "Sans titre"}`);
  lines.push(getStepTypeAdvice(step.type));

  if (phase === "briefing") {
    lines.push("🎯 Briefing : Prenez connaissance des objectifs et des consignes de sécurité avant de commencer.");
    return lines.join("\n");
  }

  if (phase === "prerequisites") {
    lines.push("✅ Vérifiez que tous les prérequis sont remplis avant de démarrer.");
    return lines.join("\n");
  }

  if (step.isMandatory) {
    lines.push("🔒 Cette étape est **obligatoire**. Elle ne peut pas être ignorée.");
  }

  if (step.timerEnabled && step.timerSeconds > 0) {
    const mins = Math.floor(step.timerSeconds / 60);
    lines.push(`⏱️ Chronomètre activé : vous disposez de ${mins} minute(s) maximum.`);
  }

  if (step.mediaRequirements.length > 0) {
    lines.push("📸 N'oubliez pas les captures média requises :");
    step.mediaRequirements.forEach((m) => {
      lines.push(`  - ${proceduresFR.media[m.type] || m.type}${m.mandatory ? " (obligatoire)" : ""}`);
    });
  }

  if (step.alarms.length > 0) {
    lines.push("🚨 Alertes configurées sur cette étape :");
    step.alarms.forEach((alarm) => {
      lines.push(`  - [${alarm.type}] ${alarm.condition} : ${alarm.message}`);
    });
  }

  if (stepIndex === 0) {
    lines.push("🚀 Première étape de la procédure. Prenez le temps de bien comprendre.");
  } else if (stepIndex === totalSteps - 1) {
    lines.push("🏁 Dernière étape ! Une fois terminée, la procédure sera achevée.");
  }

  if (step.dependencies.length > 0) {
    lines.push("🔗 Cette étape dépend d'autres étapes. Assurez-vous qu'elles sont complétées.");
  }

  return lines.join("\n");
}

export async function callLLMAssistant(payload: AssistantAdvicePayload): Promise<string> {
  const procedureId = payload.procedureId || "default";
  const url = `/api/procedures/guide/${encodeURIComponent(procedureId)}/chat`;

  try {
    const response = await csrfFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: payload.userMessage || "Donne-moi des conseils pour cette étape.",
        step: payload.step,
        stepIndex: payload.stepIndex,
        totalSteps: payload.totalSteps,
        phase: payload.phase,
      }),
    });

    if (!response.ok) {
      throw new Error(`API responded with ${response.status}`);
    }

    const data = await response.json();
    if (data.response && typeof data.response === "string") {
      return data.response;
    }
    throw new Error("Invalid response format");
  } catch (error) {
    console.error("LLM assistant error, falling back to mock:", error);
    return generateAssistantAdvice(payload);
  }
}
