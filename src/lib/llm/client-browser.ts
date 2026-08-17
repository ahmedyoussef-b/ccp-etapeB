export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
}

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

function getPublicApiKey(): string | undefined {
  if (typeof process === "undefined") return undefined;
  const key = process.env.NEXT_PUBLIC_GROQ_API_KEY;
  if (!key || key.length < 16) return undefined;
  return key;
}

export async function chat(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
  const apiKey = options.apiKey || getStoredApiKey() || getPublicApiKey();
  if (!apiKey) {
    throw new Error("Aucune clé API LLM configurée. Veuillez fournir une clé API.");
  }

  try {
    return await callGroq(messages, options, apiKey);
  } catch (error) {
    console.error("LLM API error:", error);
    throw error;
  }
}

async function callGroq(messages: LLMMessage[], options: LLMOptions, apiKey: string): Promise<string> {
  const response = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model || GROQ_MODEL,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

export function getStoredApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('llm_api_key');
}

export function setStoredApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('llm_api_key', key);
}

export function hasStoredApiKey(): boolean {
  if (typeof window === 'undefined') return false;
  const key = localStorage.getItem('llm_api_key');
  return !!key && key.length > 16;
}
