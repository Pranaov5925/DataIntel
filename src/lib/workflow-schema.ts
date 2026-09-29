import { z } from "zod";

const stringOrArray = z.preprocess((val) => {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string") {
    return val
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}, z.array(z.string()));

const stringCount = z.preprocess(
  (val) => (val === undefined || val === null ? "—" : String(val)),
  z.string(),
);

export const requirementUnderstandingSchema = z.object({
  objective: z.string().describe("Clear concise summary of what data needs to be collected"),
  target: z
    .string()
    .describe(
      "The primary entity or target being searched, e.g. Job openings, Companies, Products",
    ),
  geography: z
    .string()
    .describe("Geographic boundary or location scope, e.g. India, Global, Bengaluru"),
  industry: z
    .string()
    .describe("Target vertical or industry domain, e.g. SaaS, FinTech, E-commerce"),
  constraints: stringOrArray.describe(
    "Specific filters, constraints, experience levels, or qualifiers",
  ),
  requiredFields: stringOrArray.describe("List of data attributes or columns required"),
  freshness: z.string().describe("Timeframe or recency requirement for the data"),
  searchIntent: z.string().describe("Underlying search intent or operational goal"),
});

export type RequirementUnderstanding = z.infer<typeof requirementUnderstandingSchema>;

export const workflowStepSchema = z.object({
  name: z.string().describe("Actionable title of the collection stage"),
  detail: z
    .string()
    .describe("Specific explanation of what this step will do for this exact request"),
  status: z.enum(["complete", "active", "pending"]).default("pending"),
  count: stringCount
    .default("—")
    .describe(
      "Realistic target or metric indicator, e.g. '8 sources', '45+ listings', '7 fields', '—'",
    ),
});

export type WorkflowStep = z.infer<typeof workflowStepSchema>;

export const workflowResponseSchema = z.object({
  title: z.string().describe("Short descriptive task title (4-8 words)"),
  understanding: requirementUnderstandingSchema,
  stages: z.array(workflowStepSchema).min(3).max(14),
});

export type WorkflowResponse = z.infer<typeof workflowResponseSchema>;

// Backwards-compatible alias for existing imports
export const geminiWorkflowResponseSchema = workflowResponseSchema;
export type GeminiWorkflowResponse = WorkflowResponse;

export const collectionPlanSchema = z.object({
  id: z.string(),
  title: z.string(),
  request: z.string(),
  understanding: requirementUnderstandingSchema,
  stages: z.array(workflowStepSchema),
  createdAt: z.string(),
});

export type CollectionPlan = z.infer<typeof collectionPlanSchema>;
