/**
 * DataIntel — Role Matcher Test Suite
 * Covers all 17 required test cases from the specification.
 *
 * Run with: npx tsx src/server/__tests__/role-matcher.test.ts
 */

import {
  normalizeTitle,
  classifyRoleFamily,
  extractTechnologies,
  extractSeniority,
  parseRole,
  matchRole,
  compareRoles,
} from "../role-matcher";

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

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("  DataIntel Role Matcher — Comprehensive Test Suite");
console.log("═══════════════════════════════════════════════════════════════\n");

// ═══ NORMALIZATION TESTS ══════════════════════════════════════════════════
console.log("NORMALIZATION");
{
  assert(
    normalizeTitle("Backend Engineer - Java") === "backend engineer java",
    `"Backend Engineer - Java" → "${normalizeTitle("Backend Engineer - Java")}"`,
  );
  assert(
    normalizeTitle("Java Backend Developer") === "java backend developer",
    `"Java Backend Developer" → "${normalizeTitle("Java Backend Developer")}"`,
  );
  assert(
    normalizeTitle("Backend Developer (Java)") === "backend developer java",
    `"Backend Developer (Java)" → "${normalizeTitle("Backend Developer (Java)")}"`,
  );
  assert(
    normalizeTitle("  Senior  Java  Backend  Engineer  ") === "senior java backend engineer",
    "Collapses whitespace",
  );
  assert(
    normalizeTitle("Backend Engineer - Java, Spring Boot") === "backend engineer java spring boot",
    "Normalizes commas",
  );
}

// ═══ ROLE FAMILY CLASSIFICATION ═══════════════════════════════════════════
console.log("\nROLE FAMILY CLASSIFICATION");
{
  assert(
    classifyRoleFamily("backend engineer java") === "BACKEND",
    "backend engineer java → BACKEND",
  );
  assert(
    classifyRoleFamily("backend developer java") === "BACKEND",
    "backend developer java → BACKEND",
  );
  assert(
    classifyRoleFamily("server side engineer") === "BACKEND",
    "server-side engineer → BACKEND",
  );
  assert(
    classifyRoleFamily("java backend engineer") === "BACKEND",
    "java backend engineer → BACKEND",
  );
  assert(classifyRoleFamily("frontend engineer") === "FRONTEND", "frontend engineer → FRONTEND");
  assert(classifyRoleFamily("react developer") === "FRONTEND", "react developer → FRONTEND");
  assert(
    classifyRoleFamily("full stack developer") === "FULLSTACK",
    "full stack developer → FULLSTACK",
  );
  assert(classifyRoleFamily("android developer") === "MOBILE", "android developer → MOBILE");
  assert(classifyRoleFamily("devops engineer") === "DEVOPS", "devops engineer → DEVOPS");
  assert(classifyRoleFamily("data scientist") === "DATA_SCIENCE", "data scientist → DATA_SCIENCE");
  assert(classifyRoleFamily("qa engineer") === "QA_TESTING", "qa engineer → QA_TESTING");
  assert(
    classifyRoleFamily("qa automation engineer") === "QA_TESTING",
    "qa automation engineer → QA_TESTING",
  );
  // Critical: technology alone does NOT determine role family
  assert(
    classifyRoleFamily("java developer") === "UNKNOWN",
    `"java developer" → ${classifyRoleFamily("java developer")} (expected UNKNOWN — no role family keyword)`,
  );
  assert(
    classifyRoleFamily("software engineer") === "UNKNOWN",
    `"software engineer" → ${classifyRoleFamily("software engineer")} (expected UNKNOWN — generic title)`,
  );
}

// ═══ TECHNOLOGY EXTRACTION ═══════════════════════════════════════════════
console.log("\nTECHNOLOGY EXTRACTION");
{
  const t1 = extractTechnologies("backend engineer java");
  assert(t1.includes("java") && t1.length === 1, `"backend engineer java" → [${t1}]`);

  const t2 = extractTechnologies("backend engineer java spring boot");
  assert(
    t2.includes("java") && t2.includes("spring boot"),
    `"backend engineer java spring boot" → [${t2}]`,
  );

  const t3 = extractTechnologies("python backend developer");
  assert(t3.includes("python"), `"python backend developer" → [${t3}]`);

  const t4 = extractTechnologies("react frontend developer");
  assert(t4.includes("react"), `"react frontend developer" → [${t4}]`);

  const t5 = extractTechnologies("software engineer");
  assert(t5.length === 0, `"software engineer" → [] (no tech)`);
}

// ═══ SENIORITY EXTRACTION ════════════════════════════════════════════════
console.log("\nSENIORITY EXTRACTION");
{
  assert(extractSeniority("senior java backend engineer") === "SENIOR", "senior → SENIOR");
  assert(extractSeniority("java backend developer") === "UNKNOWN", "no seniority → UNKNOWN");
  assert(extractSeniority("backend engineering lead") === "LEAD", "lead → LEAD");
  assert(extractSeniority("java engineering manager") === "MANAGER", "manager → MANAGER");
  assert(extractSeniority("junior developer") === "JUNIOR", "junior → JUNIOR");
  assert(extractSeniority("principal engineer") === "PRINCIPAL", "principal → PRINCIPAL");
}

// ═══ FULL PARSING ════════════════════════════════════════════════════════
console.log("\nFULL PARSING");
{
  const p1 = parseRole("Backend Engineer - Java");
  assert(p1.roleFamily === "BACKEND", `roleFamily: ${p1.roleFamily}`);
  assert(p1.technologies.includes("java"), `technologies: [${p1.technologies}]`);
  assert(p1.seniority === "UNKNOWN", `seniority: ${p1.seniority}`);

  const p2 = parseRole("Senior Java Backend Engineer");
  assert(p2.roleFamily === "BACKEND", `roleFamily: ${p2.roleFamily}`);
  assert(p2.technologies.includes("java"), `technologies: [${p2.technologies}]`);
  assert(p2.seniority === "SENIOR", `seniority: ${p2.seniority}`);
}

// ═══ TEST 1: Backend Engineer - Java vs Java Backend Developer ═══════════
console.log(
  "\nTEST 1: Required='Java Backend Developer', Actual='Backend Engineer - Java' → MATCH",
);
{
  const result = matchRole("Java Backend Developer", "Backend Engineer - Java");
  assert(result.result === "MATCH", `Result: ${result.result} (expected MATCH) — ${result.reason}`);
}

// ═══ TEST 2: Java Backend Engineer ═══════════════════════════════════════
console.log("\nTEST 2: Required='Java Backend Developer', Actual='Java Backend Engineer' → MATCH");
{
  const result = matchRole("Java Backend Developer", "Java Backend Engineer");
  assert(result.result === "MATCH", `Result: ${result.result} (expected MATCH) — ${result.reason}`);
}

// ═══ TEST 3: Backend Developer (Java) ════════════════════════════════════
console.log(
  "\nTEST 3: Required='Java Backend Developer', Actual='Backend Developer (Java)' → MATCH",
);
{
  const result = matchRole("Java Backend Developer", "Backend Developer (Java)");
  assert(result.result === "MATCH", `Result: ${result.result} (expected MATCH) — ${result.reason}`);
}

// ═══ TEST 4: Senior Java Backend Engineer ════════════════════════════════
console.log(
  "\nTEST 4: Required='Java Backend Developer', Actual='Senior Java Backend Engineer' → MATCH",
);
{
  const result = matchRole("Java Backend Developer", "Senior Java Backend Engineer");
  assert(result.result === "MATCH", `Result: ${result.result} (expected MATCH) — ${result.reason}`);
}

// ═══ TEST 5: React Frontend Developer ════════════════════════════════════
console.log(
  "\nTEST 5: Required='Java Backend Developer', Actual='React Frontend Developer' → NO_MATCH",
);
{
  const result = matchRole("Java Backend Developer", "React Frontend Developer");
  assert(
    result.result === "NO_MATCH",
    `Result: ${result.result} (expected NO_MATCH) — ${result.reason}`,
  );
}

// ═══ TEST 6: Python Backend Developer ════════════════════════════════════
console.log(
  "\nTEST 6: Required='Java Backend Developer', Actual='Python Backend Developer' → NO_MATCH",
);
{
  const result = matchRole("Java Backend Developer", "Python Backend Developer");
  assert(
    result.result === "NO_MATCH",
    `Result: ${result.result} (expected NO_MATCH) — ${result.reason}`,
  );
}

// ═══ TEST 7: Java Software Engineer ══════════════════════════════════════
console.log(
  "\nTEST 7: Required='Java Backend Developer', Actual='Java Software Engineer' → MATCH or UNKNOWN (NEVER NO_MATCH)",
);
{
  const result = matchRole("Java Backend Developer", "Java Software Engineer");
  assert(
    result.result !== "NO_MATCH",
    `Result: ${result.result} (expected MATCH or UNKNOWN, NOT NO_MATCH) — ${result.reason}`,
  );
}

// ═══ TEST 8: Java Engineering Manager ════════════════════════════════════
console.log(
  "\nTEST 8: Required='Java Backend Developer', Actual='Java Engineering Manager' → UNKNOWN or NO_MATCH",
);
{
  const result = matchRole("Java Backend Developer", "Java Engineering Manager");
  // Manager is a different seniority category from developer-level — should be UNKNOWN or NO_MATCH
  assert(
    result.result === "UNKNOWN" || result.result === "NO_MATCH",
    `Result: ${result.result} — ${result.reason}`,
  );
}

// ═══ TEST 9: Java Android Developer ══════════════════════════════════════
console.log(
  "\nTEST 9: Required='Java Backend Developer', Actual='Java Android Developer' → NO_MATCH",
);
{
  const result = matchRole("Java Backend Developer", "Java Android Developer");
  assert(
    result.result === "NO_MATCH",
    `Result: ${result.result} (expected NO_MATCH) — ${result.reason}`,
  );
}

// ═══ TEST 10: Java QA Automation Engineer ════════════════════════════════
console.log(
  "\nTEST 10: Required='Java Backend Developer', Actual='Java QA Automation Engineer' → NO_MATCH",
);
{
  const result = matchRole("Java Backend Developer", "Java QA Automation Engineer");
  assert(
    result.result === "NO_MATCH",
    `Result: ${result.result} (expected NO_MATCH) — ${result.reason}`,
  );
}

// ═══ TEST 11: Backend Developer vs Backend Engineer ══════════════════════
console.log("\nTEST 11: Required='Backend Developer', Actual='Backend Engineer' → MATCH");
{
  const result = matchRole("Backend Developer", "Backend Engineer");
  assert(result.result === "MATCH", `Result: ${result.result} (expected MATCH) — ${result.reason}`);
}

// ═══ TEST 12: Backend Engineer vs Backend Developer ══════════════════════
console.log("\nTEST 12: Required='Backend Engineer', Actual='Backend Developer' → MATCH");
{
  const result = matchRole("Backend Engineer", "Backend Developer");
  assert(result.result === "MATCH", `Result: ${result.result} (expected MATCH) — ${result.reason}`);
}

// ═══ ADDITIONAL: Full Stack Developer - Java ═════════════════════════════
console.log(
  "\nADDITIONAL: Required='Java Backend Developer', Actual='Full Stack Developer - Java' → UNKNOWN",
);
{
  const result = matchRole("Java Backend Developer", "Full Stack Developer - Java");
  assert(
    result.result === "UNKNOWN" || result.result === "MATCH",
    `Result: ${result.result} — ${result.reason}`,
  );
}

// ═══ ADDITIONAL: Java Developer - Backend ════════════════════════════════
console.log(
  "\nADDITIONAL: Required='Java Backend Developer', Actual='Java Developer - Backend' → MATCH",
);
{
  const result = matchRole("Java Backend Developer", "Java Developer - Backend");
  assert(result.result === "MATCH", `Result: ${result.result} (expected MATCH) — ${result.reason}`);
}

// ═══ ADDITIONAL: Software Engineer - Java Backend ════════════════════════
console.log(
  "\nADDITIONAL: Required='Java Backend Developer', Actual='Software Engineer - Java Backend' → MATCH",
);
{
  const result = matchRole("Java Backend Developer", "Software Engineer - Java Backend");
  assert(result.result === "MATCH", `Result: ${result.result} (expected MATCH) — ${result.reason}`);
}

// ═══ ADDITIONAL: Data Scientist vs Java Backend ══════════════════════════
console.log("\nADDITIONAL: Required='Java Backend Developer', Actual='Data Scientist' → NO_MATCH");
{
  const result = matchRole("Java Backend Developer", "Data Scientist");
  assert(
    result.result === "NO_MATCH",
    `Result: ${result.result} (expected NO_MATCH) — ${result.reason}`,
  );
}

// ═══ ADDITIONAL: UI/UX Designer vs Java Backend ══════════════════════════
console.log("\nADDITIONAL: Required='Java Backend Developer', Actual='UI/UX Designer' → NO_MATCH");
{
  const result = matchRole("Java Backend Developer", "UI/UX Designer");
  assert(
    result.result === "NO_MATCH",
    `Result: ${result.result} (expected NO_MATCH) — ${result.reason}`,
  );
}

// ═══ ADDITIONAL: DevOps Engineer vs Java Backend ═════════════════════════
console.log("\nADDITIONAL: Required='Java Backend Developer', Actual='DevOps Engineer' → NO_MATCH");
{
  const result = matchRole("Java Backend Developer", "DevOps Engineer");
  assert(
    result.result === "NO_MATCH",
    `Result: ${result.result} (expected NO_MATCH) — ${result.reason}`,
  );
}

// ═══ ADDITIONAL: Backend Software Engineer (Java) ════════════════════════
console.log(
  "\nADDITIONAL: Required='Java Backend Developer', Actual='Backend Software Engineer (Java)' → MATCH",
);
{
  const result = matchRole("Java Backend Developer", "Backend Software Engineer (Java)");
  assert(result.result === "MATCH", `Result: ${result.result} (expected MATCH) — ${result.reason}`);
}

// ═══ REGRESSION TEST: The exact bug ══════════════════════════════════════
console.log("\n═══ REGRESSION TEST (Step 17): The exact current bug ═══");
console.log("Required: 'Java backend developer', Actual: 'Backend Engineer - Java'");
console.log("OLD result: EXCLUDED ('does not satisfy contains')");
{
  const result = matchRole("Java backend developer", "Backend Engineer - Java");
  assert(
    result.result === "MATCH",
    `NEW result: ${result.result} (expected MATCH) — ${result.reason}`,
  );
  assert(
    !result.reason.includes("does not satisfy"),
    "Reason no longer says 'does not satisfy contains'",
  );
  assert(!result.reason.includes("DOES_NOT_MATCH"), "Reason no longer says 'DOES_NOT_MATCH'");
}

// ═══ ROLE FAMILY ≠ TECHNOLOGY ════════════════════════════════════════════
console.log("\nSTEP 10: Java alone does NOT determine role family");
{
  const p1 = parseRole("Java Backend Engineer");
  assert(p1.roleFamily === "BACKEND", `Java Backend Engineer → ${p1.roleFamily}`);

  const p2 = parseRole("Java Android Developer");
  assert(p2.roleFamily === "MOBILE", `Java Android Developer → ${p2.roleFamily}`);

  const p3 = parseRole("Java QA Automation Engineer");
  assert(p3.roleFamily === "QA_TESTING", `Java QA Automation Engineer → ${p3.roleFamily}`);

  const p4 = parseRole("Java Data Engineer");
  assert(p4.roleFamily === "DATA_ENGINEERING", `Java Data Engineer → ${p4.roleFamily}`);

  const p5 = parseRole("Java Developer");
  assert(
    p5.roleFamily === "UNKNOWN",
    `Java Developer → ${p5.roleFamily} (no role family keyword, just tech)`,
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════════════════════════");
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log("═══════════════════════════════════════════════════════════════\n");
process.exit(failed > 0 ? 1 : 0);
