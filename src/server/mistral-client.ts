import { Mistral } from "@mistralai/mistralai";
import "dotenv/config";

export const MISTRAL_DEFAULT_MODEL = "mistral-small-latest";

export function getMistralApiKey(): string {
  const key = process.env["MISTRAL_API_KEY"]?.trim();
  if (!key) {
    throw new Error(
      "MISTRAL_API_KEY is not configured. Please set MISTRAL_API_KEY in your .env file.",
    );
  }
  return key;
}

let cachedClient: Mistral | null = null;
let cachedKey: string | null = null;

export function getMistralClient(): Mistral {
  const apiKey = getMistralApiKey();
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new Mistral({ apiKey });
    cachedKey = apiKey;
  }
  return cachedClient;
}

// Global rate pacer to prevent exceeding Mistral free tier 1 RPS limit
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 2500;

async function paceRequest(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * Executes an operation with automatic retry on HTTP 429 rate limit errors
 */
async function withRateLimitRetry<T>(
  operationName: string,
  fn: () => Promise<T>,
  maxRetries: number = 4,
): Promise<T> {
  let attempt = 0;
  let delayMs = 3000;

  while (true) {
    try {
      await paceRequest();
      return await fn();
    } catch (err: unknown) {
      attempt++;
      const errMsg = err instanceof Error ? err.message : String(err);
      const is429 =
        errMsg.includes("429") ||
        errMsg.toLowerCase().includes("rate limit") ||
        errMsg.toLowerCase().includes("rate_limited");

      if (is429 && attempt <= maxRetries) {
        console.warn(
          `[Mistral API] Rate limit reached during ${operationName}. Waiting ${delayMs}ms before retry ${attempt}/${maxRetries}...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs = Math.min(delayMs * 2, 20000);
        continue;
      }

      if (is429) {
        throw new Error(
          `Mistral API rate limit exceeded (HTTP 429). The system waited and retried, but the API quota is temporarily busy. Please wait 10 seconds before trying again.`,
        );
      }

      throw err;
    }
  }
}

/**
 * Robust JSON parser that handles code blocks, leading/trailing commentary, or raw JSON
 */
export function extractJsonFromText<T = unknown>(rawText: string): T {
  const text = rawText.trim();

  // 1. Direct parse attempt
  try {
    return JSON.parse(text) as T;
  } catch {
    // Continue to fallback extractions
  }

  // 2. Markdown code fence extraction: ```json ... ``` or ``` ... ```
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim()) as T;
    } catch {
      // Continue
    }
  }

  // 3. Find outermost JSON object or array bounds
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");

  if (
    firstBrace !== -1 &&
    lastBrace > firstBrace &&
    (firstBracket === -1 || firstBrace < firstBracket)
  ) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1)) as T;
    } catch {
      // Continue
    }
  }

  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      return JSON.parse(text.slice(firstBracket, lastBracket + 1)) as T;
    } catch {
      // Continue
    }
  }

  throw new Error(
    `Failed to parse JSON response from Mistral. Response was: ${text.slice(0, 300)}...`,
  );
}

/**
 * Calls Mistral API to generate structured JSON output
 * Uses Conversations API with mistral-small-latest (which has active quota on all keys)
 * with graceful fallback to chat completions.
 */
export async function callMistralJson<T = unknown>(
  prompt: string,
  systemInstruction?: string,
  model: string = MISTRAL_DEFAULT_MODEL,
): Promise<T> {
  return withRateLimitRetry("structured JSON generation", async () => {
    const client = getMistralClient();
    const apiKey = getMistralApiKey();

    let rawString = "";

    // 1. Primary method: Conversations API with mistral-small-latest
    try {
      const conv = await client.beta.conversations.start({
        model,
        instructions: systemInstruction || undefined,
        inputs: prompt,
        store: false,
      });

      const msgOutput = conv.outputs?.find((o) => o.type === "message.output");
      if (msgOutput && msgOutput.type === "message.output") {
        const content = (msgOutput as { content?: unknown }).content;
        rawString =
          typeof content === "string"
            ? content
            : Array.isArray(content)
              ? content
                  .map((c) => (c && typeof c === "object" && "text" in c ? String(c.text) : ""))
                  .join("")
              : String(content || "");
      }
    } catch (convErr: unknown) {
      const errDetail = convErr instanceof Error ? convErr.message : String(convErr);
      console.warn("[Mistral] Conversations call fallback to chat or REST:", errDetail);

      // 2. Direct REST fallback to /v1/conversations
      try {
        const res = await fetch("https://api.mistral.ai/v1/conversations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            instructions: systemInstruction,
            inputs: [{ role: "user", content: prompt }],
            store: false,
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as {
            outputs?: Array<{ type?: string; content?: unknown }>;
          };
          const msg = data.outputs?.find((o) => o.type === "message.output");
          if (msg?.content) {
            rawString = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
          }
        }
      } catch {
        // Continue to chat completions fallback
      }

      // 3. Fallback to standard chat completions
      if (!rawString) {
        const messages: Array<{ role: "system" | "user"; content: string }> = [];
        if (systemInstruction) {
          messages.push({ role: "system", content: systemInstruction });
        }
        messages.push({ role: "user", content: prompt });

        const response = await client.chat.complete({
          model,
          messages,
          responseFormat: { type: "json_object" },
          temperature: 0.1,
        });

        const choice = response.choices?.[0];
        if (choice?.message?.content) {
          const content = choice.message.content;
          rawString =
            typeof content === "string"
              ? content
              : Array.isArray(content)
                ? content.map((c) => ("text" in c ? c.text : "")).join("")
                : String(content);
        }
      }
    }

    if (!rawString) {
      throw new Error("Mistral API returned an empty response.");
    }

    return extractJsonFromText<T>(rawString);
  });
}

export interface MistralWebSearchResult {
  rawText: string;
  structuredData: unknown;
  sources: Array<{ title: string; url: string; snippet?: string }>;
}

/**
 * Executes web research using Mistral's built-in `web_search` tool
 * via the Conversations API (/v1/conversations)
 */
export async function callMistralWebSearch(
  prompt: string,
  systemInstruction?: string,
  model: string = MISTRAL_DEFAULT_MODEL,
  maxRetries: number = 4,
): Promise<MistralWebSearchResult> {
  return withRateLimitRetry(
    "web research",
    async () => {
      const apiKey = getMistralApiKey();
      const client = getMistralClient();

      let conversationResponse: unknown = null;

      // 1. Try via official SDK beta.conversations.start with web_search tool
      try {
        conversationResponse = await client.beta.conversations.start({
          model,
          instructions: systemInstruction || undefined,
          tools: [{ type: "web_search" }],
          inputs: prompt,
          store: false,
        });
      } catch (sdkErr: unknown) {
        const errMsg = sdkErr instanceof Error ? sdkErr.message : String(sdkErr);
        const isToolRateLimit =
          errMsg.toLowerCase().includes("web_search") ||
          errMsg.toLowerCase().includes("rate limit") ||
          errMsg.includes("429");

        if (isToolRateLimit) {
          console.warn(
            "[Mistral API] Live web_search tool rate limit reached on current tier. Using Mistral research mode...",
          );
          conversationResponse = await client.beta.conversations.start({
            model,
            instructions: systemInstruction || undefined,
            inputs: prompt,
            store: false,
          });
        } else {
          throw sdkErr;
        }
      }

      // Parse outputs from Mistral conversation
      interface MistralConversationOutput {
        type?: string;
        name?: string;
        info?: {
          results?: Array<{
            title?: string;
            name?: string;
            url?: string;
            snippet?: string;
            description?: string;
            text?: string;
          }>;
          search_results?: Array<{
            title?: string;
            name?: string;
            url?: string;
            snippet?: string;
            description?: string;
            text?: string;
          }>;
          sources?: Array<{
            title?: string;
            name?: string;
            url?: string;
            snippet?: string;
            description?: string;
            text?: string;
          }>;
        };
        content?: string | unknown;
      }
      const convRes = conversationResponse as
        { outputs?: MistralConversationOutput[] } | null | undefined;
      const outputs = convRes?.outputs || [];
      let assistantText = "";
      const discoveredSources: Array<{ title: string; url: string; snippet?: string }> = [];

      for (const entry of outputs) {
        // Handle web search tool execution details and sources
        if (
          entry.type === "tool.execution" &&
          (entry.name === "web_search" || entry.name === "web_search_premium")
        ) {
          const info = entry.info || {};
          const results = info.results || info.search_results || info.sources || [];
          if (Array.isArray(results)) {
            for (const item of results) {
              if (item?.url) {
                discoveredSources.push({
                  title: item.title || item.name || new URL(item.url).hostname,
                  url: item.url,
                  snippet: item.snippet || item.description || item.text || "",
                });
              }
            }
          }
        }

        // Handle assistant output message
        if (entry.type === "message.output") {
          const content = entry.content;
          if (typeof content === "string") {
            assistantText += content + "\n";
          } else if (Array.isArray(content)) {
            for (const chunk of content) {
              if (typeof chunk === "string") {
                assistantText += chunk;
              } else if (chunk?.text) {
                assistantText += chunk.text;
              }
            }
          }
        }
      }

      // Extract URLs and citations mentioned in assistant text
      const urlRegex = /https?:\/\/[^\s)\]>"',]+/g;
      const matchedUrls = assistantText.match(urlRegex) || [];
      for (const u of matchedUrls) {
        if (!discoveredSources.some((s) => s.url === u)) {
          try {
            const domain = new URL(u).hostname;
            discoveredSources.push({
              title: domain,
              url: u,
              snippet: "Referenced by Mistral web research",
            });
          } catch {
            // invalid url, skip
          }
        }
      }

      let structuredData: unknown = null;
      if (assistantText.trim().length > 0) {
        try {
          structuredData = extractJsonFromText(assistantText);
        } catch {
          // Not JSON formatted text, will be processed by caller
        }
      }

      // Corroborate sources from structured evidence if web_search tool output was empty
      if (discoveredSources.length === 0 && structuredData) {
        const sd = structuredData as Record<string, unknown>;
        const recList = Array.isArray(structuredData)
          ? structuredData
          : Array.isArray(sd?.["records"])
            ? (sd["records"] as unknown[])
            : Array.isArray(sd?.["candidates"])
              ? (sd["candidates"] as unknown[])
              : [];
        for (const rawR of recList) {
          const r = rawR as {
            evidence?: Array<{ url?: string; source?: string; snippet?: string }>;
          };
          if (Array.isArray(r.evidence)) {
            for (const ev of r.evidence) {
              if (ev?.url && !discoveredSources.some((s) => s.url === ev.url)) {
                discoveredSources.push({
                  title: ev.source || "Mistral Research Source",
                  url: ev.url,
                  snippet: ev.snippet || "",
                });
              }
            }
          }
        }
      }

      return {
        rawText: assistantText,
        structuredData,
        sources: discoveredSources,
      };
    },
    maxRetries,
  );
}
