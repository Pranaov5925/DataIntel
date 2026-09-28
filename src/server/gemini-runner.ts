import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import {
  collectionPlanSchema,
  geminiWorkflowResponseSchema,
  type CollectionPlan,
} from "../lib/workflow-schema";

export type RunGeminiWorkflowInput = {
  request: string;
  preferences?: Record<string, string> | undefined;
};

export type RunGeminiWorkflowResult =
  { success: true; data: CollectionPlan } | { success: false; error: string };

export async function runGeminiWorkflow(
  input: RunGeminiWorkflowInput,
): Promise<RunGeminiWorkflowResult> {
  // Reload .env dynamically so user changes in .env take effect immediately without restarting the dev server
  dotenv.config({ override: true });

  const rawKey = process.env["GEMINI_API_KEY"]?.trim() || "";
  const apiKey = rawKey.replace(/^["']|["']$/g, "").trim();
  if (!apiKey) {
    return {
      success: false,
      error:
        "GEMINI_API_KEY is not configured. Please set your GEMINI_API_KEY in the .env file in the project root.",
    };
  }

  const rawModel = process.env["GEMINI_MODEL"]?.trim() || "gemini-3.8-flash";
  let modelName = rawModel.replace(/^["']|["']$/g, "").trim() || "gemini-3.8-flash";

  // gemini-2.5-flash was deprecated for new users by Google in favor of gemini-3.8-flash
  if (modelName === "gemini-2.5-flash") {
    modelName = "gemini-3.8-flash";
  }

  const systemInstruction = `You are an AI Research Architect and Data Collection Planner for DataIntel, an enterprise AI Data Intelligence Platform.
Your mission is to analyze any natural-language data collection request and generate:
1. "understanding": A deep structured requirement analysis with:
   - objective: concise summary of the data collection goal
   - target: primary entity/record type being gathered (e.g. "Job openings", "SaaS Companies", "EV Two-Wheelers")
   - geography: target geographic scope (e.g. "India", "Bengaluru", "Global")
   - industry: domain vertical (e.g. "SaaS", "FinTech", "CleanTech")
   - constraints: array of specific constraints, qualifiers, or filters mentioned or strongly implied
   - requiredFields: array of data columns or attributes to extract
   - freshness: timeframe or recency requirement (e.g. "Listings active in the last 30 days")
   - searchIntent: underlying operational or business goal
2. "stages": A custom sequential multi-stage workflow collection blueprint tailored specifically to this request.
   The stages should represent a realistic data collection pipeline:
   - Discover: Identify relevant, permitted primary sources (job boards, registry portals, directories, websites)
   - Collect: Gather candidate listings/records from identified sources
   - Extract: Extract and structure the required fields
   - Clean: Clean, normalize, and standardize extracted values
   - Validate: Validate source evidence and provenance citations
   - Deduplicate: Merge matching records found across multiple sources
   - Identify gaps: Flag missing fields or conflicting values between sources
   - Verify: Targeted adaptive verification for missing/conflicting records
   - Publish: Final dataset publishing with audit trail and confidence ratings
   Each stage MUST have:
   - name: concise, actionable stage name
   - detail: descriptive text explaining specifically how this stage operates for this exact request
   - status: assign the first stage as "complete", the next stage as "active", and remaining stages as "pending"
   - count: realistic metric count or indicator string (e.g., "9 sources", "47 candidates", "7 fields", "88%", "—")
3. "title": A concise, punchy title summarizing this task (4-8 words).

Return strictly a valid JSON object matching the requested schema. No markdown formatting, backticks, or extra commentary.`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `User Data Collection Request:\n"${input.request}"\n\nPreferences:\n${JSON.stringify(input.preferences ?? {}, null, 2)}`;

    async function callModel(model: string) {
      return await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
        },
      });
    }

    const FALLBACK_MODELS_WORKFLOW = [
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
    ];

    function isRetryable(err: unknown): boolean {
      const s = (err as { status?: number }).status;
      const m = err instanceof Error ? err.message : String(err);
      return (
        s === 503 || s === 404 || s === 429 ||
        m.includes("503") || m.includes("404") || m.includes("429") ||
        m.includes("no longer available") || m.includes("quota") ||
        m.includes("RESOURCE_EXHAUSTED") || m.includes("NOT_FOUND")
      );
    }

    const modelsToTry = [modelName, ...FALLBACK_MODELS_WORKFLOW.filter((m) => m !== modelName)];
    let response;
    let lastErr: unknown;
    for (const model of modelsToTry) {
      try {
        response = await callModel(model);
        if (response) break;
      } catch (err: unknown) {
        lastErr = err;
        if (isRetryable(err)) {
          console.warn(`Model ${model} unavailable/quota exceeded – trying next fallback…`);
          continue;
        }
        throw err;
      }
    }
    if (!response) throw lastErr ?? new Error("All Gemini models failed to respond.");

    const responseText = response.text;
    if (!responseText) {
      return {
        success: false,
        error: "Gemini returned an empty response. Please try again.",
      };
    }

    // Strip markdown code fences if Gemini enclosed the response in ```json ... ```
    const cleanedJson = responseText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(cleanedJson);
    } catch {
      return {
        success: false,
        error: "Failed to parse JSON response from Gemini: " + cleanedJson.slice(0, 200),
      };
    }

    const validated = geminiWorkflowResponseSchema.safeParse(parsedJson);
    if (!validated.success) {
      console.error("Zod validation error:", validated.error.format());
      return {
        success: false,
        error:
          "Gemini response did not conform to the required schema: " +
          validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      };
    }

    const planId = `DR-${Math.floor(1000 + Math.random() * 9000)}`;
    const plan: CollectionPlan = {
      id: planId,
      title: validated.data.title,
      request: input.request,
      understanding: validated.data.understanding,
      stages: validated.data.stages,
      createdAt: new Date().toISOString(),
    };

    const finalCheck = collectionPlanSchema.parse(plan);

    return {
      success: true,
      data: finalCheck,
    };
  } catch (err: unknown) {
    console.error("Gemini API execution error:", err);
    let message = err instanceof Error ? err.message : String(err);

    // Try to extract user-friendly error message if it's JSON from Google API
    try {
      const match = message.match(/\{"error":\{.*\}\}/);
      if (match) {
        const errorObj = JSON.parse(match[0]) as { error?: { message?: string } };
        if (errorObj?.error?.message) {
          message = errorObj.error.message;
        }
      }
    } catch {
      // ignore
    }

    return {
      success: false,
      error: message,
    };
  }
}
