import { z } from "zod";

// ─── Evidence ────────────────────────────────────────────────────────────────
export const verificationSchema = z.enum(["Confirmed", "Partially verified", "Needs verification"]);

export const evidenceSchema = z.object({
  field: z.string(),
  value: z.string(),
  source: z.string(),
  url: z.string(),
  retrieved: z.string(),
  snippet: z.string(),
  verification: verificationSchema,
});

// ─── Conflict ────────────────────────────────────────────────────────────────
export const conflictValueSchema = z.object({
  source: z.string(),
  value: z.string(),
  url: z.string(),
  retrieved: z.string(),
  snippet: z.string(),
});

export const conflictSchema = z.object({
  field: z.string(),
  values: z.array(conflictValueSchema).min(2),
});

export const qualificationStatusSchema = z.enum([
  "Qualified",
  "Needs verification",
  "Excluded",
  "Conflict",
]);

export type QualificationStatus = z.infer<typeof qualificationStatusSchema>;

// ─── Dataset Record ───────────────────────────────────────────────────────────
export const datasetRecordSchema = z.object({
  id: z.string(),
  entityName: z.string().default(""), // Domain-neutral primary entity identity
  attributes: z.record(z.string(), z.string().nullable()).default({}), // Dynamic source-of-truth attributes
  source: z.string(),
  confidence: z.number().int().min(0).max(100),
  verificationStatus: verificationSchema.default("Needs verification"),
  qualificationStatus: qualificationStatusSchema.default("Needs verification"),
  qualificationReason: z.string().optional(),
  evidence: z.array(evidenceSchema).default([]),
  conflict: conflictSchema.optional(),
  conflicts: z.array(conflictSchema).default([]),
  // Legacy fields retained for backwards-compatibility with mock data and fallbacks:
  company: z.string().default(""),
  role: z.string().default("—"),
  location: z.string().default("—"),
  experience: z.string().default("—"),
  salary: z.string().default("Not disclosed"),
  size: z.string().default("—"),
  status: z.enum(["Verified", "Review", "Conflict", "Incomplete"]).default("Review"),
});

// ─── Source summary ───────────────────────────────────────────────────────────
export const sourceSummarySchema = z.object({
  name: z.string(),
  domain: z.string(),
  type: z.string(),
  records: z.number(),
  reliability: z.number().int().min(0).max(100),
  checked: z.string(),
});

// ─── Adaptive intervention ────────────────────────────────────────────────────
export const interventionSchema = z.object({
  time: z.string(),
  title: z.string(),
  detail: z.string(),
  tone: z.enum(["accent", "warning", "success"]),
});

// ─── Quality summary ──────────────────────────────────────────────────────────
export const qualitySummarySchema = z.object({
  collected: z.number(),
  unique: z.number(),
  validated: z.number(), // Qualified alias
  duplicates: z.number(),
  incomplete: z.number(), // Needs verification alias
  conflicts: z.number(),
  qualified: z.number().optional(),
  needsVerification: z.number().optional(),
  excluded: z.number().optional(),
});

// ─── Stage execution status ───────────────────────────────────────────────────
export const executedStageSchema = z.object({
  name: z.string(),
  detail: z.string(),
  status: z.enum(["complete", "active", "pending"]),
  count: z.string(),
});

// ─── Full pipeline result ─────────────────────────────────────────────────────
export const pipelineResultSchema = z.object({
  planId: z.string(),
  runId: z.string().optional(),
  title: z.string(),
  request: z.string(),
  completedAt: z.string(),
  stages: z.array(executedStageSchema),
  quality: qualitySummarySchema,
  records: z.array(datasetRecordSchema),
  sources: z.array(sourceSummarySchema),
  interventions: z.array(interventionSchema),
  adaptiveOutcomes: z.array(z.tuple([z.string(), z.string()])),
  adaptiveSummary: z.string(),
});

export type Evidence = z.infer<typeof evidenceSchema>;
export type ConflictValue = z.infer<typeof conflictValueSchema>;
export type Conflict = z.infer<typeof conflictSchema>;
export type DatasetRecord = z.infer<typeof datasetRecordSchema>;
export type SourceSummary = z.infer<typeof sourceSummarySchema>;
export type Intervention = z.infer<typeof interventionSchema>;
export type QualitySummary = z.infer<typeof qualitySummarySchema>;
export type ExecutedStage = z.infer<typeof executedStageSchema>;
export type PipelineResult = z.infer<typeof pipelineResultSchema>;
