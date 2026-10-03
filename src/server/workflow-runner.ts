import {
  collectionPlanSchema,
  workflowResponseSchema,
  type CollectionPlan,
} from "../lib/workflow-schema";
import { callMistralJson, MISTRAL_DEFAULT_MODEL } from "./mistral-client";
import { extractDeterministicConstraints } from "./qualification-engine";

export type RunWorkflowInput = {
  request: string;
  preferences?: Record<string, string> | undefined;
};

export type RunWorkflowResult =
  { success: true; data: CollectionPlan } | { success: false; error: string };

export async function runMistralWorkflow(input: RunWorkflowInput): Promise<RunWorkflowResult> {
  const systemInstruction = `You are an AI Research Architect and Data Collection Planner for DataIntel, an enterprise AI Data Intelligence Platform.
Your mission is to analyze any natural-language data collection request and generate:
1. "understanding": A deep structured requirement analysis with:
   - objective: concise summary of the data collection goal
   - target: primary entity/record type being gathered (e.g. "Job openings", "SaaS Companies", "EV Two-Wheelers", "Land parcels")
   - geography: target geographic scope (e.g. "India", "Bengaluru", "Chennai", "Global")
   - industry: domain vertical (e.g. "SaaS", "Real Estate", "Automotive", "FinTech")
   - constraints: array of specific constraints, qualifiers, or filters mentioned in user prompt
   - structuredConstraints: array of machine-evaluable qualification rules:
     [
       {
         "field": "<attribute e.g. company_size, price, range, location>",
         "operator": "<equals | not_equals | contains | in | greater_than | greater_than_or_equal | less_than | less_than_or_equal | between>",
         "value": "<comparison value or lower bound>",
         "valueTo": "<upper bound if between>",
         "unit": "<unit e.g. INR, employees, km, LPA>",
         "hard": true
       }
     ]
   - requiredFields: array of data columns or attributes to extract (e.g. ["Brand", "Model", "Price", "Range", "Battery capacity", "Source"])
   - optionalFields: array of fields requested with 'if available', 'when possible', etc. (e.g. ["Salary"]) that do NOT disqualify records if missing
   - freshness: timeframe or recency requirement (e.g. "Listings active in the last 30 days")
   - searchIntent: underlying operational or business goal
2. "stages": A custom sequential multi-stage workflow collection blueprint tailored specifically to this request.
   The stages should represent a realistic data collection pipeline:
   - Discover: Identify relevant, permitted primary sources
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
   - status: "pending"
   - count: realistic metric count or indicator string (e.g., "9 sources", "47 candidates", "7 fields", "—")
3. "title": A concise, punchy title summarizing this task (4-8 words).

Return strictly a valid JSON object matching the requested schema. No markdown formatting, backticks, or extra commentary.`;

  const prompt = `Data Collection Request:\n"${input.request}"\n\nPreferences:\n${JSON.stringify(input.preferences ?? {}, null, 2)}\n\nGenerate the complete structured requirement understanding and collection workflow blueprint.`;

  try {
    const rawOutput = await callMistralJson<unknown>(
      prompt,
      systemInstruction,
      MISTRAL_DEFAULT_MODEL,
    );

    const validated = workflowResponseSchema.safeParse(rawOutput);
    if (!validated.success) {
      const errorMsg = validated.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return {
        success: false,
        error: `Mistral structured workflow validation failed: ${errorMsg}`,
      };
    }

    // Merge deterministic constraint extraction to guarantee machine-evaluable rules
    const deterministic = extractDeterministicConstraints(
      input.request,
      validated.data.understanding.constraints,
    );

    const mergedConstraints = [...(validated.data.understanding.structuredConstraints || [])];
    for (const dc of deterministic.structuredConstraints) {
      if (!mergedConstraints.some((c) => c.field === dc.field && c.operator === dc.operator)) {
        mergedConstraints.push(dc);
      }
    }

    const mergedOptional = Array.from(
      new Set([
        ...(validated.data.understanding.optionalFields || []),
        ...deterministic.optionalFields,
      ]),
    );

    const finalUnderstanding = {
      ...validated.data.understanding,
      structuredConstraints: mergedConstraints,
      optionalFields: mergedOptional,
    };

    const planId = `DR-${Math.floor(1000 + Math.random() * 9000)}`;
    const plan: CollectionPlan = {
      id: planId,
      title: validated.data.title,
      request: input.request,
      understanding: finalUnderstanding,
      stages: validated.data.stages.map((s) => ({
        ...s,
        status: "pending" as const,
      })),
      createdAt: new Date().toISOString(),
    };

    const finalCheck = collectionPlanSchema.parse(plan);
    return {
      success: true,
      data: finalCheck,
    };
  } catch (err: unknown) {
    console.error("Mistral workflow generation error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const runWorkflow = runMistralWorkflow;

export async function generateWorkflowWithMistral(
  request: string,
  preferences?: Record<string, string>,
): Promise<CollectionPlan> {
  const res = await runMistralWorkflow({ request, preferences });
  if (!res.success) {
    throw new Error(res.error);
  }
  return res.data;
}
