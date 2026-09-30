/**
 * crawl4ai-client.ts - Local Crawl4AI Python service client
 */

import dotenv from "dotenv";

export interface CrawlResult {
  url: string;
  title: string;
  markdown: string;
}

export function getCrawl4aiUrl(): string {
  dotenv.config({ override: true });
  return (process.env["CRAWL4AI_URL"] || "http://127.0.0.1:11235").replace(/\/+$/, "");
}

export async function checkCrawl4aiHealth(baseUrl: string = getCrawl4aiUrl()): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const res = await fetch(`${baseUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      return {
        ok: false,
        error: `Crawl4AI service returned HTTP ${res.status}: ${res.statusText}`,
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

export async function crawlUrl(url: string): Promise<CrawlResult> {
  const baseUrl = getCrawl4aiUrl();

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/crawl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (netErr) {
    throw new Error(
      `Crawl4AI service is not reachable at ${baseUrl} (${netErr instanceof Error ? netErr.message : String(netErr)}). ` +
      `Please ensure your local Python Crawl4AI service is running: ` +
      `'python services/crawler/server.py'`,
    );
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Crawl4AI crawl failed for ${url} [${res.status}]: ${errorText || res.statusText}`);
  }

  const data = (await res.json()) as { url?: string; title?: string; markdown?: string };
  return {
    url: data.url || url,
    title: data.title || "",
    markdown: data.markdown || "",
  };
}
