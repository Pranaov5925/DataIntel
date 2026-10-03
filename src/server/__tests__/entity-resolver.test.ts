/**
 * DATAINTEL — Entity Resolution & Deduplication Test Suite
 * Tests Requirement 6:
 * - Completely eliminate destructive entity deduplication.
 * - Never deduplicate solely on entityName.
 * - Never treat generic terms ("companies", "software companies", "jobs", "list") as unique entities.
 * - Distinct jobs at the same company must NOT be merged into one.
 * - Explainable merge logs.
 * - Retain ambiguous records without destruction.
 */

import {
  resolveAndDeduplicateEntities,
  compareEntityIdentity,
  extractRootDomain,
  normalizeEntityName,
} from "../entity-resolver";
import type { DatasetRecord } from "../../lib/pipeline-schema";

let passed = 0;
let failed = 0;

function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name} ${detail ? `(${detail})` : ""}`);
    failed++;
  }
}

function makeRecord(overrides: Partial<DatasetRecord>): DatasetRecord {
  return {
    id: `R-${Math.random().toString(36).slice(2, 6)}`,
    entityName: "Entity",
    attributes: {},
    source: "web",
    confidence: 80,
    status: "Verified",
    qualificationStatus: "Qualified",
    verificationStatus: "Confirmed",
    evidence: [],
    conflicts: [],
    company: "",
    role: "—",
    location: "—",
    experience: "—",
    salary: "Not disclosed",
    size: "—",
    ...overrides,
  };
}

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("  DataIntel Entity Resolver — Comprehensive Test Suite");
console.log("═══════════════════════════════════════════════════════════════\n");

console.log("DOMAIN EXTRACTION & NAME NORMALIZATION");
assert(
  extractRootDomain("https://careers.freshworks.com/job/12") === "freshworks.com",
  "Extract root domain careers.freshworks.com",
);
assert(
  extractRootDomain("https://www.infosys.co.in/careers") === "infosys.co.in",
  "Extract root domain infosys.co.in",
);
assert(
  normalizeEntityName("Infosys Technologies Pvt Ltd") === "infosys",
  "Strip legal suffixes Pvt Ltd / Technologies",
);
assert(normalizeEntityName("Freshworks Inc.") === "freshworks", "Strip legal suffix Inc.");

console.log("\nGENERIC NOUN STOPLIST PROTECTION");
// 1. Two records named "Software Companies" must NEVER merge
const recGeneric1 = makeRecord({
  entityName: "Software Companies",
  role: "Java Developer",
  source: "list1.com",
});
const recGeneric2 = makeRecord({
  entityName: "Software Companies",
  role: "Python Developer",
  source: "list2.com",
});
const compGen = compareEntityIdentity(recGeneric1, recGeneric2);
assert(
  compGen.decision === "DISTINCT",
  "Generic name 'Software Companies' rejected from deduplication",
  compGen.reason,
);

// 2. "List of Startups" must never merge
const recList1 = makeRecord({ entityName: "Top Companies", source: "forbes.com" });
const recList2 = makeRecord({ entityName: "Top Companies", source: "techcrunch.com" });
const compList = compareEntityIdentity(recList1, recList2);
assert(
  compList.decision === "DISTINCT",
  "Generic name 'Top Companies' rejected from deduplication",
  compList.reason,
);

console.log("\nSAME COMPANY — DISTINCT ROLES PRESERVED");
// 3. Infosys Java Backend vs Infosys React Frontend → DISTINCT
const recJob1 = makeRecord({
  entityName: "Infosys",
  role: "Java Backend Developer",
  source: "infosys.com",
  evidence: [
    {
      field: "Role",
      value: "Java Backend Developer",
      source: "infosys.com",
      url: "https://careers.infosys.com/job/1",
      retrieved: "now",
      snippet: "Java Developer",
      verification: "Confirmed",
    },
  ],
});
const recJob2 = makeRecord({
  entityName: "Infosys",
  role: "React Frontend Engineer",
  source: "infosys.com",
  evidence: [
    {
      field: "Role",
      value: "React Frontend Engineer",
      source: "infosys.com",
      url: "https://careers.infosys.com/job/2",
      retrieved: "now",
      snippet: "React Engineer",
      verification: "Confirmed",
    },
  ],
});
const compJobs = compareEntityIdentity(recJob1, recJob2);
assert(
  compJobs.decision === "DISTINCT",
  "Different roles at same company are NOT merged",
  compJobs.reason,
);

console.log("\nSTRONG IDENTITY MATCH & NON-DESTRUCTIVE EVIDENCE MERGING");
// 4. Exact match across two sources → Merged with explainable reason
const recSourceA = makeRecord({
  entityName: "Freshworks",
  role: "Java Backend Developer",
  source: "freshworks.com",
  confidence: 85,
  attributes: { Company: "Freshworks", Role: "Java Backend Developer", Location: "Chennai" },
  evidence: [
    {
      field: "Role",
      value: "Java Backend Developer",
      source: "freshworks.com",
      url: "https://careers.freshworks.com/job/1",
      retrieved: "now",
      snippet: "Hiring Java Backend",
      verification: "Confirmed",
    },
  ],
});
const recSourceB = makeRecord({
  entityName: "Freshworks Technologies",
  role: "Java Backend Developer",
  source: "linkedin.com",
  confidence: 90,
  attributes: { Company: "Freshworks", Role: "Java Backend Developer", Salary: "₹25 LPA" },
  evidence: [
    {
      field: "Salary",
      value: "₹25 LPA",
      source: "linkedin.com",
      url: "https://linkedin.com/jobs/view/123",
      retrieved: "now",
      snippet: "Salary ₹25 LPA",
      verification: "Confirmed",
    },
  ],
});

const res = resolveAndDeduplicateEntities([recSourceA, recSourceB]);
assert(
  res.unique.length === 1,
  "Two identical records merged into 1 unique record",
  `Got ${res.unique.length}`,
);
assert(res.duplicatesMerged === 1, "Duplicate count recorded", `Got ${res.duplicatesMerged}`);
assert(res.merges.length === 1, "Explainable merge log created");
assert(res.merges[0]!.reason.includes("STRONG_IDENTITY_MATCH"), "Reason explains strong match");

const merged = res.unique[0]!;
assert(
  merged.evidence.length === 2,
  "Evidence citations combined non-destructively (2 items)",
  `Got ${merged.evidence.length}`,
);
assert(
  merged.attributes["Salary"] === "₹25 LPA",
  "Missing attribute 'Salary' backfilled from second source",
);
assert(merged.attributes["Location"] === "Chennai", "Existing attribute 'Location' preserved");

console.log(`\n═══════════════════════════════════════════════════════════════`);
console.log(`  Entity Resolver Results: ${passed} passed, ${failed} failed`);
console.log(`═══════════════════════════════════════════════════════════════\n`);

if (failed > 0) process.exit(1);
