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

export const structuredConstraintOperatorSchema = z.enum([
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "between",
  "in",
  "not_in",
  "before",
  "after",
  "within",
  "semantic_match",
  "contains_any",
  "contains_all",
]);

export type StructuredConstraintOperator = z.infer<typeof structuredConstraintOperatorSchema>;

export const structuredConstraintSchema = z.object({
  field: z
    .string()
    .describe("Target attribute or field name, e.g. company_size, price, range, location"),
  operator: structuredConstraintOperatorSchema.describe("Evaluation operator"),
  value: z.coerce
    .string()
    .describe("Target comparison value, or minimum bound if operator is 'between'"),
  valueTo: z.coerce.string().optional().describe("Upper bound if operator is 'between'"),
  unit: z.string().optional().describe("Unit of measurement, e.g. INR, employees, km, LPA"),
  hard: z
    .boolean()
    .default(true)
    .describe("True if failure disqualifies record; false if optional"),
});

export type StructuredConstraint = z.infer<typeof structuredConstraintSchema>;

export const requirementUnderstandingSchema = z.object({
  objective: z.string().describe("Clear concise summary of what data needs to be collected"),
  target: z
    .string()
    .describe(
      "The primary entity or target being searched, e.g. Job openings, Companies, Land listings, EV Two-Wheelers",
    ),
  geography: z
    .string()
    .describe("Geographic boundary or location scope, e.g. India, Global, Bengaluru, Chennai"),
  industry: z
    .string()
    .describe("Target vertical or industry domain, e.g. SaaS, Real Estate, Automotive"),
  constraints: stringOrArray.describe(
    "Specific natural-language filters, constraints, or qualifiers",
  ),
  structuredConstraints: z
    .array(structuredConstraintSchema)
    .default([])
    .describe("Machine-evaluable qualification rules extracted from constraints"),
  requiredFields: stringOrArray.describe("List of required data attributes or columns to extract"),
  optionalFields: stringOrArray
    .default([])
    .describe(
      "List of optional fields (e.g. 'salary if available') that do not disqualify records if absent",
    ),
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

export const collectionPlanSchema = z.object({
  id: z.string(),
  title: z.string(),
  request: z.string(),
  understanding: requirementUnderstandingSchema,
  stages: z.array(workflowStepSchema),
  createdAt: z.string(),
});

export type CollectionPlan = z.infer<typeof collectionPlanSchema>;
