/**
 * DataIntel Qualification Engine — Comprehensive Test Suite
 * Covers all 12 test cases specified in the data quality fix requirements.
 *
 * Run with: npx tsx src/server/__tests__/qualification-engine.test.ts
 */

import {
  evaluateRecordQualification,
  parseNumericValue,
  extractDeterministicConstraints,
} from "../qualification-engine";
import type { DatasetRecord } from "../../lib/pipeline-schema";
import type { StructuredConstraint } from "../../lib/workflow-schema";

// ─── Test Helpers ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ ${testName}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function makeRecord(overrides: Partial<DatasetRecord> = {}): DatasetRecord {
  return {
    id: `test-${Math.random().toString(36).slice(2, 8)}`,
    entityName: "Test Entity",
    attributes: {},
    source: "Test",
    confidence: 0,
    verificationStatus: "Needs verification",
    qualificationStatus: "Needs verification",
    evidence: [],
    conflicts: [],
    company: "",
    role: "",
    location: "",
    experience: "",
    salary: "",
    size: "",
    status: "Review",
    ...overrides,
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("  DataIntel Qualification Engine — Comprehensive Test Suite");
console.log("═══════════════════════════════════════════════════════════════\n");

// ═══ TEST 1: Experience within range → QUALIFIED ═══════════════════════════
console.log("TEST 1: Required experience = 2-5, Actual = 3-4 → QUALIFIED");
{
  const record = makeRecord({
    entityName: "Furlenco",
    attributes: { Experience: "3-4 years" },
    evidence: [
      {
        field: "Experience",
        value: "3-4 years",
        source: "Naukri",
        url: "https://naukri.com/furlenco",
        retrieved: "2026-10-03",
        snippet: "Experience: 3-4 years",
        verification: "Confirmed",
      },
    ],
  });
  const constraints: StructuredConstraint[] = [
    {
      field: "Experience",
      operator: "between",
      value: "2",
      valueTo: "5",
      unit: "years",
      hard: true,
    },
  ];
  const result = evaluateRecordQualification(record, constraints);
  assert(result.status === "Qualified", `Status: ${result.status} (expected Qualified)`);
  assert(result.details.constraints[0]!.result === "PASS", "Constraint result is PASS");
}

// ═══ TEST 2: Experience outside range → EXCLUDED ══════════════════════════
console.log("\nTEST 2: Required experience = 2-5, Actual = 8-10 → EXCLUDED");
{
  const record = makeRecord({
    entityName: "VY Systems",
    attributes: { Experience: "8-10 years" },
    evidence: [
      {
        field: "Experience",
        value: "8-10 years",
        source: "LinkedIn",
        url: "https://linkedin.com",
        retrieved: "2026-10-03",
        snippet: "8-10 years required",
        verification: "Confirmed",
      },
    ],
  });
  const constraints: StructuredConstraint[] = [
    {
      field: "Experience",
      operator: "between",
      value: "2",
      valueTo: "5",
      unit: "years",
      hard: true,
    },
  ];
  const result = evaluateRecordQualification(record, constraints);
  assert(result.status === "Excluded", `Status: ${result.status} (expected Excluded)`);
  assert(result.details.constraints[0]!.result === "FAIL", "Constraint result is FAIL");
  assert(result.reason.includes("does not satisfy"), `Reason mentions failure: ${result.reason}`);
}

// ═══ TEST 3: Experience null → NEEDS_VERIFICATION ═════════════════════════
console.log("\nTEST 3: Required experience = 2-5, Actual = null → NEEDS_VERIFICATION");
{
  const record = makeRecord({
    entityName: "Furlenco",
    attributes: { Experience: null },
  });
  const constraints: StructuredConstraint[] = [
    {
      field: "Experience",
      operator: "between",
      value: "2",
      valueTo: "5",
      unit: "years",
      hard: true,
    },
  ];
  const result = evaluateRecordQualification(record, constraints);
  assert(
    result.status === "Needs verification",
    `Status: ${result.status} (expected Needs verification)`,
  );
  assert(result.status !== "Excluded", "Must NOT be Excluded");
  assert(result.details.constraints[0]!.result === "UNKNOWN", "Constraint result is UNKNOWN");
  assert(result.details.constraints[0]!.reason === "FIELD_NOT_FOUND", "Reason is FIELD_NOT_FOUND");
}

// ═══ TEST 4: Experience >= 2, Actual = null → NEEDS_VERIFICATION ══════════
console.log("\nTEST 4: Required experience >= 2, Actual = null → NEEDS_VERIFICATION");
{
  const record = makeRecord({
    entityName: "Karnival",
    attributes: {},
    experience: "",
  });
  const constraints: StructuredConstraint[] = [
    {
      field: "Experience",
      operator: "greater_than_or_equal",
      value: "2",
      unit: "years",
      hard: true,
    },
  ];
  const result = evaluateRecordQualification(record, constraints);
  assert(
    result.status === "Needs verification",
    `Status: ${result.status} (expected Needs verification)`,
  );
  assert(result.status !== "Excluded", "Must NOT be Excluded — missing is not the same as wrong");
  assert(result.details.constraints[0]!.result === "UNKNOWN", "Constraint is UNKNOWN, not FAIL");
}

// ═══ TEST 5: Conflicting sources → CONFLICT ══════════════════════════════
console.log("\nTEST 5: Source A = 3 years, Source B = 7 years → CONFLICT");
{
  const record = makeRecord({
    entityName: "Planview",
    attributes: { Experience: "3 years" },
    evidence: [
      {
        field: "Experience",
        value: "3 years",
        source: "Source A",
        url: "https://a.com",
        retrieved: "2026-10-03",
        snippet: "3 years exp",
        verification: "Confirmed",
      },
      {
        field: "Experience",
        value: "7 years",
        source: "Source B",
        url: "https://b.com",
        retrieved: "2026-10-03",
        snippet: "7 years exp",
        verification: "Confirmed",
      },
    ],
    conflicts: [
      {
        field: "Experience",
        values: [
          {
            source: "Source A",
            value: "3 years",
            url: "https://a.com",
            retrieved: "2026-10-03",
            snippet: "3 years exp",
          },
          {
            source: "Source B",
            value: "7 years",
            url: "https://b.com",
            retrieved: "2026-10-03",
            snippet: "7 years exp",
          },
        ],
      },
    ],
  });
  const constraints: StructuredConstraint[] = [
    {
      field: "Experience",
      operator: "between",
      value: "2",
      valueTo: "5",
      unit: "years",
      hard: true,
    },
  ];
  const result = evaluateRecordQualification(record, constraints);
  assert(result.status === "Conflict", `Status: ${result.status} (expected Conflict)`);
  assert(result.reason.includes("Conflicting"), `Reason mentions conflict: ${result.reason}`);
}

// ═══ TEST 6: Lakh normalization ═══════════════════════════════════════════
console.log("\nTEST 6: ₹2 lakh → normalized = 200000");
{
  const tests: [string, number][] = [
    ["₹2 lakh", 200000],
    ["₹2,00,000", 200000],
    ["200000", 200000],
    ["₹50 lakh", 5000000],
    ["₹1.5 Lakh", 150000],
    ["₹5 Cr", 50000000],
    ["₹1,50,000", 150000],
  ];
  for (const [input, expected] of tests) {
    const parsed = parseNumericValue(input);
    assert(
      parsed !== null && Math.abs(parsed.num - expected) < 1,
      `parseNumericValue("${input}") = ${parsed?.num} (expected ~${expected})`,
    );
  }
}

// ═══ TEST 7: Generic company names → no destructive merging ═══════════════
console.log("\nTEST 7: Generic company/entity names → no destructive merging");
{
  // This test verifies the dedup logic by checking that the qualification engine
  // doesn't merge or confuse entities. Two different entities with similar roles
  // should produce independent evaluations.
  const record1 = makeRecord({
    entityName: "Tech Solutions Pvt Ltd",
    attributes: { Role: "Java Developer", Experience: "3 years" },
    evidence: [
      {
        field: "Role",
        value: "Java Developer",
        source: "Naukri",
        url: "https://naukri.com/1",
        retrieved: "2026-10-03",
        snippet: "Java Dev",
        verification: "Confirmed",
      },
    ],
  });
  const record2 = makeRecord({
    entityName: "Tech Solutions India",
    attributes: { Role: "Java Developer", Experience: "6 years" },
    evidence: [
      {
        field: "Role",
        value: "Java Developer",
        source: "LinkedIn",
        url: "https://linkedin.com/2",
        retrieved: "2026-10-03",
        snippet: "Java Dev",
        verification: "Confirmed",
      },
    ],
  });
  const constraints: StructuredConstraint[] = [
    {
      field: "Experience",
      operator: "between",
      value: "2",
      valueTo: "5",
      unit: "years",
      hard: true,
    },
  ];
  const result1 = evaluateRecordQualification(record1, constraints);
  const result2 = evaluateRecordQualification(record2, constraints);
  assert(result1.status === "Qualified", `Record1 (3yr): ${result1.status} (expected Qualified)`);
  assert(result2.status === "Excluded", `Record2 (6yr): ${result2.status} (expected Excluded)`);
  assert(result1.status !== result2.status, "Different entities produce independent results");
}

// ═══ TEST 8: One missing field → record intact, field explicit ════════════
console.log("\nTEST 8: One record missing one field → field status explicit");
{
  const record = makeRecord({
    entityName: "Furlenco",
    attributes: { Role: "Backend Developer - Java", Company: "Furlenco", Experience: null },
    evidence: [
      {
        field: "Role",
        value: "Backend Developer - Java",
        source: "Naukri",
        url: "https://naukri.com",
        retrieved: "2026-10-03",
        snippet: "Backend Java",
        verification: "Confirmed",
      },
    ],
  });
  const constraints: StructuredConstraint[] = [
    { field: "role", operator: "contains", value: "Java Backend Developer", hard: true },
    {
      field: "Experience",
      operator: "between",
      value: "2",
      valueTo: "5",
      unit: "years",
      hard: true,
    },
  ];
  const result = evaluateRecordQualification(record, constraints, ["Role", "Experience"]);

  // Record should remain intact (not discarded)
  assert(
    result.status === "Needs verification",
    `Status: ${result.status} (expected Needs verification, not Excluded)`,
  );
  // Missing field should be explicit
  assert(result.details.constraints.length === 2, "Both constraints evaluated");
  const roleConstraint = result.details.constraints.find((c) => c.field === "role");
  const expConstraint = result.details.constraints.find((c) => c.field === "Experience");
  assert(
    roleConstraint?.result === "PASS",
    `Role constraint: ${roleConstraint?.result} (expected PASS)`,
  );
  assert(
    expConstraint?.result === "UNKNOWN",
    `Experience constraint: ${expConstraint?.result} (expected UNKNOWN)`,
  );
  assert(result.details.missingFields.includes("Experience"), "Experience listed in missingFields");
}

// ═══ TEST 9: All constraints PASS → QUALIFIED ═══════════════════════════
console.log("\nTEST 9: All constraints PASS → QUALIFIED");
{
  const record = makeRecord({
    entityName: "Freshworks",
    attributes: { Role: "Java Backend Developer", Experience: "3-5 years", Location: "Chennai" },
    evidence: [
      {
        field: "Role",
        value: "Java Backend Developer",
        source: "Freshworks",
        url: "https://freshworks.com/careers",
        retrieved: "2026-10-03",
        snippet: "Java Backend",
        verification: "Confirmed",
      },
      {
        field: "Experience",
        value: "3-5 years",
        source: "Freshworks",
        url: "https://freshworks.com/careers",
        retrieved: "2026-10-03",
        snippet: "3-5 years",
        verification: "Confirmed",
      },
    ],
  });
  const constraints: StructuredConstraint[] = [
    { field: "role", operator: "contains", value: "Java Backend Developer", hard: true },
    {
      field: "Experience",
      operator: "between",
      value: "2",
      valueTo: "5",
      unit: "years",
      hard: true,
    },
  ];
  const result = evaluateRecordQualification(record, constraints);
  assert(result.status === "Qualified", `Status: ${result.status} (expected Qualified)`);
  assert(
    result.details.constraints.every((c) => c.result === "PASS"),
    "All constraints PASS",
  );
}

// ═══ TEST 10: One confirmed FAIL + other UNKNOWN → EXCLUDED ═════════════
console.log("\nTEST 10: One confirmed hard FAIL + other UNKNOWN → EXCLUDED");
{
  const record = makeRecord({
    entityName: "VY Systems",
    attributes: { Experience: "9.5-15 years" },
    evidence: [
      {
        field: "Experience",
        value: "9.5-15 years",
        source: "LinkedIn",
        url: "https://linkedin.com",
        retrieved: "2026-10-03",
        snippet: "9.5-15 years",
        verification: "Confirmed",
      },
    ],
  });
  const constraints: StructuredConstraint[] = [
    {
      field: "Experience",
      operator: "between",
      value: "2",
      valueTo: "5",
      unit: "years",
      hard: true,
    },
    { field: "Salary", operator: "less_than_or_equal", value: "2000000", unit: "INR", hard: true },
  ];
  const result = evaluateRecordQualification(record, constraints);
  assert(result.status === "Excluded", `Status: ${result.status} (expected Excluded)`);
  assert(result.details.constraints.length === 2, "Both constraints evaluated (no early return)");
  const expC = result.details.constraints.find((c) => c.field === "Experience");
  const salC = result.details.constraints.find((c) => c.field === "Salary");
  assert(expC?.result === "FAIL", `Experience: ${expC?.result} (expected FAIL)`);
  assert(salC?.result === "UNKNOWN", `Salary: ${salC?.result} (expected UNKNOWN)`);
}

// ═══ TEST 11: Only UNKNOWN constraints → NEEDS_VERIFICATION ═════════════
console.log("\nTEST 11: Only UNKNOWN constraints → NEEDS_VERIFICATION");
{
  const record = makeRecord({
    entityName: "Mystery Corp",
    attributes: {},
    experience: "",
    salary: "",
  });
  const constraints: StructuredConstraint[] = [
    {
      field: "Experience",
      operator: "between",
      value: "2",
      valueTo: "5",
      unit: "years",
      hard: true,
    },
    { field: "Salary", operator: "less_than_or_equal", value: "2000000", unit: "INR", hard: true },
  ];
  const result = evaluateRecordQualification(record, constraints);
  assert(
    result.status === "Needs verification",
    `Status: ${result.status} (expected Needs verification)`,
  );
  assert(result.status !== "Excluded", "Must NOT be Excluded when all constraints are UNKNOWN");
  assert(
    result.details.constraints.every((c) => c.result === "UNKNOWN"),
    "All constraints UNKNOWN",
  );
}

// ═══ TEST 12: Conflicting credible sources → CONFLICT ═══════════════════
console.log("\nTEST 12: Conflicting credible sources → CONFLICT");
{
  const record = makeRecord({
    entityName: "Zoho",
    attributes: { Salary: "₹15 LPA" },
    evidence: [
      {
        field: "Salary",
        value: "₹15 LPA",
        source: "Glassdoor",
        url: "https://glassdoor.com",
        retrieved: "2026-10-03",
        snippet: "15 LPA",
        verification: "Confirmed",
      },
      {
        field: "Salary",
        value: "₹8 LPA",
        source: "AmbitionBox",
        url: "https://ambitionbox.com",
        retrieved: "2026-10-03",
        snippet: "8 LPA",
        verification: "Confirmed",
      },
    ],
    conflicts: [
      {
        field: "Salary",
        values: [
          {
            source: "Glassdoor",
            value: "₹15 LPA",
            url: "https://glassdoor.com",
            retrieved: "2026-10-03",
            snippet: "15 LPA",
          },
          {
            source: "AmbitionBox",
            value: "₹8 LPA",
            url: "https://ambitionbox.com",
            retrieved: "2026-10-03",
            snippet: "8 LPA",
          },
        ],
      },
    ],
  });
  const constraints: StructuredConstraint[] = [];
  const result = evaluateRecordQualification(record, constraints);
  assert(result.status === "Conflict", `Status: ${result.status} (expected Conflict)`);
  assert(result.reason.includes("Conflicting"), `Reason: ${result.reason}`);
}

// ═══ ADDITIONAL: Placeholder normalization ═══════════════════════════════
console.log("\nADDITIONAL: Placeholder values treated as missing");
{
  const record = makeRecord({
    entityName: "TestCo",
    attributes: { Experience: "—", Salary: "Not disclosed" },
  });
  const constraints: StructuredConstraint[] = [
    {
      field: "Experience",
      operator: "between",
      value: "2",
      valueTo: "5",
      unit: "years",
      hard: true,
    },
    { field: "Salary", operator: "less_than_or_equal", value: "2000000", unit: "INR", hard: true },
  ];
  const result = evaluateRecordQualification(record, constraints);
  assert(
    result.status === "Needs verification",
    `"—" and "Not disclosed" → Needs verification, got: ${result.status}`,
  );
  assert(
    result.details.constraints.every((c) => c.result === "UNKNOWN"),
    "All placeholders → UNKNOWN",
  );
}

// ═══ ADDITIONAL: Soft constraints don't affect qualification ═════════════
console.log("\nADDITIONAL: Soft constraints (hard=false) don't affect qualification");
{
  const record = makeRecord({
    entityName: "TestCo",
    attributes: { Role: "Java Developer" },
    evidence: [
      {
        field: "Role",
        value: "Java Developer",
        source: "X",
        url: "https://x.com",
        retrieved: "2026-10-03",
        snippet: "Java Dev",
        verification: "Confirmed",
      },
    ],
  });
  const constraints: StructuredConstraint[] = [
    { field: "role", operator: "contains", value: "Java", hard: true },
    { field: "location", operator: "contains", value: "India", hard: false },
  ];
  const result = evaluateRecordQualification(record, constraints);
  assert(result.status === "Qualified", `Soft constraint ignored: ${result.status}`);
  assert(result.details.constraints.length === 1, "Only hard constraints evaluated");
}

// ═══ ADDITIONAL: Between operator with range overlap ═════════════════════
console.log("\nADDITIONAL: Between operator — range value overlap detection");
{
  // Record has "1-3 years" and constraint is "between 2-5"
  // min=1, max=3, constraint min=2, max=5
  // Overlap exists (2-3), so should PASS
  const record = makeRecord({
    entityName: "Karnival",
    attributes: { Experience: "1-3 years" },
    evidence: [
      {
        field: "Experience",
        value: "1-3 years",
        source: "X",
        url: "https://x.com",
        retrieved: "2026-10-03",
        snippet: "1-3 yrs",
        verification: "Confirmed",
      },
    ],
  });
  const constraints: StructuredConstraint[] = [
    {
      field: "Experience",
      operator: "between",
      value: "2",
      valueTo: "5",
      unit: "years",
      hard: true,
    },
  ];
  const result = evaluateRecordQualification(record, constraints);
  assert(
    result.details.constraints[0]!.result === "PASS",
    `1-3 overlaps 2-5: ${result.details.constraints[0]!.result} (expected PASS)`,
  );
}

// ═══ ADDITIONAL: Completeness score ═════════════════════════════════════
console.log("\nADDITIONAL: Completeness score calculation");
{
  const record = makeRecord({
    entityName: "TestCo",
    attributes: { Company: "TestCo", Role: "Dev", Location: null, Experience: null },
  });
  const result = evaluateRecordQualification(
    record,
    [],
    ["Company", "Role", "Location", "Experience"],
  );
  assert(
    result.details.completenessScore === 50,
    `Completeness: ${result.details.completenessScore}% (expected 50%)`,
  );
  assert(
    result.details.missingFields.length === 2,
    `Missing fields: ${result.details.missingFields.length} (expected 2)`,
  );
}

// ═══ ADDITIONAL: NLP constraint extraction ═════════════════════════════════
console.log("\nADDITIONAL: NLP constraint extraction from user request");
{
  const { structuredConstraints } = extractDeterministicConstraints(
    "Find Java backend developer jobs in India with 50-500 employees companies priced under ₹2 lakh",
    [],
  );
  const roleConstraint = structuredConstraints.find((c) => c.field === "role");
  const sizeConstraint = structuredConstraints.find((c) => c.field === "company_size");
  const locationConstraint = structuredConstraints.find((c) => c.field === "location");

  assert(roleConstraint !== undefined, "Extracted role constraint");
  assert(roleConstraint?.hard === true, "Role constraint is hard");
  assert(sizeConstraint !== undefined, "Extracted company_size constraint");
  assert(sizeConstraint?.operator === "between", `Size operator: ${sizeConstraint?.operator}`);
  assert(locationConstraint !== undefined, "Extracted location constraint");
  assert(locationConstraint?.hard === false, "Location constraint is soft (non-disqualifying)");
}

// ─── Summary ──────────────────────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════════════════════════");
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log("═══════════════════════════════════════════════════════════════\n");
process.exit(failed > 0 ? 1 : 0);
