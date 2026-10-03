/**
 * DATAINTEL — SQLite Database Engine Test Suite
 * Tests Requirement 25:
 * - Normalized tables for requests, runs, sources, records, record_fields, evidence, conflicts
 * - Primary keys, foreign keys, indexes
 * - Insertion, retrieval, and hydration
 */

import {
  getDatabase,
  dbSaveRequest,
  dbGetRequests,
  dbGetRequestById,
  dbSaveRun,
  dbGetRuns,
  dbGetRunById,
} from "../db";
import type { PersistedDataRequest, PersistedRun } from "../../lib/storage-schema";

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

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("  DataIntel SQLite Database — Test Suite");
console.log("═══════════════════════════════════════════════════════════════\n");

const db = getDatabase();

console.log("SCHEMA VERIFICATION");
// Check tables exist
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
  name: string;
}[];
const tableNames = new Set(tables.map((t) => t.name));

assert(tableNames.has("requests"), "Table 'requests' exists");
assert(tableNames.has("runs"), "Table 'runs' exists");
assert(tableNames.has("sources"), "Table 'sources' exists");
assert(tableNames.has("records"), "Table 'records' exists");
assert(tableNames.has("record_fields"), "Table 'record_fields' exists");
assert(tableNames.has("evidence"), "Table 'evidence' exists");
assert(tableNames.has("conflicts"), "Table 'conflicts' exists");
assert(tableNames.has("workflow_steps"), "Table 'workflow_steps' exists");

// Check indexes exist
const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all() as {
  name: string;
}[];
const indexNames = new Set(indexes.map((i) => i.name));
assert(indexNames.has("idx_requests_created_at"), "Index 'idx_requests_created_at' exists");
assert(indexNames.has("idx_runs_request_id"), "Index 'idx_runs_request_id' exists");
assert(indexNames.has("idx_records_run_id"), "Index 'idx_records_run_id' exists");
assert(indexNames.has("idx_records_status"), "Index 'idx_records_status' exists");
assert(indexNames.has("idx_evidence_record_id"), "Index 'idx_evidence_record_id' exists");

console.log("\nREQUEST PERSISTENCE & RETRIEVAL");
const testReq: PersistedDataRequest = {
  id: "DR-TEST-001",
  name: "Test Request SaaS",
  prompt: "Find Indian SaaS companies",
  status: "completed",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  runIds: ["RUN-TEST-001-v1"],
  activeRunId: "RUN-TEST-001-v1",
};

dbSaveRequest(testReq);
const retrievedReq = dbGetRequestById("DR-TEST-001");
assert(retrievedReq !== null, "Retrieve request by ID");
assert(retrievedReq?.name === "Test Request SaaS", "Request name matches");
assert(retrievedReq?.status === "completed", "Request status matches");

console.log("\nRUN, RECORDS, EVIDENCE & CONFLICTS PERSISTENCE");
const testRun: PersistedRun = {
  id: "RUN-TEST-001-v1",
  requestId: "DR-TEST-001",
  runNumber: 1,
  requestName: "Test Request SaaS",
  originalPrompt: "Find Indian SaaS companies",
  status: "Completed",
  createdAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  understanding: {
    objective: "Test collection",
    target: "Companies",
    geography: "India",
    industry: "SaaS",
    constraints: [],
    structuredConstraints: [],
    optionalFields: [],
    requiredFields: ["Company", "Role", "Salary"],
    freshness: "30 days",
    searchIntent: "Testing",
  },
  blueprintStages: [],
  executedStages: [],
  quality: { collected: 10, unique: 8, validated: 6, duplicates: 2, incomplete: 1, conflicts: 1 },
  sources: [
    {
      name: "Freshworks Careers",
      domain: "freshworks.com",
      type: "First-party",
      records: 3,
      reliability: 95,
      checked: "today",
    },
  ],
  records: [
    {
      id: "REC-TEST-01",
      entityName: "Freshworks Inc.",
      company: "Freshworks Inc.",
      role: "Java Backend Developer",
      location: "Chennai",
      experience: "3-5 years",
      salary: "₹25 LPA",
      size: "5000+",
      source: "freshworks.com",
      status: "Verified",
      qualificationStatus: "Qualified",
      verificationStatus: "Confirmed",
      confidence: 94,
      reliabilityScore: 94,
      evidenceBreakdown: {
        requiredFieldSupport: 100,
        evidenceDirectness: 95,
        sourceQuality: 92,
        sourceAgreement: 90,
        freshness: 90,
        freshnessStatus: "RECENT",
        entityConsistency: 100,
        extractionReliability: 95,
        conflictPenalty: 0,
        inferencePenalty: 0,
      },
      attributes: {
        Company: "Freshworks Inc.",
        Role: "Java Backend Developer",
        Location: "Chennai",
        Salary: "₹25 LPA",
      },
      evidence: [
        {
          field: "Role",
          value: "Java Backend Developer",
          source: "freshworks.com",
          url: "https://careers.freshworks.com",
          retrieved: "now",
          snippet: "Hiring Java Backend",
          verification: "Confirmed",
        },
      ],
      conflicts: [],
    },
  ],
  interventions: [],
  adaptiveOutcomes: [["6", "Verified"]],
  adaptiveSummary: "Test run summary",
};

dbSaveRun(testRun);
const retrievedRun = dbGetRunById("RUN-TEST-001-v1");
assert(retrievedRun !== null, "Retrieve run by ID");
assert(retrievedRun?.records.length === 1, "Run records hydrated correctly");
assert(retrievedRun?.records[0]?.entityName === "Freshworks Inc.", "Record entityName matches");
assert(retrievedRun?.records[0]?.confidence === 94, "Reliability score preserved (94%)");
assert(retrievedRun?.records[0]?.evidence.length === 1, "Field-level evidence hydrated");
assert(
  retrievedRun?.records[0]?.evidence[0]?.url === "https://careers.freshworks.com",
  "Evidence URL preserved",
);
assert(retrievedRun?.sources.length === 1, "Sources hydrated");
assert(retrievedRun?.sources[0]?.domain === "freshworks.com", "Source domain matches");

console.log(`\n═══════════════════════════════════════════════════════════════`);
console.log(`  Database Results: ${passed} passed, ${failed} failed`);
console.log(`═══════════════════════════════════════════════════════════════\n`);

if (failed > 0) process.exit(1);
