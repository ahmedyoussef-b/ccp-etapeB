export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

const PLACEHOLDER_KEYS = new Set([
  "change_me_groq_api_key",
  "change_me_azure_openai_api_key",
  "your_api_key_here",
  "placeholder",
  "changeme",
]);

function isPlaceholderKey(key: string | undefined): boolean {
  if (!key) return true;
  if (PLACEHOLDER_KEYS.has(key.toLowerCase().trim())) return true;
  if (key.length < 16) return true;
  return false;
}

export async function chat(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  const azureKey = process.env.AZURE_OPENAI_API_KEY;
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

  if (!isPlaceholderKey(groqKey)) {
    try {
      return await callGroq(messages, options);
    } catch (error) {
      console.error("Groq API error:", error);
      if (!isPlaceholderKey(azureKey) && azureEndpoint && azureDeployment && azureKey) {
        return await callAzureOpenAI(messages, options, azureEndpoint, azureDeployment, azureKey);
      }
      throw error;
    }
  }

  if (!isPlaceholderKey(azureKey) && azureEndpoint && azureDeployment && azureKey) {
    return await callAzureOpenAI(messages, options, azureEndpoint, azureDeployment, azureKey);
  }

  throw new Error("No LLM API key configured");
}

async function callGroq(messages: LLMMessage[], options: LLMOptions): Promise<string> {
  const response = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY ?? ""}`,
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

async function callAzureOpenAI(
  messages: LLMMessage[],
  options: LLMOptions,
  endpoint: string,
  deployment: string,
  apiKey: string
): Promise<string> {
  const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-15-preview`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Azure OpenAI error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}
