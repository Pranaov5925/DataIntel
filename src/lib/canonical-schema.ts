/**
 * ═════════════════════════════════════════════════════════════════════════════
 * DataIntel — Canonical Data Contract
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Defines the single authoritative data model shared across:
 * - Requirement Parsing
 * - Web Research & Source Registry
 * - Structured Extraction & Normalization
 * - Entity Resolution & Deduplication
 * - Field-Level Evidence & Cross-Source Verification
 * - Qualification Engine
 * - Multi-Dimensional Evidence Reliability Scoring
 * - SQLite Persistence
 * - Frontend Pages (Dashboard, Requests, Workflow, Datasets, Evidence, History)
 */

import { z } from "zod";

// ─── Verification & Directness Enums ─────────────────────────────────────────
export const verificationStatusSchema = z.enum([
  "Confirmed",
  "Partially verified",
  "Needs verification",
]);
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

export const directnessLevelSchema = z.enum(["DIRECT", "INDIRECT", "WEAK", "MISSING"]);
export type DirectnessLevel = z.infer<typeof directnessLevelSchema>;

// ─── Source Quality & Classification ─────────────────────────────────────────
export const sourceTierSchema = z.enum([
  "PRIMARY_OFFICIAL",
  "AUTHORITATIVE",
  "ESTABLISHED_PLATFORM",
  "SECONDARY_SOURCE",
  "AGGREGATOR",
  "SEARCH_SNIPPET",
]);
export type SourceTier = z.infer<typeof sourceTierSchema>;

export const sourceModelSchema = z.object({
  id: z.string(),
  url: z.string(),
  canonicalUrl: z.string().default(""),
  domain: z.string(),
  title: z.string().default(""),
  fetchedAt: z.string(),
  publishedAt: z.string().optional(),
  sourceType: sourceTierSchema.default("SECONDARY_SOURCE"),
  reliability: z.number().int().min(0).max(100).default(50),
  httpStatus: z.number().int().optional(),
  contentHash: z.string().optional(),
  accessibility: z.enum(["ACCESSIBLE", "RESTRICTED", "UNAVAILABLE"]).default("ACCESSIBLE"),
  freshness: z.enum(["RECENT", "MODERATE", "AGED", "UNKNOWN"]).default("UNKNOWN"),
  searchRank: z.number().int().optional(),
});
export type SourceModel = z.infer<typeof sourceModelSchema>;

// ─── Field-Level Evidence ───────────────────────────────────────────────────
export const fieldEvidenceSchema = z.object({
  id: z.string().default(""),
  sourceId: z.string().default(""),
  field: z.string(),
  value: z.string(),
  source: z.string(),
  url: z.string(),
  retrieved: z.string(),
  snippet: z.string(),
  verification: verificationStatusSchema.default("Needs verification"),
  directness: directnessLevelSchema.default("INDIRECT"),
});
export type FieldEvidence = z.infer<typeof fieldEvidenceSchema>;

// ─── Conflict Model ─────────────────────────────────────────────────────────
export const conflictValueItemSchema = z.object({
  sourceId: z.string().optional(),
  source: z.string(),
  value: z.string(),
  url: z.string(),
  retrieved: z.string(),
  snippet: z.string(),
});
export type ConflictValueItem = z.infer<typeof conflictValueItemSchema>;

export const conflictModelSchema = z.object({
  id: z.string().default(""),
  field: z.string(),
  values: z.array(conflictValueItemSchema).min(2),
  conflictStatus: z.enum(["ACTIVE", "RESOLVED"]).default("ACTIVE"),
  resolutionStatus: z
    .enum(["UNRESOLVED", "MANUALLY_RESOLVED", "RULE_RESOLVED"])
    .default("UNRESOLVED"),
  resolutionReason: z.string().optional(),
});
export type ConflictModel = z.infer<typeof conflictModelSchema>;

// ─── Qualification Status & Detail ──────────────────────────────────────────
export const qualificationStatusSchema = z.enum([
  "Qualified",
  "Needs verification",
  "Excluded",
  "Conflict",
]);
export type QualificationStatus = z.infer<typeof qualificationStatusSchema>;

export const constraintOperatorSchema = z.enum([
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
export type ConstraintOperator = z.infer<typeof constraintOperatorSchema>;

export const constraintEvaluationSchema = z.object({
  field: z.string(),
  operator: z.string(),
  expected: z.string(),
  actual: z.string().nullable(),
  normalizedValue: z.number().nullable(),
  result: z.enum(["PASS", "FAIL", "UNKNOWN"]),
  reason: z.string(),
});
export type ConstraintEvaluation = z.infer<typeof constraintEvaluationSchema>;

export const qualificationDetailsSchema = z.object({
  constraints: z.array(constraintEvaluationSchema).default([]),
  missingFields: z.array(z.string()).default([]),
  completenessScore: z.number().min(0).max(100).default(0),
});
export type QualificationDetails = z.infer<typeof qualificationDetailsSchema>;

// ─── Multi-Dimensional Evidence Breakdown ───────────────────────────────────
export const evidenceBreakdownSchema = z.object({
  requiredFieldSupport: z.number().min(0).max(100),
  evidenceDirectness: z.number().min(0).max(100),
  sourceQuality: z.number().min(0).max(100),
  sourceAgreement: z.number().min(0).max(100),
  freshness: z.number().min(0).max(100),
  freshnessStatus: z.enum(["RECENT", "MODERATE", "AGED", "UNKNOWN"]).default("UNKNOWN"),
  entityConsistency: z.number().min(0).max(100),
  extractionReliability: z.number().min(0).max(100),
  conflictPenalty: z.number().min(0).max(100).default(0),
  inferencePenalty: z.number().min(0).max(100).default(0),
  scoreFormula: z.string().optional(),
  summary: z.string().optional(),
  directnessMap: z.record(z.string(), directnessLevelSchema).optional(),
});
export type EvidenceBreakdown = z.infer<typeof evidenceBreakdownSchema>;

// ─── Field State ────────────────────────────────────────────────────────────
export const fieldStateSchema = z.object({
  field: z.string(),
  rawValue: z.string().nullable(),
  normalizedValue: z.union([z.string(), z.number()]).nullable(),
  unit: z.string().optional(),
  status: z
    .enum(["FOUND", "NOT_FOUND", "AMBIGUOUS", "CONFLICTING", "NOT_APPLICABLE"])
    .default("FOUND"),
  directness: directnessLevelSchema.default("INDIRECT"),
  sourceIds: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  verificationStatus: verificationStatusSchema.default("Needs verification"),
});
export type FieldState = z.infer<typeof fieldStateSchema>;

// ─── Canonical Dataset Record ───────────────────────────────────────────────
export const canonicalRecordSchema = z.object({
  id: z.string(),
  entityName: z.string().default(""),
  canonicalDomain: z.string().optional(),
  attributes: z.record(z.string(), z.string().nullable()).default({}),
  fieldStates: z.record(z.string(), fieldStateSchema).optional(),
  source: z.string().default("Web Source"),
  sourceUrl: z.string().optional(),
  sourceId: z.string().optional(),
  sourceIds: z.array(z.string()).default([]),
  confidence: z.number().int().min(0).max(100), // Calibrated Evidence Reliability
  reliabilityScore: z.number().int().min(0).max(100).optional(),
  evidenceBreakdown: evidenceBreakdownSchema.optional(),
  verificationStatus: verificationStatusSchema.default("Needs verification"),
  qualificationStatus: qualificationStatusSchema.default("Needs verification"),
  qualificationReason: z.string().optional(),
  qualificationDetails: qualificationDetailsSchema.optional(),
  evidence: z.array(fieldEvidenceSchema).default([]),
  conflicts: z.array(conflictModelSchema).default([]),
  conflict: conflictModelSchema.optional(),
  entityResolution: z.enum(["RESOLVED", "AMBIGUOUS"]).default("RESOLVED"),
  // Legacy compatibility fields
  company: z.string().default(""),
  role: z.string().default("—"),
  location: z.string().default("—"),
  experience: z.string().default("—"),
  salary: z.string().default("Not disclosed"),
  size: z.string().default("—"),
  status: z.enum(["Verified", "Review", "Conflict", "Incomplete"]).default("Review"),
});
export type CanonicalRecord = z.infer<typeof canonicalRecordSchema>;

// ─── Run & Progress States ──────────────────────────────────────────────────
export const runStageStatusSchema = z.enum([
  "QUEUED",
  "PLANNING",
  "SEARCHING",
  "CRAWLING",
  "EXTRACTING",
  "NORMALIZING",
  "VERIFYING",
  "QUALIFYING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);
export type RunStageStatus = z.infer<typeof runStageStatusSchema>;

export const runProgressSchema = z.object({
  runId: z.string(),
  requestId: z.string(),
  status: runStageStatusSchema,
  currentStage: z.string(),
  progressPercent: z.number().min(0).max(100),
  stageDetail: z.string(),
  sourcesFound: z.number().int().default(0),
  sourcesProcessed: z.number().int().default(0),
  recordsCollected: z.number().int().default(0),
  recordsQualified: z.number().int().default(0),
  error: z.string().optional(),
  updatedAt: z.string(),
});
export type RunProgress = z.infer<typeof runProgressSchema>;
