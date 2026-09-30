/**
 * ollama-client.ts - Local Ollama LLM integration (Qwen2.5 3B)
 */

import dotenv from "dotenv";

export interface OllamaConfig {
  baseUrl: string;
  model: string;
}

export function getOllamaConfig(): OllamaConfig {
  dotenv.config({ override: true });
  const baseUrl = (process.env["OLLAMA_BASE_URL"] || "http://localhost:11434").replace(/\/+$/, "");
  const model = process.env["OLLAMA_MODEL"]?.trim() || "qwen2.5:3b";
  return { baseUrl, model };
}

export async function checkOllamaHealth(config: OllamaConfig = getOllamaConfig()): Promise<{
  ok: boolean;
  modelInstalled: boolean;
  models: string[];
  error?: string;
}> {
  try {
    const res = await fetch(`${config.baseUrl}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      return {
        ok: false,
        modelInstalled: false,
        models: [],
        error: `Ollama returned HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const data = (await res.json()) as { models?: Array<{ name?: string }> };
    const modelNames = (data.models || []).map((m) => m.name || "").filter(Boolean);
    const modelInstalled = modelNames.some(
      (name) => name === config.model || name.startsWith(`${config.model}:`) || name.startsWith(config.model.split(":")[0] || ""),
    );

    return {
      ok: true,
      modelInstalled,
      models: modelNames,
    };
  } catch (err) {
    return {
      ok: false,
      modelInstalled: false,
      models: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Cached health check to avoid redundant health requests per pipeline run ──
let _healthCache: { ok: boolean; modelInstalled: boolean; models: string[]; ts: number; configKey: string } | null = null;
const HEALTH_CACHE_MS = 60_000; // Cache health status for 60 seconds

async function ensureOllamaHealthy(config: OllamaConfig): Promise<void> {
  const configKey = `${config.baseUrl}::${config.model}`;
  if (
    _healthCache &&
    _healthCache.configKey === configKey &&
    _healthCache.ok &&
    _healthCache.modelInstalled &&
    Date.now() - _healthCache.ts < HEALTH_CACHE_MS
  ) {
    return; // Cached and healthy
  }

  const health = await checkOllamaHealth(config);
  _healthCache = {
    ok: health.ok,
    modelInstalled: health.modelInstalled,
    models: health.models,
    ts: Date.now(),
    configKey,
  };

  if (!health.ok) {
    throw new Error(
      `Ollama is not running at ${config.baseUrl} (${health.error || "connection refused"}). ` +
      `Please ensure Ollama is installed and started. Run 'ollama run ${config.model}' or visit https://ollama.com`,
    );
  }

  if (!health.modelInstalled) {
    throw new Error(
      `Ollama model '${config.model}' is not installed locally. ` +
      `Available models: [${health.models.join(", ") || "none"}]. ` +
      `Please run: ollama pull ${config.model}`,
    );
  }
}

export async function callOllamaJson<T = unknown>(
  prompt: string,
  systemPrompt?: string,
  config: OllamaConfig = getOllamaConfig(),
): Promise<T> {
  await ensureOllamaHealthy(config);

  const endpoint = `${config.baseUrl}/api/chat`;
  const body = {
    model: config.model,
    messages: [
      {
        role: "system",
        content: systemPrompt || "You are an expert AI data extraction engine. Always output valid JSON strictly matching the requested format. Do not include markdown codeblocks or thinking tags.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    format: "json",
    stream: false,
    options: {
      temperature: 0.1,
      num_predict: 2048,
      num_ctx: 4096,
      ...(process.env["OLLAMA_NUM_GPU"] !== undefined
        ? { num_gpu: Number(process.env["OLLAMA_NUM_GPU"]) }
        : {}),
    },
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180000), // Allow up to 3m for local inference
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Ollama generation failed [${res.status}]: ${errorText || res.statusText}`);
  }

  const data = (await res.json()) as { message?: { content?: string } };
  const rawText = data.message?.content?.trim() || "";

  if (!rawText) {
    throw new Error("Ollama returned empty response content.");
  }

  // Parse JSON
  try {
    return JSON.parse(rawText) as T;
  } catch {
    // Strip markdown code fences if wrapped
    const cleaned = rawText
      .replace(/^```json\s*/im, "")
      .replace(/^```\s*/im, "")
      .replace(/\s*```\s*$/im, "")
      .trim();

    try {
      return JSON.parse(cleaned) as T;
    } catch (parseErr) {
      throw new Error(`Failed to parse JSON from Ollama (${config.model}): ${parseErr instanceof Error ? parseErr.message : String(parseErr)}\nRaw output: ${rawText.slice(0, 300)}`);
    }
  }
}
