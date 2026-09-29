/**
 * workflow-runner.ts - Ollama Workflow Generator
 */

import {
  collectionPlanSchema,
  workflowResponseSchema,
  type CollectionPlan,
} from "../lib/workflow-schema";
import { callOllamaJson, getOllamaConfig } from "./ollama-client";

export type RunWorkflowInput = {
  request: string;
  preferences?: Record<string, string> | undefined;
};

export type RunWorkflowResult =
  | { success: true; data: CollectionPlan }
  | { success: false; error: string };

export async function runOllamaWorkflow(
  input: RunWorkflowInput,
): Promise<RunWorkflowResult> {
  const config = getOllamaConfig();

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
   - Deduplicate: Merge matching records found across multiple sources
   - Validate: Validate source evidence and provenance citations
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

  const prompt = `Data Collection Request:\n"${input.request}"\n\nPreferences:\n${JSON.stringify(input.preferences ?? {}, null, 2)}\n\nGenerate the complete structured requirement understanding and collection workflow blueprint.`;

  try {
    const rawOutput = await callOllamaJson<unknown>(prompt, systemInstruction, config);

    const validated = workflowResponseSchema.safeParse(rawOutput);
    if (!validated.success) {
      const errorMsg = validated.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return {
        success: false,
        error: `Ollama structured workflow validation failed: ${errorMsg}`,
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
    console.error("Ollama workflow generation error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Backward-compatible alias for existing imports
export const runGeminiWorkflow = runOllamaWorkflow;
export type RunGeminiWorkflowInput = RunWorkflowInput;
export type RunGeminiWorkflowResult = RunWorkflowResult;

export async function generateWorkflowWithOllama(
  request: string,
  preferences?: Record<string, string>,
): Promise<CollectionPlan> {
  const res = await runOllamaWorkflow({ request, preferences });
  if (!res.success) {
    throw new Error(res.error);
  }
  return res.data;
}
