import { z } from "zod";
import {
  datasetRecordSchema,
  executedStageSchema,
  interventionSchema,
  qualitySummarySchema,
  sourceSummarySchema,
} from "./pipeline-schema";
import { requirementUnderstandingSchema, workflowStepSchema } from "./workflow-schema";

// ─── Run Comparison Schema ───────────────────────────────────────────────────
export const runComparisonSchema = z.object({
  previousRunId: z.string(),
  previousRunNumber: z.number(),
  recordsDelta: z.number(),
  validatedDelta: z.number(),
  conflictsDelta: z.number(),
  coverageDelta: z.number(),
  qualityDelta: z.number(),
  summary: z.string(),
});

export type RunComparison = z.infer<typeof runComparisonSchema>;

// ─── Persisted Workflow Run Schema ───────────────────────────────────────────
export const persistedRunSchema = z.object({
  id: z.string(), // stable run ID, e.g. "RUN-DR1048-v1"
  requestId: z.string(), // stable request ID, e.g. "DR-1048"
  runNumber: z.number(), // 1, 2, ...
  requestName: stringOrEmpty(z.string()),
  originalPrompt: z.string(),
  status: z.enum(["Completed", "Running", "Failed"]),
  createdAt: z.string(),
  completedAt: z.string(),
  understanding: requirementUnderstandingSchema,
  blueprintStages: z.array(workflowStepSchema),
  executedStages: z.array(executedStageSchema),
  quality: qualitySummarySchema,
  records: z.array(datasetRecordSchema),
  sources: z.array(sourceSummarySchema),
  interventions: z.array(interventionSchema),
  adaptiveOutcomes: z.array(z.tuple([z.string(), z.string()])),
  adaptiveSummary: z.string(),
  comparison: runComparisonSchema.optional(),
});

function stringOrEmpty<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((val) => (val === undefined || val === null ? "" : String(val)), schema);
}

export type PersistedRun = z.infer<typeof persistedRunSchema>;

// ─── Persisted Request Schema ────────────────────────────────────────────────
export const persistedRequestSchema = z.object({
  id: z.string(), // e.g. "DR-1048"
  name: z.string(),
  prompt: z.string(),
  status: z.enum(["draft", "planning", "running", "completed", "failed"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  runIds: z.array(z.string()),
  activeRunId: z.string(),
});

export type PersistedRequest = z.infer<typeof persistedRequestSchema>;
export type PersistedDataRequest = PersistedRequest;

// ─── Overall Store Schema ────────────────────────────────────────────────────
export const appStoreSchema = z.object({
  activeRequestId: z.string(),
  activeRunId: z.string(),
  requests: z.array(persistedRequestSchema),
  runs: z.array(persistedRunSchema),
});

export type AppStore = z.infer<typeof appStoreSchema>;
