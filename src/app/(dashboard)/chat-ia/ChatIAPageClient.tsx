"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ChatInput } from "@/components/chat/ChatInput";
import { QuickSuggestions } from "@/components/chat/QuickSuggestions";
import { qrService } from "@/lib/qr/mock-service";
import { clientEngine } from "@/lib/client-engine";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

const CHAT_STORAGE_KEY = "chat-ia-messages";

const QUICK_SUGGESTIONS = [
  "Quelle est la température ?",
  "Allume le relais 1",
  "Liste des périphériques",
  "Comment créer une procédure ?",
];

export function ChatIAPageClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesLoadedRef = useRef(false);

  useEffect(() => {
    if (messagesLoadedRef.current) return;
    messagesLoadedRef.current = true;

    try {
      const raw = sessionStorage.getItem(CHAT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Array<{ id: string; role: "user" | "assistant"; content: string; timestamp: string }>;
      const loaded: Message[] = parsed.map((m) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      }));
      if (loaded.length > 0) setMessages(loaded);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  const finishResponse = useCallback((response: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
      },
    ]);
    setIsTyping(false);
  }, []);

  const simulateResponse = useCallback(
    (userMessage: string) => {
      setIsTyping(true);

      setTimeout(async () => {
        const lower = userMessage.toLowerCase();

        if (
          lower.includes("bonjour") ||
          lower.includes("salut") ||
          lower.includes("hello")
        ) {
          finishResponse(
            "Bonjour ! Je suis là pour vous aider. Posez-moi vos questions sur NexaFlow."
          );
          return;
        }

        try {
          const results = await qrService.search(userMessage);
          const match = results.find((r) => r.score >= 0.5);
          if (match) {
            finishResponse(
              match.answer +
                "\n\n*Source : base de connaissances Q/R de NexaFlow*"
            );
            return;
          }
        } catch {
          // Q/R search unavailable — fall through to local search
        }

        try {
          await clientEngine.init();
          const localResults = await clientEngine.searchPairs(userMessage, 5);
          const localMatch = localResults.find((r) => r.score >= 0.5);
          if (localMatch) {
            finishResponse(
              localMatch.answer +
                "\n\n*Source : base de connaissances locale*"
            );
            return;
          }
        } catch {
          // local search unavailable — fall through to keyword responses
        }

        let response = "";

        if (
          lower.includes("créer") ||
          lower.includes("procedure") ||
          lower.includes("procédure")
        ) {
          response =
            "Pour créer une procédure, rendez-vous sur la page dédiée et suivez les 3 étapes : définir le déclencheur, ajouter des actions, puis tester et publier.";
        } else if (
          lower.includes("prix") ||
          lower.includes("tarif") ||
          lower.includes("abonnement")
        ) {
          response =
            "Nos tarifs : Starter gratuit, Pro à 49$/mois, Enterprise sur mesure. Plus d'infos sur la page Pricing.";
        } else if (
          lower.includes("connecter") ||
          lower.includes("intégration") ||
          lower.includes("outil")
        ) {
          response =
            "NexaFlow supporte plus de 200 intégrations natives : Slack, GitHub, Notion, Linear, et bien d'autres. Un SDK est aussi disponible pour vos outils custom.";
        } else if (
          lower.includes("allume") ||
          lower.includes("éteins") ||
          lower.includes("active") ||
          lower.includes("désactive") ||
          lower.includes("relais") ||
          lower.includes("servo") ||
          lower.includes("led") ||
          lower.includes("actionneur")
        ) {
          const isOn = lower.includes("allume") || lower.includes("active");
          const isOff = lower.includes("éteins") || lower.includes("désactive");

          if (isOn || isOff) {
            let actuatorId: string | null = null;
            if (lower.includes("relais 1") || lower.includes("relais principal")) actuatorId = "relay-1";
            else if (lower.includes("servo")) actuatorId = "servo-1";
            else if (lower.includes("led")) actuatorId = "led-1";

            if (actuatorId) {
              try {
                const result = await clientEngine.commandActuator(actuatorId, isOn);
                response = result.message;
              } catch {
                response = `Erreur lors de la commande de l'actionneur ${actuatorId}.`;
              }
            } else {
              response = "Je n'ai pas reconnu l'actionneur. Essayez : 'Allume le relais 1'.";
            }
          } else {
            response = "Pour commander un actionneur, utilisez : 'Allume le relais 1', 'Éteins le servo', etc.";
          }
        } else if (
          lower.includes("température") ||
          lower.includes("capteur") ||
          lower.includes("camera") ||
          lower.includes("caméra") ||
          lower.includes("microphone") ||
          lower.includes("micro") ||
          lower.includes("lecture") ||
          lower.includes("valeur")
        ) {
          let sensorId: string | null = null;
          if (lower.includes("température")) sensorId = "temp-main";
          else if (lower.includes("camera") || lower.includes("caméra")) sensorId = "camera-main";
          else if (lower.includes("microphone") || lower.includes("micro")) sensorId = "mic-main";

          if (sensorId) {
            try {
              const result = await clientEngine.readSensor(sensorId);
              response = result.message;
            } catch {
              response = `Erreur lors de la lecture du capteur ${sensorId}.`;
            }
          } else {
            response = "Je n'ai pas reconnu le capteur. Essayez : 'Quelle est la température ?', 'Lecture du microphone', etc.";
          }
        } else if (
          lower.includes("état") ||
          lower.includes("status") ||
          lower.includes("statut") ||
          lower.includes("dashboard") ||
          lower.includes("tableau de bord")
        ) {
          try {
            const status = await clientEngine.getDeviceStatus();
            const activeActuators = status.actuators.filter((a) => a.isOn).length;
            const sensorSummary = status.sensors.map((s) => `${s.name}: ${s.value}${s.unit}`).join(", ");
            response = `Système IoT : ${activeActuators} actionneur(s) actif(s). Capteurs : ${sensorSummary}.`;
          } catch {
            response = "Je n'ai pas pu récupérer l'état du système.";
          }
        } else if (
          lower.includes("ajoute") ||
          lower.includes("ajouter") ||
          lower.includes("nouveau périphérique") ||
          lower.includes("nouveau capteur") ||
          lower.includes("nouvel actionneur") ||
          lower.includes("supprime") ||
          lower.includes("supprimer") ||
          lower.includes("liste") ||
          lower.includes("affiche") ||
          lower.includes("montre")
        ) {
          try {
            await clientEngine.init();
            const devices = await clientEngine.getAllDevices();

            if (lower.includes("ajoute") || lower.includes("ajouter") || lower.includes("nouveau")) {
              response = `Pour ajouter un périphérique, rendez-vous sur la page Périphériques ou donnez-moi les détails : identifiant, nom, type (capteur/actionneur/caméra), sous-type et adresse IP.`;
            } else if (lower.includes("supprime") || lower.includes("supprimer")) {
              const deviceToDelete = devices.find((d) => lower.includes(d.id) || lower.includes(d.name.toLowerCase()));
              if (deviceToDelete) {
                await clientEngine.deleteDevice(deviceToDelete.id);
                response = `Périphérique "${deviceToDelete.name}" (${deviceToDelete.id}) supprimé avec succès.`;
              } else {
                response = "Je n'ai pas reconnu le périphérique à supprimer. Essayez : 'Supprime le relais 1'.";
              }
            } else {
              const summary = devices.map((d) => `• ${d.name} (${d.id}) - ${d.type}${d.subtype ? `/${d.subtype}` : ""} - ${d.ipAddress ?? "sans IP"}`).join("\n");
              response = `Périphériques enregistrés :\n${summary}`;
            }
          } catch {
            response = "Erreur lors de l'accès à la liste des périphériques.";
          }
        } else {
          response =
            "Je comprends votre demande. Pour aller plus loin, je vous invite à consulter notre section Q/R ou à contacter notre support.";
        }

        finishResponse(response);
      }, 1000);
    },
    [finishResponse]
  );

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    simulateResponse(trimmed);
  }, [input, simulateResponse]);

  const handleClear = useCallback(() => {
    setMessages([]);
    setInput("");
    sessionStorage.removeItem(CHAT_STORAGE_KEY);
    toast.success("Conversation effacée");
  }, []);

  const handleCopy = useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast.success("Message copié");
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleVoiceTranscript = useCallback((text: string) => {
    setInput(text);
  }, []);

  const handleSuggestionSelect = useCallback((suggestion: string) => {
    setInput(suggestion);
  }, []);

  return (
    <div className="flex flex-1 flex-col h-full relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

      <ChatHeader isOnline={!isTyping} isThinking={isTyping} onClear={handleClear} />

      <ChatMessages
        messages={messages}
        isTyping={isTyping}
        copiedId={copiedId}
        onCopy={handleCopy}
      />

      <QuickSuggestions suggestions={QUICK_SUGGESTIONS} onSelect={handleSuggestionSelect} />

      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onTranscript={handleVoiceTranscript}
        disabled={isTyping}
        placeholder="Écrivez votre message..."
      />
    </div>
  );
}
