import type { Retriever, RetrievedChunk } from "../base";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export class WebRetriever implements Retriever {
  name = "web";

  async retrieve(query: string, topK = 3): Promise<RetrievedChunk[]> {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (!apiKey || apiKey === "change_me_brave_search_api_key") {
      return [];
    }

    try {
      const res = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${topK}`,
        {
          headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
        }
      );

      if (!res.ok) {
        return [];
      }

      const data = (await res.json()) as { web?: { results?: SearchResult[] } };
      const results = data.web?.results ?? [];

      return results.map((r) => ({
        content: `${r.title}\n${r.snippet}\nSource: ${r.url}`,
        score: 0.8,
        source: r.url,
        metadata: { title: r.title, url: r.url },
      }));
    } catch {
      return [];
    }
  }
}

export const webRetriever = new WebRetriever();
