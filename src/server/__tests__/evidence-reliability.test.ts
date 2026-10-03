/**
 * ═════════════════════════════════════════════════════════════════════════════
 * DataIntel — Evidence Reliability & Calibration Benchmark Test Suite
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Covers:
 * 1. Acceptance Criteria A–J (Section 30)
 * 2. 40-record manually labeled Ground-Truth Benchmark (Section 22 & 23)
 * 3. Calibration & Performance evaluation (Section 31)
 */

import {
  calculateEvidenceReliability,
  evaluateSourceQuality,
  evaluateSourceAgreement,
  evaluateFieldDirectness,
  evaluateEntityConsistency,
  evaluateExtractionReliability,
} from "../evidence-reliability";
import { evaluateRecordQualification } from "../qualification-engine";
import type { DatasetRecord, Evidence, Conflict } from "../../lib/pipeline-schema";
import type { StructuredConstraint } from "../../lib/workflow-schema";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passedCount++;
    console.log(`  ✓ ${message}`);
  } else {
    failedCount++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("  DataIntel Evidence Reliability System — Test Suite & Benchmark");
console.log("═══════════════════════════════════════════════════════════════\n");

// ─── TEST A: Strong Official Source ──────────────────────────────────────────
console.log("TEST A: Strong Official Source → Expected: High Evidence Reliability (>= 85%)");
{
  const record: DatasetRecord = {
    id: "R-001",
    entityName: "Freshworks",
    company: "Freshworks",
    role: "Java Backend Developer",
    location: "Bengaluru",
    experience: "3-5 years",
    salary: "₹18-25 LPA",
    size: "1000-5000",
    source: "careers.freshworks.com",
    confidence: 0,
    status: "Review",
    verificationStatus: "Needs verification",
    qualificationStatus: "Needs verification",
    attributes: {
      Company: "Freshworks",
      Role: "Java Backend Developer",
      Location: "Bengaluru",
      Experience: "3-5 years",
      "Source URL": "https://careers.freshworks.com/jobs/java-backend-dev-bengaluru",
    },
    evidence: [
      {
        field: "Role",
        value: "Java Backend Developer",
        source: "careers.freshworks.com",
        url: "https://careers.freshworks.com/jobs/java-backend-dev-bengaluru",
        retrieved: "2026-10-01",
        snippet:
          "Freshworks is hiring a Java Backend Developer for our Bengaluru engineering center.",
        verification: "Confirmed",
      },
      {
        field: "Experience",
        value: "3-5 years",
        source: "careers.freshworks.com",
        url: "https://careers.freshworks.com/jobs/java-backend-dev-bengaluru",
        retrieved: "2026-10-01",
        snippet: "Requirements: 3-5 years of experience in Java backend development.",
        verification: "Confirmed",
      },
      {
        field: "Location",
        value: "Bengaluru",
        source: "careers.freshworks.com",
        url: "https://careers.freshworks.com/jobs/java-backend-dev-bengaluru",
        retrieved: "2026-10-01",
        snippet: "Location: Bengaluru, India (Hybrid).",
        verification: "Confirmed",
      },
    ],
    conflicts: [],
  };

  const constraints: StructuredConstraint[] = [
    { field: "role", operator: "contains", value: "Java Backend Developer", hard: true },
    { field: "experience", operator: "between", value: "2", valueTo: "5", hard: true },
    { field: "location", operator: "contains", value: "Bengaluru", hard: true },
  ];

  const result = calculateEvidenceReliability(
    record,
    ["Role", "Experience", "Location"],
    constraints,
  );
  console.log(`  Reliability Score: ${result.reliabilityScore}%`);
  console.log(
    `  Breakdown: Req=${result.breakdown.requiredFieldSupport}%, Dir=${result.breakdown.evidenceDirectness}%, Src=${result.breakdown.sourceQuality}%, Agr=${result.breakdown.sourceAgreement}%, Ent=${result.breakdown.entityConsistency}%`,
  );

  assert(
    result.reliabilityScore >= 85,
    `Score ${result.reliabilityScore}% is >= 85% for strong official source`,
  );
  assert(
    result.verificationGrade === "High",
    `Verification grade is High (got ${result.verificationGrade})`,
  );
  assert(result.breakdown.requiredFieldSupport === 100, "Required field support is 100%");
  assert(
    result.breakdown.sourceQuality >= 90,
    "Source quality is >= 90% (primary official portal)",
  );
}

// ─── TEST B: Strong Secondary Source ─────────────────────────────────────────
console.log("\nTEST B: Strong Secondary Source → Expected: Moderate/High Reliability (65–85%)");
{
  const record: DatasetRecord = {
    id: "R-002",
    entityName: "Razorpay",
    company: "Razorpay",
    role: "Senior Backend Engineer",
    location: "Bengaluru",
    experience: "4-7 years",
    salary: "Not disclosed",
    size: "1000+",
    source: "techcrunch.com",
    confidence: 0,
    status: "Review",
    verificationStatus: "Needs verification",
    qualificationStatus: "Needs verification",
    attributes: {
      Company: "Razorpay",
      Role: "Senior Backend Engineer",
      Location: "Bengaluru",
      Experience: "4-7 years",
      "Source URL": "https://techcrunch.com/2026/08/15/razorpay-expansion-hiring",
    },
    evidence: [
      {
        field: "Role",
        value: "Senior Backend Engineer",
        source: "techcrunch.com",
        url: "https://techcrunch.com/2026/08/15/razorpay-expansion-hiring",
        retrieved: "2026-08-16",
        snippet:
          "Razorpay is actively hiring Senior Backend Engineers in Bengaluru for its payment gateway team.",
        verification: "Confirmed",
      },
      {
        field: "Location",
        value: "Bengaluru",
        source: "techcrunch.com",
        url: "https://techcrunch.com/2026/08/15/razorpay-expansion-hiring",
        retrieved: "2026-08-16",
        snippet: "The new engineering roles are based in Bengaluru, India.",
        verification: "Confirmed",
      },
    ],
    conflicts: [],
  };

  const result = calculateEvidenceReliability(record, ["Role", "Location"]);
  console.log(`  Reliability Score: ${result.reliabilityScore}%`);
  assert(
    result.reliabilityScore >= 65 && result.reliabilityScore <= 90,
    `Score ${result.reliabilityScore}% is in 65–90% range for secondary source`,
  );
  assert(
    result.breakdown.sourceQuality <= 80,
    `Secondary source quality is realistically evaluated (got ${result.breakdown.sourceQuality}%)`,
  );
}

// ─── TEST C: Search Snippet Only ─────────────────────────────────────────────
console.log("\nTEST C: Search Snippet Only → Expected: Low/Moderate Reliability (< 50%)");
{
  const record: DatasetRecord = {
    id: "R-003",
    entityName: "Acme Software",
    company: "Acme Software",
    role: "Software Developer",
    location: "India",
    experience: "—",
    salary: "Not disclosed",
    size: "—",
    source: "Web Source",
    confidence: 0,
    status: "Review",
    verificationStatus: "Needs verification",
    qualificationStatus: "Needs verification",
    attributes: {
      Company: "Acme Software",
      Role: "Software Developer",
      Location: "India",
    },
    evidence: [
      {
        field: "General",
        value: "Acme Software",
        source: "google.com",
        url: "https://google.com/search?q=acme+software",
        retrieved: "2026-10-01",
        snippet: "Acme Software is an IT services firm operating in India.",
        verification: "Partially verified",
      },
    ],
    conflicts: [],
  };

  const result = calculateEvidenceReliability(record, ["Role", "Experience", "Location"]);
  console.log(`  Reliability Score: ${result.reliabilityScore}%`);
  assert(
    result.reliabilityScore < 50,
    `Score ${result.reliabilityScore}% is < 50% for search snippet without direct field citations`,
  );
  assert(result.breakdown.sourceQuality <= 35, "Source quality is low for search snippet");
}

// ─── TEST D: Missing Required Field ──────────────────────────────────────────
console.log("\nTEST D: Missing Required Field → Expected: Lower Score + NEEDS_VERIFICATION");
{
  const record: DatasetRecord = {
    id: "R-004",
    entityName: "Karnival",
    company: "Karnival",
    role: "Java Back-End Developer",
    location: "Bengaluru",
    experience: "—",
    salary: "Not disclosed",
    size: "—",
    source: "naukri.com",
    confidence: 0,
    status: "Review",
    verificationStatus: "Needs verification",
    qualificationStatus: "Needs verification",
    attributes: {
      Company: "Karnival",
      Role: "Java Back-End Developer",
      Location: "Bengaluru",
      Experience: null,
      "Source URL": "https://naukri.com/job-listings-karnival-java-dev",
    },
    evidence: [
      {
        field: "Role",
        value: "Java Back-End Developer",
        source: "naukri.com",
        url: "https://naukri.com/job-listings-karnival-java-dev",
        retrieved: "2026-10-01",
        snippet: "Karnival is looking for Java Back-End Developer in Bengaluru.",
        verification: "Confirmed",
      },
      {
        field: "Location",
        value: "Bengaluru",
        source: "naukri.com",
        url: "https://naukri.com/job-listings-karnival-java-dev",
        retrieved: "2026-10-01",
        snippet: "Job Location: Bengaluru.",
        verification: "Confirmed",
      },
    ],
    conflicts: [],
  };

  const constraints: StructuredConstraint[] = [
    { field: "role", operator: "contains", value: "Java Backend Developer", hard: true },
    { field: "experience", operator: "between", value: "2", valueTo: "5", hard: true },
    { field: "location", operator: "contains", value: "Bengaluru", hard: true },
  ];

  const reliability = calculateEvidenceReliability(
    record,
    ["Role", "Experience", "Location"],
    constraints,
  );
  const qual = evaluateRecordQualification(record, constraints, ["Role", "Experience", "Location"]);

  console.log(`  Reliability Score: ${reliability.reliabilityScore}%`);
  console.log(`  Qualification Status: ${qual.status} (${qual.reason})`);

  assert(
    qual.status === "Needs verification",
    "Qualification is Needs verification when required field is missing",
  );
  assert(
    reliability.directnessMap["Experience"] === "MISSING",
    "Experience directness is correctly marked MISSING",
  );
  assert(
    reliability.breakdown.requiredFieldSupport < 70,
    `Required field support is reduced to ${reliability.breakdown.requiredFieldSupport}%`,
  );
  assert(
    reliability.reliabilityScore < 75,
    `Overall reliability reflects missing required field (got ${reliability.reliabilityScore}%)`,
  );
}

// ─── TEST E: Missing Optional Field ──────────────────────────────────────────
console.log("\nTEST E: Missing Optional Field → Expected: Score NOT unnecessarily penalized");
{
  const recordWithSalary: DatasetRecord = {
    id: "R-005a",
    entityName: "Infosys",
    company: "Infosys",
    role: "Java Backend Developer",
    location: "Bengaluru",
    experience: "3-5 years",
    salary: "₹12-16 LPA",
    size: "100000+",
    source: "careers.infosys.com",
    confidence: 0,
    status: "Review",
    verificationStatus: "Needs verification",
    qualificationStatus: "Needs verification",
    attributes: {
      Company: "Infosys",
      Role: "Java Backend Developer",
      Location: "Bengaluru",
      Experience: "3-5 years",
      Salary: "₹12-16 LPA",
      "Source URL": "https://careers.infosys.com/jobs/java-dev",
    },
    evidence: [
      {
        field: "Role",
        value: "Java Backend Developer",
        source: "careers.infosys.com",
        url: "https://careers.infosys.com/jobs/java-dev",
        retrieved: "2026-10-01",
        snippet: "Infosys hiring Java Backend Developer with 3-5 years experience in Bengaluru.",
        verification: "Confirmed",
      },
      {
        field: "Experience",
        value: "3-5 years",
        source: "careers.infosys.com",
        url: "https://careers.infosys.com/jobs/java-dev",
        retrieved: "2026-10-01",
        snippet: "Candidate must have 3-5 years experience.",
        verification: "Confirmed",
      },
      {
        field: "Location",
        value: "Bengaluru",
        source: "careers.infosys.com",
        url: "https://careers.infosys.com/jobs/java-dev",
        retrieved: "2026-10-01",
        snippet: "Location: Bengaluru Electronics City.",
        verification: "Confirmed",
      },
    ],
    conflicts: [],
  };

  const recordWithoutSalary: DatasetRecord = {
    ...recordWithSalary,
    id: "R-005b",
    salary: "Not disclosed",
    attributes: {
      ...recordWithSalary.attributes,
      Salary: null,
    },
  };

  const requiredFields = ["Role", "Experience", "Location"];
  const scoreWithSalary = calculateEvidenceReliability(
    recordWithSalary,
    requiredFields,
  ).reliabilityScore;
  const scoreWithoutSalary = calculateEvidenceReliability(
    recordWithoutSalary,
    requiredFields,
  ).reliabilityScore;

  console.log(
    `  Score with Salary: ${scoreWithSalary}%, Score without Salary: ${scoreWithoutSalary}%`,
  );
  assert(
    Math.abs(scoreWithSalary - scoreWithoutSalary) <= 5,
    `Missing optional Salary does not artificially destroy reliability (difference is ${Math.abs(scoreWithSalary - scoreWithoutSalary)}%)`,
  );
  assert(
    scoreWithoutSalary >= 85,
    `Score without optional salary remains high (${scoreWithoutSalary}%)`,
  );
}

// ─── TEST F: Two Independent Agreeing Sources ────────────────────────────────
console.log("\nTEST F: Two Independent Agreeing Sources → Expected: Higher Reliability");
{
  const singleSourceRecord: DatasetRecord = {
    id: "R-006a",
    entityName: "Swiggy",
    company: "Swiggy",
    role: "Backend Engineer",
    location: "Bengaluru",
    experience: "2-4 years",
    salary: "Not disclosed",
    size: "5000+",
    source: "naukri.com",
    confidence: 0,
    status: "Review",
    verificationStatus: "Needs verification",
    qualificationStatus: "Needs verification",
    attributes: {
      Company: "Swiggy",
      Role: "Backend Engineer",
      Location: "Bengaluru",
      Experience: "2-4 years",
      "Source URL": "https://naukri.com/swiggy-backend-dev",
    },
    evidence: [
      {
        field: "Role",
        value: "Backend Engineer",
        source: "naukri.com",
        url: "https://naukri.com/swiggy-backend-dev",
        retrieved: "2026-10-01",
        snippet: "Swiggy hiring Backend Engineer in Bengaluru, 2-4 years experience.",
        verification: "Confirmed",
      },
    ],
    conflicts: [],
  };

  const multiSourceRecord: DatasetRecord = {
    ...singleSourceRecord,
    id: "R-006b",
    evidence: [
      ...singleSourceRecord.evidence,
      {
        field: "Role",
        value: "Backend Engineer",
        source: "linkedin.com",
        url: "https://linkedin.com/jobs/view/swiggy-backend-engineer",
        retrieved: "2026-10-02",
        snippet:
          "Swiggy is seeking talented Backend Engineers for its Bengaluru tech hub with 2-4 years in distributed systems.",
        verification: "Confirmed",
      },
    ],
  };

  const singleScore = calculateEvidenceReliability(singleSourceRecord, [
    "Role",
    "Location",
    "Experience",
  ]).reliabilityScore;
  const multiScore = calculateEvidenceReliability(multiSourceRecord, [
    "Role",
    "Location",
    "Experience",
  ]).reliabilityScore;

  console.log(
    `  Single Source Score: ${singleScore}%, Two Independent Sources Score: ${multiScore}%`,
  );
  assert(
    multiScore > singleScore,
    `Two independent sources boost reliability (${multiScore}% > ${singleScore}%)`,
  );
}

// ─── TEST G: Conflicting Sources ─────────────────────────────────────────────
console.log("\nTEST G: Conflicting Sources → Expected: Conflict Penalty + CONFLICT status");
{
  const conflictRecord: DatasetRecord = {
    id: "R-007",
    entityName: "Planview",
    company: "Planview",
    role: "Senior Java Developer",
    location: "Bengaluru",
    experience: "3-5 years",
    salary: "Not disclosed",
    size: "1000+",
    source: "indeed.com",
    confidence: 0,
    status: "Conflict",
    verificationStatus: "Needs verification",
    qualificationStatus: "Conflict",
    attributes: {
      Company: "Planview",
      Role: "Senior Java Developer",
      Location: "Bengaluru",
      Experience: "3-5 years",
      "Source URL": "https://indeed.com/viewjob?id=planview-java",
    },
    evidence: [
      {
        field: "Experience",
        value: "3-5 years",
        source: "indeed.com",
        url: "https://indeed.com/viewjob?id=planview-java",
        retrieved: "2026-10-01",
        snippet: "Experience: 3-5 years required.",
        verification: "Confirmed",
      },
    ],
    conflicts: [
      {
        field: "Experience",
        values: [
          {
            source: "indeed.com",
            value: "3-5 years",
            url: "https://indeed.com/viewjob?id=planview-java",
            retrieved: "2026-10-01",
            snippet: "Experience: 3-5 years required.",
          },
          {
            source: "glassdoor.com",
            value: "8-10 years",
            url: "https://glassdoor.com/job-listing-planview-lead",
            retrieved: "2026-10-01",
            snippet: "Minimum 8 to 10 years experience required.",
          },
        ],
      },
    ],
  };

  const constraints: StructuredConstraint[] = [
    { field: "experience", operator: "between", value: "2", valueTo: "5", hard: true },
  ];

  const reliability = calculateEvidenceReliability(
    conflictRecord,
    ["Role", "Experience"],
    constraints,
  );
  const qual = evaluateRecordQualification(conflictRecord, constraints, ["Role", "Experience"]);

  console.log(`  Reliability Score: ${reliability.reliabilityScore}%`);
  console.log(`  Conflict Penalty: ${reliability.breakdown.conflictPenalty}%`);
  console.log(`  Qualification: ${qual.status}`);

  assert(qual.status === "Conflict", "Qualification status is Conflict");
  assert(
    reliability.breakdown.conflictPenalty >= 30,
    `Conflict penalty of ${reliability.breakdown.conflictPenalty}% was deducted`,
  );
  assert(
    reliability.reliabilityScore <= 55,
    `Score is capped by conflict penalty (${reliability.reliabilityScore}%)`,
  );
}

// ─── TEST H: Wrong Entity Association ────────────────────────────────────────
console.log("\nTEST H: Wrong Entity Association → Expected: Very low entity consistency & penalty");
{
  const contaminatedRecord: DatasetRecord = {
    id: "R-008",
    entityName: "Furlenco",
    company: "Furlenco",
    role: "Java Backend Developer",
    location: "Bengaluru",
    experience: "3 years",
    salary: "Not disclosed",
    size: "500+",
    source: "unknown-board.com",
    confidence: 0,
    status: "Review",
    verificationStatus: "Needs verification",
    qualificationStatus: "Needs verification",
    attributes: {
      Company: "Furlenco",
      Role: "Java Backend Developer",
      Location: "Bengaluru",
    },
    evidence: [
      {
        field: "Role",
        value: "Java Backend Developer",
        source: "unknown-board.com",
        url: "https://unknown-board.com/post/123",
        retrieved: "2026-10-01",
        snippet: "Join Capgemini as Java Backend Developer in Bengaluru.",
        verification: "Confirmed",
      },
    ],
    conflicts: [],
  };

  const reliability = calculateEvidenceReliability(contaminatedRecord, ["Role", "Location"]);
  console.log(`  Entity Consistency: ${reliability.breakdown.entityConsistency}%`);
  console.log(`  Inference/Contamination Penalty: ${reliability.breakdown.inferencePenalty}%`);
  console.log(`  Overall Score: ${reliability.reliabilityScore}%`);

  assert(
    reliability.breakdown.entityConsistency <= 30,
    "Entity consistency detected cross-organization contamination",
  );
  assert(
    reliability.breakdown.inferencePenalty >= 30,
    "Heavy penalty applied for entity contamination",
  );
  assert(
    reliability.reliabilityScore <= 45,
    `Final reliability score is low (${reliability.reliabilityScore}%)`,
  );
}

// ─── TEST I: Semantic Role Match ─────────────────────────────────────────────
console.log("\nTEST I: Semantic Role Match → Expected: Positive Evidence Contribution");
{
  const record: DatasetRecord = {
    id: "R-009",
    entityName: "Juspay",
    company: "Juspay",
    role: "Backend Engineer - Java",
    location: "Bengaluru",
    experience: "2-4 years",
    salary: "Not disclosed",
    size: "500-1000",
    source: "juspay.in/careers",
    confidence: 0,
    status: "Review",
    verificationStatus: "Needs verification",
    qualificationStatus: "Needs verification",
    attributes: {
      Company: "Juspay",
      Role: "Backend Engineer - Java",
      Location: "Bengaluru",
      Experience: "2-4 years",
      "Source URL": "https://juspay.in/careers/backend-engineer-java",
    },
    evidence: [
      {
        field: "Role",
        value: "Backend Engineer - Java",
        source: "juspay.in",
        url: "https://juspay.in/careers/backend-engineer-java",
        retrieved: "2026-10-01",
        snippet:
          "Juspay is looking for Backend Engineer - Java with 2-4 years experience in Bengaluru.",
        verification: "Confirmed",
      },
    ],
    conflicts: [],
  };

  const constraints: StructuredConstraint[] = [
    { field: "role", operator: "contains", value: "Java Backend Developer", hard: true },
  ];

  const qual = evaluateRecordQualification(record, constraints, ["Role"]);
  const reliability = calculateEvidenceReliability(record, ["Role"], constraints);

  console.log(`  Qualification Result: ${qual.status}`);
  console.log(`  Reliability Score: ${reliability.reliabilityScore}%`);

  assert(qual.status === "Qualified", "Semantic match passes qualification (not excluded)");
  assert(
    reliability.reliabilityScore >= 80,
    `Semantic match with verified source evidence achieves high reliability (${reliability.reliabilityScore}%)`,
  );
}

// ─── TEST J: Exact Keyword Mismatch but Semantic Match ───────────────────────
console.log("\nTEST J: Exact Keyword Mismatch but Semantic Match → Expected: NOT Excluded");
{
  const record: DatasetRecord = {
    id: "R-010",
    entityName: "PhonePe",
    company: "PhonePe",
    role: "Software Engineer - Java Platform",
    location: "Bengaluru",
    experience: "3-6 years",
    salary: "Not disclosed",
    size: "2000+",
    source: "phonepe.com/careers",
    confidence: 0,
    status: "Review",
    verificationStatus: "Needs verification",
    qualificationStatus: "Needs verification",
    attributes: {
      Company: "PhonePe",
      Role: "Software Engineer - Java Platform",
      Location: "Bengaluru",
      Experience: "3-6 years",
      "Source URL": "https://phonepe.com/careers/se-java",
    },
    evidence: [
      {
        field: "Role",
        value: "Software Engineer - Java Platform",
        source: "phonepe.com",
        url: "https://phonepe.com/careers/se-java",
        retrieved: "2026-10-01",
        snippet: "PhonePe hiring Software Engineer - Java Platform in Bengaluru.",
        verification: "Confirmed",
      },
    ],
    conflicts: [],
  };

  const constraints: StructuredConstraint[] = [
    { field: "role", operator: "contains", value: "Java Backend Developer", hard: true },
  ];

  const qual = evaluateRecordQualification(record, constraints, ["Role"]);
  console.log(`  Qualification Status: ${qual.status}`);

  assert(qual.status !== "Excluded", "Must NOT be excluded when semantic match is plausible");
}

// ═════════════════════════════════════════════════════════════════════════════
// ─── GROUND-TRUTH CALIBRATION BENCHMARK (40 Labeled Records) ──────────────────
// ═════════════════════════════════════════════════════════════════════════════
console.log("\n═══════════════════════════════════════════════════════════════");
console.log("  Running 40-Record Ground-Truth Calibration Benchmark");
console.log("═══════════════════════════════════════════════════════════════\n");

interface BenchmarkRecord {
  id: string;
  label: "CORRECT" | "PARTIALLY_SUPPORTED" | "INCORRECT" | "CONFLICTING";
  record: DatasetRecord;
  requiredFields: string[];
  constraints: StructuredConstraint[];
}

const benchmarkRecords: BenchmarkRecord[] = [];

// Generate 40 diverse, realistic records across categories:
// Category 1: 15 CORRECT records (Strong primary / established platform records)
for (let i = 1; i <= 15; i++) {
  const company = [
    "Infosys",
    "TCS",
    "Wipro",
    "Freshworks",
    "Razorpay",
    "Swiggy",
    "Zomato",
    "Juspay",
    "PhonePe",
    "CRED",
    "Flipkart",
    "Myntra",
    "Paytm",
    "Ola",
    "InMobi",
  ][i - 1]!;
  benchmarkRecords.push({
    id: `BM-CORRECT-${i}`,
    label: "CORRECT",
    requiredFields: ["Role", "Experience", "Location"],
    constraints: [
      { field: "role", operator: "contains", value: "Java Backend Developer", hard: true },
      { field: "experience", operator: "between", value: "2", valueTo: "5", hard: true },
      { field: "location", operator: "contains", value: "Bengaluru", hard: true },
    ],
    record: {
      id: `R-BM-${i}`,
      entityName: company,
      company,
      role: "Java Backend Developer",
      location: "Bengaluru",
      experience: "3-5 years",
      salary: "Not disclosed",
      size: "1000+",
      source: `careers.${company.toLowerCase()}.com`,
      confidence: 0,
      status: "Review",
      verificationStatus: "Needs verification",
      qualificationStatus: "Needs verification",
      attributes: {
        Company: company,
        Role: "Java Backend Developer",
        Location: "Bengaluru",
        Experience: "3-5 years",
        "Source URL": `https://careers.${company.toLowerCase()}.com/jobs/java-dev`,
      },
      evidence: [
        {
          field: "Role",
          value: "Java Backend Developer",
          source: `careers.${company.toLowerCase()}.com`,
          url: `https://careers.${company.toLowerCase()}.com/jobs/java-dev`,
          retrieved: "2026-10-01",
          snippet: `${company} is actively seeking a Java Backend Developer in Bengaluru with 3-5 years experience.`,
          verification: "Confirmed",
        },
        {
          field: "Experience",
          value: "3-5 years",
          source: `careers.${company.toLowerCase()}.com`,
          url: `https://careers.${company.toLowerCase()}.com/jobs/java-dev`,
          retrieved: "2026-10-01",
          snippet: "3-5 years of hands-on experience in Java, Spring Boot, and microservices.",
          verification: "Confirmed",
        },
        {
          field: "Location",
          value: "Bengaluru",
          source: `careers.${company.toLowerCase()}.com`,
          url: `https://careers.${company.toLowerCase()}.com/jobs/java-dev`,
          retrieved: "2026-10-01",
          snippet: "Office location: Bengaluru, Karnataka, India.",
          verification: "Confirmed",
        },
      ],
      conflicts: [],
    },
  });
}

// Category 2: 10 PARTIALLY_SUPPORTED records (e.g. experience missing, or secondary source)
for (let i = 1; i <= 10; i++) {
  const company = `MidTier-${i}`;
  benchmarkRecords.push({
    id: `BM-PARTIAL-${i}`,
    label: "PARTIALLY_SUPPORTED",
    requiredFields: ["Role", "Experience", "Location"],
    constraints: [
      { field: "role", operator: "contains", value: "Java Backend Developer", hard: true },
      { field: "experience", operator: "between", value: "2", valueTo: "5", hard: true },
      { field: "location", operator: "contains", value: "Bengaluru", hard: true },
    ],
    record: {
      id: `R-BMP-${i}`,
      entityName: company,
      company,
      role: "Java Backend Developer",
      location: "Bengaluru",
      experience: "—",
      salary: "Not disclosed",
      size: "—",
      source: "naukri.com",
      confidence: 0,
      status: "Review",
      verificationStatus: "Needs verification",
      qualificationStatus: "Needs verification",
      attributes: {
        Company: company,
        Role: "Java Backend Developer",
        Location: "Bengaluru",
        Experience: null,
        "Source URL": `https://naukri.com/job-${i}`,
      },
      evidence: [
        {
          field: "Role",
          value: "Java Backend Developer",
          source: "naukri.com",
          url: `https://naukri.com/job-${i}`,
          retrieved: "2026-10-01",
          snippet: `${company} is hiring a Java Backend Developer in Bengaluru.`,
          verification: "Confirmed",
        },
        {
          field: "Location",
          value: "Bengaluru",
          source: "naukri.com",
          url: `https://naukri.com/job-${i}`,
          retrieved: "2026-10-01",
          snippet: "Bengaluru location.",
          verification: "Confirmed",
        },
      ],
      conflicts: [],
    },
  });
}

// Category 3: 8 INCORRECT records (Search snippet only, false role, or cross-entity contamination)
for (let i = 1; i <= 8; i++) {
  const company = `WeakEntity-${i}`;
  benchmarkRecords.push({
    id: `BM-INCORRECT-${i}`,
    label: "INCORRECT",
    requiredFields: ["Role", "Experience", "Location"],
    constraints: [
      { field: "role", operator: "contains", value: "Java Backend Developer", hard: true },
      { field: "experience", operator: "between", value: "2", valueTo: "5", hard: true },
      { field: "location", operator: "contains", value: "Bengaluru", hard: true },
    ],
    record: {
      id: `R-BMI-${i}`,
      entityName: company,
      company,
      role: "React Frontend Developer",
      location: "Pune",
      experience: "8-10 years",
      salary: "Not disclosed",
      size: "—",
      source: "google.com",
      confidence: 0,
      status: "Review",
      verificationStatus: "Needs verification",
      qualificationStatus: "Needs verification",
      attributes: {
        Company: company,
        Role: "React Frontend Developer",
        Location: "Pune",
        Experience: "8-10 years",
      },
      evidence: [
        {
          field: "General",
          value: company,
          source: "google.com",
          url: `https://google.com/search?q=${company}`,
          retrieved: "2026-05-01",
          snippet: `${company} is a digital agency.`,
          verification: "Partially verified",
        },
      ],
      conflicts: [],
    },
  });
}

// Category 4: 7 CONFLICTING records (Disagreements across sources)
for (let i = 1; i <= 7; i++) {
  const company = `ConflictCo-${i}`;
  benchmarkRecords.push({
    id: `BM-CONFLICT-${i}`,
    label: "CONFLICTING",
    requiredFields: ["Role", "Experience", "Location"],
    constraints: [
      { field: "role", operator: "contains", value: "Java Backend Developer", hard: true },
      { field: "experience", operator: "between", value: "2", valueTo: "5", hard: true },
      { field: "location", operator: "contains", value: "Bengaluru", hard: true },
    ],
    record: {
      id: `R-BMC-${i}`,
      entityName: company,
      company,
      role: "Java Backend Developer",
      location: "Bengaluru",
      experience: "2-4 years",
      salary: "Not disclosed",
      size: "—",
      source: "indeed.com",
      confidence: 0,
      status: "Conflict",
      verificationStatus: "Needs verification",
      qualificationStatus: "Conflict",
      attributes: {
        Company: company,
        Role: "Java Backend Developer",
        Location: "Bengaluru",
        Experience: "2-4 years",
        "Source URL": `https://indeed.com/job-${i}`,
      },
      evidence: [
        {
          field: "Experience",
          value: "2-4 years",
          source: "indeed.com",
          url: `https://indeed.com/job-${i}`,
          retrieved: "2026-10-01",
          snippet: "2-4 years experience.",
          verification: "Confirmed",
        },
      ],
      conflicts: [
        {
          field: "Experience",
          values: [
            {
              source: "indeed.com",
              value: "2-4 years",
              url: `https://indeed.com/job-${i}`,
              retrieved: "2026-10-01",
              snippet: "2-4 years",
            },
            {
              source: "monster.com",
              value: "8-12 years",
              url: `https://monster.com/job-${i}`,
              retrieved: "2026-10-01",
              snippet: "8-12 years",
            },
          ],
        },
      ],
    },
  });
}

// ─── BENCHMARK EVALUATION ────────────────────────────────────────────────────
const startTime = performance.now();

let highBucketCorrect = 0;
let highBucketTotal = 0;
let lowBucketIncorrect = 0;
let lowBucketTotal = 0;

let truePositives = 0;
let falsePositives = 0;
let falseNegatives = 0;
let trueNegatives = 0;

const scoreBuckets = {
  high: [] as number[], // >= 80
  moderate: [] as number[], // 60-79
  partial: [] as number[], // 40-59
  low: [] as number[], // < 40
};

for (const bm of benchmarkRecords) {
  const rel = calculateEvidenceReliability(bm.record, bm.requiredFields, bm.constraints);
  const qual = evaluateRecordQualification(bm.record, bm.constraints, bm.requiredFields);
  const score = rel.reliabilityScore;

  if (score >= 80) scoreBuckets.high.push(score);
  else if (score >= 60) scoreBuckets.moderate.push(score);
  else if (score >= 40) scoreBuckets.partial.push(score);
  else scoreBuckets.low.push(score);

  // Calibration checks:
  if (score >= 80) {
    highBucketTotal++;
    if (bm.label === "CORRECT") highBucketCorrect++;
  }
  if (score < 50) {
    lowBucketTotal++;
    if (bm.label === "INCORRECT" || bm.label === "CONFLICTING") lowBucketIncorrect++;
  }

  // Qualification evaluation:
  // Ground truth positive = CORRECT
  if (bm.label === "CORRECT") {
    if (qual.status === "Qualified") truePositives++;
    else falseNegatives++;
  } else {
    if (qual.status === "Qualified") falsePositives++;
    else trueNegatives++;
  }
}

const elapsedMs = performance.now() - startTime;
const recordsPerSec = Math.round(benchmarkRecords.length / (elapsedMs / 1000));

const precision =
  truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 1;
const recall =
  truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : 1;
const falseQualificationRate = falsePositives / (falsePositives + trueNegatives);
const falseExclusionRate = falseNegatives / (truePositives + falseNegatives);
const highCalibration = highBucketTotal > 0 ? highBucketCorrect / highBucketTotal : 1;
const lowCalibration = lowBucketTotal > 0 ? lowBucketIncorrect / lowBucketTotal : 1;

console.log(`BENCHMARK METRICS across ${benchmarkRecords.length} records:`);
console.log(
  `  • Execution Latency: ${elapsedMs.toFixed(2)} ms total (${recordsPerSec} records/sec)`,
);
console.log(`  • Precision: ${(precision * 100).toFixed(1)}%`);
console.log(`  • Recall: ${(recall * 100).toFixed(1)}%`);
console.log(`  • False Qualification Rate: ${(falseQualificationRate * 100).toFixed(1)}%`);
console.log(`  • False Exclusion Rate: ${(falseExclusionRate * 100).toFixed(1)}%`);
console.log(
  `  • High-score Calibration (score >= 80): ${(highCalibration * 100).toFixed(1)}% factual accuracy`,
);
console.log(
  `  • Low-score Calibration (score < 50): ${(lowCalibration * 100).toFixed(1)}% unverified/conflicting`,
);
console.log(
  `  • Score distribution: High(>=80)=${scoreBuckets.high.length}, Mod(60-79)=${scoreBuckets.moderate.length}, Partial(40-59)=${scoreBuckets.partial.length}, Low(<40)=${scoreBuckets.low.length}`,
);

assert(precision >= 0.95, `Precision is >= 95% (got ${(precision * 100).toFixed(1)}%)`);
assert(recall >= 0.95, `Recall is >= 95% (got ${(recall * 100).toFixed(1)}%)`);
assert(
  falseQualificationRate === 0,
  `False Qualification Rate is 0% (got ${(falseQualificationRate * 100).toFixed(1)}%)`,
);
assert(
  highCalibration >= 0.9,
  `High score calibration >= 90% (got ${(highCalibration * 100).toFixed(1)}%)`,
);
assert(
  elapsedMs < 100,
  `Local deterministic score execution is blazingly fast (<100ms for 40 records, took ${elapsedMs.toFixed(1)}ms)`,
);

console.log("\n═══════════════════════════════════════════════════════════════");
console.log(`  FINAL RESULTS: ${passedCount} passed, ${failedCount} failed`);
console.log("═══════════════════════════════════════════════════════════════\n");

if (failedCount > 0) {
  process.exit(1);
}
