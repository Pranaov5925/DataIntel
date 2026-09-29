/**
 * searxng-client.ts - Local SearXNG search client
 */

import dotenv from "dotenv";

export interface SearxngResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  query: string;
}

export function getSearxngUrl(): string {
  dotenv.config({ override: true });
  return (process.env["SEARXNG_URL"] || "http://localhost:8088").replace(/\/+$/, "");
}

export async function checkSearxngHealth(baseUrl: string = getSearxngUrl()): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const res = await fetch(`${baseUrl}/search?q=test&format=json`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      return {
        ok: false,
        error: `SearXNG returned HTTP ${res.status}: ${res.statusText}`,
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function searchSearxng(
  query: string,
  options: { maxResults?: number } = {},
): Promise<SearxngResult[]> {
  const baseUrl = getSearxngUrl();
  const maxResults = options.maxResults || 5;

  const url = `${baseUrl}/search?q=${encodeURIComponent(query)}&format=json&language=en`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });
  } catch (netErr) {
    throw new Error(
      `SearXNG is not reachable at ${baseUrl} (${netErr instanceof Error ? netErr.message : String(netErr)}). ` +
      `Please ensure your local SearXNG Docker container is running: ` +
      `'docker compose -f services/searxng/docker-compose.yml up -d'`,
    );
  }

  if (!res.ok) {
    throw new Error(
      `SearXNG search failed with status ${res.status}: ${res.statusText}. ` +
      `Check if JSON format is enabled in services/searxng/searxng/settings.yml`,
    );
  }

  const data = (await res.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      engine?: string;
    }>;
  };

  const rawResults = data.results || [];
  const parsedResults: SearxngResult[] = [];

  for (const item of rawResults) {
    const itemUrl = item.url?.trim() || "";
    if (!itemUrl || !itemUrl.startsWith("http")) continue;

    let source = item.engine || "Web Search";
    try {
      source = new URL(itemUrl).hostname.replace(/^www\./, "");
    } catch {
      // keep engine
    }

    parsedResults.push({
      title: item.title?.trim() || "Untitled",
      url: itemUrl,
      snippet: item.content?.trim() || "",
      source,
      query,
    });

    if (parsedResults.length >= maxResults) break;
  }

  return parsedResults;
}
