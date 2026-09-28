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

// ─── Dataset Record ───────────────────────────────────────────────────────────
export const datasetRecordSchema = z.object({
  id: z.string(),
  company: z.string(),
  role: z.string(),
  location: z.string(),
  experience: z.string(),
  salary: z.string(),
  size: z.string(),
  source: z.string(),
  confidence: z.number().int().min(0).max(100),
  status: z.enum(["Verified", "Review", "Conflict", "Incomplete"]),
  evidence: z.array(evidenceSchema),
  conflict: conflictSchema.optional(),
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
  validated: z.number(),
  duplicates: z.number(),
  incomplete: z.number(),
  conflicts: z.number(),
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
export type DatasetRecord = z.infer<typeof datasetRecordSchema>;
export type SourceSummary = z.infer<typeof sourceSummarySchema>;
export type Intervention = z.infer<typeof interventionSchema>;
export type QualitySummary = z.infer<typeof qualitySummarySchema>;
export type ExecutedStage = z.infer<typeof executedStageSchema>;
export type PipelineResult = z.infer<typeof pipelineResultSchema>;
