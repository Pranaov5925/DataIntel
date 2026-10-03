/**
 * DATAINTEL — Extended Operator Engine Test Suite
 * Tests Requirement 12:
 * Support generic operators:
 * equals, not_equals, contains, not_contains, starts_with, ends_with,
 * greater_than, greater_than_or_equal, less_than, less_than_or_equal, between,
 * in, not_in, before, after, within, semantic_match, contains_any, contains_all
 */

import { evaluateRecordQualification } from "../qualification-engine";
import type { DatasetRecord } from "../../lib/pipeline-schema";
import type { StructuredConstraint } from "../../lib/workflow-schema";

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

function makeRecord(attrs: Record<string, string>): DatasetRecord {
  return {
    id: "REC-TEST",
    entityName: attrs["Company"] || "Test Corp",
    attributes: attrs,
    source: "web",
    confidence: 85,
    status: "Verified",
    qualificationStatus: "Qualified",
    verificationStatus: "Confirmed",
    evidence: [
      {
        field: "General",
        value: "Verified",
        source: "test.com",
        url: "https://test.com",
        retrieved: "now",
        snippet: "Evidence",
        verification: "Confirmed",
      },
    ],
    conflicts: [],
    company: attrs["Company"] || "",
    role: attrs["Role"] || "—",
    location: attrs["Location"] || "—",
    experience: attrs["Experience"] || "—",
    salary: attrs["Salary"] || "Not disclosed",
    size: attrs["Company Size"] || "—",
  };
}

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("  DataIntel Extended Operator Engine — Test Suite");
console.log("═══════════════════════════════════════════════════════════════\n");

// 1. starts_with & ends_with
console.log("STRING BOUNDARY OPERATORS: starts_with, ends_with");
const recPrefix = makeRecord({ Role: "Senior Backend Engineer" });
const cStartsPass: StructuredConstraint = {
  field: "Role",
  operator: "starts_with",
  value: "Senior",
  hard: true,
};
const resStartsPass = evaluateRecordQualification(recPrefix, [cStartsPass]);
assert(resStartsPass.status === "Qualified", "starts_with 'Senior' passes", resStartsPass.reason);

const cStartsFail: StructuredConstraint = {
  field: "Role",
  operator: "starts_with",
  value: "Junior",
  hard: true,
};
const resStartsFail = evaluateRecordQualification(recPrefix, [cStartsFail]);
assert(
  resStartsFail.status === "Excluded",
  "starts_with 'Junior' fails (Excluded)",
  resStartsFail.reason,
);

const cEndsPass: StructuredConstraint = {
  field: "Role",
  operator: "ends_with",
  value: "Engineer",
  hard: true,
};
const resEndsPass = evaluateRecordQualification(recPrefix, [cEndsPass]);
assert(resEndsPass.status === "Qualified", "ends_with 'Engineer' passes", resEndsPass.reason);

// 2. not_equals & not_contains
console.log("\nNEGATION OPERATORS: not_equals, not_contains");
const recNeg = makeRecord({ Industry: "FinTech", Status: "Active" });
const cNotEqPass: StructuredConstraint = {
  field: "Industry",
  operator: "not_equals",
  value: "EdTech",
  hard: true,
};
assert(
  evaluateRecordQualification(recNeg, [cNotEqPass]).status === "Qualified",
  "not_equals 'EdTech' passes",
);

const cNotEqFail: StructuredConstraint = {
  field: "Industry",
  operator: "not_equals",
  value: "FinTech",
  hard: true,
};
assert(
  evaluateRecordQualification(recNeg, [cNotEqFail]).status === "Excluded",
  "not_equals 'FinTech' fails",
);

const cNotContainsPass: StructuredConstraint = {
  field: "Industry",
  operator: "not_contains",
  value: "Crypto",
  hard: true,
};
assert(
  evaluateRecordQualification(recNeg, [cNotContainsPass]).status === "Qualified",
  "not_contains 'Crypto' passes",
);

const cNotContainsFail: StructuredConstraint = {
  field: "Industry",
  operator: "not_contains",
  value: "Fin",
  hard: true,
};
assert(
  evaluateRecordQualification(recNeg, [cNotContainsFail]).status === "Excluded",
  "not_contains 'Fin' fails",
);

// 3. in & not_in
console.log("\nMEMBERSHIP OPERATORS: in, not_in");
const recSet = makeRecord({ Tier: "Tier 1", City: "Bengaluru" });
const cInPass: StructuredConstraint = {
  field: "Tier",
  operator: "in",
  value: "Tier 1, Tier 2",
  hard: true,
};
assert(
  evaluateRecordQualification(recSet, [cInPass]).status === "Qualified",
  "in ['Tier 1', 'Tier 2'] passes",
);

const cInFail: StructuredConstraint = {
  field: "Tier",
  operator: "in",
  value: "Tier 3, Tier 4",
  hard: true,
};
assert(
  evaluateRecordQualification(recSet, [cInFail]).status === "Excluded",
  "in ['Tier 3', 'Tier 4'] fails",
);

const cNotInPass: StructuredConstraint = {
  field: "Tier",
  operator: "not_in",
  value: "Tier 3, Tier 4",
  hard: true,
};
assert(
  evaluateRecordQualification(recSet, [cNotInPass]).status === "Qualified",
  "not_in ['Tier 3', 'Tier 4'] passes",
);

// 4. contains_any & contains_all
console.log("\nMULTI-CONTAINMENT: contains_any, contains_all");
const recTech = makeRecord({ Skills: "Java, Spring Boot, Docker, Kubernetes" });
const cAnyPass: StructuredConstraint = {
  field: "Skills",
  operator: "contains_any",
  value: "Python, Java, Rust",
  hard: true,
};
assert(
  evaluateRecordQualification(recTech, [cAnyPass]).status === "Qualified",
  "contains_any ['Python', 'Java', 'Rust'] passes",
);

const cAnyFail: StructuredConstraint = {
  field: "Skills",
  operator: "contains_any",
  value: "Python, Ruby",
  hard: true,
};
assert(
  evaluateRecordQualification(recTech, [cAnyFail]).status === "Excluded",
  "contains_any ['Python', 'Ruby'] fails",
);

const cAllPass: StructuredConstraint = {
  field: "Skills",
  operator: "contains_all",
  value: "Java, Spring",
  hard: true,
};
assert(
  evaluateRecordQualification(recTech, [cAllPass]).status === "Qualified",
  "contains_all ['Java', 'Spring'] passes",
);

const cAllFail: StructuredConstraint = {
  field: "Skills",
  operator: "contains_all",
  value: "Java, React",
  hard: true,
};
assert(
  evaluateRecordQualification(recTech, [cAllFail]).status === "Excluded",
  "contains_all ['Java', 'React'] fails",
);

// 5. Date operators: before, after
console.log("\nDATE OPERATORS: before, after");
const recDate = makeRecord({ Founded: "2018-05-15" });
const cBeforePass: StructuredConstraint = {
  field: "Founded",
  operator: "before",
  value: "2020-01-01",
  hard: true,
};
assert(
  evaluateRecordQualification(recDate, [cBeforePass]).status === "Qualified",
  "before '2020-01-01' passes",
);

const cBeforeFail: StructuredConstraint = {
  field: "Founded",
  operator: "before",
  value: "2015-01-01",
  hard: true,
};
assert(
  evaluateRecordQualification(recDate, [cBeforeFail]).status === "Excluded",
  "before '2015-01-01' fails",
);

const cAfterPass: StructuredConstraint = {
  field: "Founded",
  operator: "after",
  value: "2015-01-01",
  hard: true,
};
assert(
  evaluateRecordQualification(recDate, [cAfterPass]).status === "Qualified",
  "after '2015-01-01' passes",
);

// 6. Tolerance operator: within
console.log("\nTOLERANCE OPERATOR: within");
const recTol = makeRecord({ Price: "₹1,85,000" });
const cWithinPass: StructuredConstraint = {
  field: "Price",
  operator: "within",
  value: "200000",
  valueTo: "25000",
  hard: true,
};
assert(
  evaluateRecordQualification(recTol, [cWithinPass]).status === "Qualified",
  "within 200000 ± 25000 passes (185000)",
);

const cWithinFail: StructuredConstraint = {
  field: "Price",
  operator: "within",
  value: "200000",
  valueTo: "10000",
  hard: true,
};
assert(
  evaluateRecordQualification(recTol, [cWithinFail]).status === "Excluded",
  "within 200000 ± 10000 fails (185000)",
);

console.log(`\n═══════════════════════════════════════════════════════════════`);
console.log(`  Extended Operators Results: ${passed} passed, ${failed} failed`);
console.log(`═══════════════════════════════════════════════════════════════\n`);

if (failed > 0) process.exit(1);
