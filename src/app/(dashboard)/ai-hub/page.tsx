"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { NexaFlowLogo } from "@/components/brand/nexaflow-logo";
import { clientEngine } from "@/lib/client-engine";
import { chat } from "@/lib/llm/client-browser";
import { taskQueue, type Task } from "@/lib/ai-hub/task-queue";
import { MindMapRenderer, type TreeNodeData } from "@/components/ai-hub/MindMapRenderer";
import { ImageSearchPanel } from "@/components/ai-hub/ImageSearchPanel";
import {
  Send,
  Bot,
  Trash2,
  Copy,
  Check,
  Loader2,
  Sparkles,
  ImageIcon,
  Network,
} from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type ResultMode = "mindmap" | "images" | null;

function formatTime(date: Date): string {
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

const CHAT_STORAGE_KEY = "ai-hub-messages";

export default function AIHubPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resultMode, setResultMode] = useState<ResultMode>(null);
  const [mindmapData, setMindmapData] = useState<TreeNodeData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
    const unsubscribe = taskQueue.subscribe(setTasks);
    return unsubscribe;
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const detectIntent = useCallback(async (text: string): Promise<"qa" | "mindmap" | "imagesearch" | "autre"> => {
    const systemPrompt = `Tu es un routeur d'intentions. Analyse la demande de l'utilisateur et retourne UNIQUEMENT un objet JSON valide (pas de markdown, pas de texte avant/après) avec ce format exact:
{"intention":"qa"|"mindmap"|"imagesearch"|"autre","documentId":"<id ou null>","confiance":0.0}

Règles:
- "qa": question simple, recherche de connaissances, résumé
- "mindmap": demande de mind map, schéma, arborescence, organigramme
- "imagesearch": recherche d'image similaire, vision, analyse d'image
- "autre": tâche complexe ou autre

Si un document est mentionné, extrait son id dans documentId, sinon null.`;

    try {
      const response = await chat(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        { temperature: 0, maxTokens: 200 }
      );

      const cleaned = response.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleaned) as { intention: string; documentId?: string | null; confiance: number };
      const intention = parsed.intention as "qa" | "mindmap" | "imagesearch" | "autre";
      if (["qa", "mindmap", "imagesearch", "autre"].includes(intention)) {
        return intention;
      }
    } catch {
      // ignore and fallback
    }

    const lower = text.toLowerCase();
    if (lower.includes("mind map") || lower.includes("schéma") || lower.includes("arborescence") || lower.includes("organigramme")) return "mindmap";
    if (lower.includes("image") || lower.includes("photo") || lower.includes("visuel") || lower.includes("clip")) return "imagesearch";
    if (lower.includes("résume") || lower.includes("question") || lower.includes("quoi") || lower.includes("comment")) return "qa";
    return "autre";
  }, []);

  const handleRAGResponse = useCallback(async (query: string): Promise<string> => {
    try {
      await clientEngine.init();
      const localResults = await clientEngine.searchVector(query, 5);
      const match = localResults.find((r) => r.score >= 0.3);
      if (match) {
        return match.content + "\n\n*Source : base de connaissances locale*";
      }
    } catch {
      // fallback to LLM
    }

    const response = await chat(
      [
        { role: "system", content: "Tu es un assistant utile. Réponds en français de manière concise." },
        { role: "user", content: query },
      ],
      { temperature: 0.7, maxTokens: 512 }
    );

    return response;
  }, []);

  const generateMindMap = useCallback(async (documentId?: string | null): Promise<TreeNodeData> => {
    let textContent = "";

    if (documentId) {
      const doc = await clientEngine.getAllVectorDocuments();
      const found = doc.find((d) => d.id === documentId);
      if (found) {
        textContent = found.chunks.map((c) => c.content).join("\n\n");
      }
    }

    if (!textContent.trim()) {
      const docs = await clientEngine.getAllVectorDocuments();
      if (docs.length > 0) {
        textContent = docs.slice(0, 3).map((d) => d.chunks.map((c) => c.content).join("\n")).join("\n\n");
      }
    }

    if (!textContent.trim()) {
      textContent = "NexaFlow: plateforme d'automatisation industrielle. Modules: Q/R, Chat IA, Mind Map, Recherche d'images, Procédures, Banque d'images, Visioconférence, Rapports, Équipes, Approbations.";
    }

    const response = await chat(
      [
        {
          role: "system",
          content: `Tu es un assistant qui génère des structures hiérarchiques. À partir du texte fourni, génère UNIQUEMENT un objet JSON valide (pas de markdown, pas de texte avant/après) avec ce format:
{"id":"root","label":"Racine","children":[{"id":"c1","label":"Enfant 1","children":[]}]}

Règles:
- Maximum 3 niveaux de profondeur
- Maximum 7 enfants par noeud
- Labels courts et clairs
- Pas de texte hors du JSON`,
        },
        { role: "user", content: `Génère une mind map à partir de ce texte:\n\n${textContent.slice(0, 4000)}` },
      ],
      { temperature: 0.3, maxTokens: 1024 }
    );

    const cleaned = response.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned) as TreeNodeData;
    return parsed;
  }, []);

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

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const intention = await detectIntent(trimmed);

      if (intention === "qa") {
        const answer = await handleRAGResponse(trimmed);
        finishResponse(answer);
        return;
      }

      if (intention === "mindmap") {
        setResultMode("mindmap");

        const result = await taskQueue.add(
          "Génération de la Mind Map",
          async (onProgress) => {
            onProgress(10);
            await new Promise((r) => setTimeout(r, 100));

            onProgress(30);
            const treeData = await generateMindMap(null);

            onProgress(80);
            await new Promise((r) => setTimeout(r, 100));

            setMindmapData(treeData);
            onProgress(100);
            return treeData;
          }
        );

        const treeData = result as TreeNodeData;
        setMindmapData(treeData);
        finishResponse(
          "Mind Map générée avec succès ! Consultez le panneau de droite pour visualiser la structure hiérarchique."
        );
        return;
      }

      if (intention === "imagesearch") {
        setResultMode("images");
        finishResponse(
          "Recherche d'images activée. Utilisez le panneau de droite pour indexer une image et trouver des visuels similaires avec CLIP Vision."
        );
        return;
      }

      const response = await handleRAGResponse(trimmed);
      finishResponse(response);
    } catch (error) {
      console.error("Send error:", error);
      finishResponse("Désolé, une erreur est survenue lors du traitement de votre demande.");
    }
  }, [input, detectIntent, handleRAGResponse, generateMindMap, finishResponse]);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    setInput("");
    sessionStorage.removeItem(CHAT_STORAGE_KEY);
  }, []);

  const handleCopy = useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const activeTasks = tasks.filter((t) => t.status === "running" || t.status === "pending");

  return (
    <section className="flex flex-1 flex-col h-full">
      <header className="border-b border-border bg-background/95 px-4 py-3 sm:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <NexaFlowLogo className="h-8 w-8" />
            <div>
              <h1 className="text-sm font-semibold text-foreground">Centre de Commandement IA</h1>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <p className="text-xs text-muted-foreground">
                  Super Agent • {activeTasks.length > 0 ? `${activeTasks.length} tâche(s) en cours` : "En ligne"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="rounded-xl hover:bg-muted" onClick={handleClearChat} title="Effacer la conversation">
              <Trash2 className="h-4 w-4 text-foreground/60" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col lg:flex-row gap-4 p-4 overflow-hidden">
          <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border/60 bg-background/40">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
              <Bot className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Super Agent Chat</span>
              <Badge variant="outline" className="text-[10px] border-border/60">Groq LLM</Badge>
            </div>

            <ScrollArea className="flex-1 px-4 py-4" ref={scrollAreaRef}>
              <div className="space-y-4 pb-2">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 mb-3">
                      <Sparkles className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      Bienvenue dans le Centre de Commandement IA
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                      Je peux répondre à vos questions, générer des mind maps, ou rechercher des images similaires.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {[
                        "Résume ce document",
                        "Génère une mind map",
                        "Cherche une image similaire",
                      ].map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => setInput(suggestion)}
                          className="text-xs px-3 py-1.5 rounded-full border border-border/60 bg-muted/30 hover:bg-muted text-foreground transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((message, index) => {
                  const isUser = message.role === "user";
                  const showAvatar = !isUser && (index === 0 || messages[index - 1].role !== "assistant");

                  return (
                    <div
                      key={message.id}
                      className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : "flex-row"} ${showAvatar ? "mt-4" : "mt-1"}`}
                    >
                      {showAvatar ? (
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs">
                            <Bot className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-8 shrink-0" />
                      )}

                      <div className={`group flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[85%] sm:max-w-[75%]`}>
                        <Card
                          className={`px-4 py-2.5 text-sm leading-relaxed ${
                            isUser
                              ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
                              : "bg-muted/50 text-foreground rounded-2xl rounded-bl-sm border border-border/50"
                          }`}
                        >
                          <div className="whitespace-pre-wrap break-words">{message.content}</div>
                        </Card>

                        <div className={`flex items-center gap-1.5 mt-1 px-1 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                          <span className="text-[10px] text-muted-foreground">{formatTime(message.timestamp)}</span>
                          {isUser && <Check className="h-3 w-3 text-muted-foreground/50" />}
                        </div>

                        {!isUser && (
                          <div className="mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon-xs" className="h-6 w-6" onClick={() => handleCopy(message.id, message.content)}>
                              {copiedId === message.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isTyping && (
                  <div className="flex items-end gap-2 mt-4">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <Card className="bg-muted/50 border border-border/50 rounded-2xl rounded-bl-sm px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        <span className="text-xs text-muted-foreground">L&apos;assistant réfléchit</span>
                      </div>
                    </Card>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <Separator />
            <div className="border-t border-border bg-background px-4 py-3 pb-4">
              <div className="flex items-end gap-2">
                <div className="relative w-full">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Envoyez une commande au Super Agent..."
                    className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-24"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Button variant="default" size="icon" className="h-7 w-7 rounded-lg" onClick={handleSend} disabled={!input.trim() || isTyping}>
                      {isTyping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
              <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
                Appuyez sur Entrée pour envoyer • Le Super Agent détecte automatiquement l&apos;intention
              </p>
            </div>
          </div>

          <div className="w-full lg:w-[420px] shrink-0 flex flex-col overflow-hidden rounded-xl border border-border/60 bg-background/40">
            <Tabs value={resultMode ?? "mindmap"} onValueChange={(v) => setResultMode(v as ResultMode)} className="flex flex-col h-full">
              <TabsList className="rounded-none border-b border-border/40 bg-transparent px-2 pt-2">
                <TabsTrigger value="mindmap" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <Network className="h-3.5 w-3.5" />
                  Mind Map
                </TabsTrigger>
                <TabsTrigger value="images" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <ImageIcon className="h-3.5 w-3.5" />
                  Images
                </TabsTrigger>
              </TabsList>

              <TabsContent value="mindmap" className="flex-1 overflow-auto p-3 mt-0 data-[state=inactive]:hidden">
                {mindmapData ? (
                  <MindMapRenderer data={mindmapData} width={380} height={460} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <Network className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground">
                      Demandez une mind map pour visualiser une structure hiérarchique
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="images" className="flex-1 overflow-auto p-3 mt-0 data-[state=inactive]:hidden">
                <ImageSearchPanel />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {activeTasks.length > 0 && (
          <div className="mx-4 mb-4 rounded-xl border border-border/60 bg-background/60 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span className="text-xs font-medium text-foreground">Tâches en cours</span>
              <span className="text-[10px] text-muted-foreground ml-auto">{activeTasks.length} tâche(s)</span>
            </div>
            <div className="space-y-2">
              {activeTasks.map((task) => (
                <div key={task.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground">{task.label}</span>
                    <span className="text-[10px] text-muted-foreground">{task.progress}%</span>
                  </div>
                  <Progress value={task.progress} className="h-1.5" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
