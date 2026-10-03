/**
 * DATAINTEL — Unified Automated Test Runner
 * Executes all unit, integration, negative, and benchmark test suites.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";

const testFiles = [
  "src/server/__tests__/qualification-engine.test.ts",
  "src/server/__tests__/role-matcher.test.ts",
  "src/server/__tests__/location-matcher.test.ts",
  "src/server/__tests__/entity-resolver.test.ts",
  "src/server/__tests__/extended-operators.test.ts",
  "src/server/__tests__/db.test.ts",
  "src/server/__tests__/evidence-reliability.test.ts",
  "src/server/__tests__/market-intelligence.test.ts",
];

console.log("═══════════════════════════════════════════════════════════════");
console.log("  DATAINTEL COMPREHENSIVE AUTOMATED TEST SUITE");
console.log("═══════════════════════════════════════════════════════════════\n");

let totalFailed = 0;
let suitesPassed = 0;

for (const testFile of testFiles) {
  const fullPath = path.resolve(process.cwd(), testFile);
  console.log(`\n▶ RUNNING: ${testFile}`);
  const res = spawnSync("npx", ["tsx", fullPath], {
    stdio: "inherit",
    shell: true,
  });

  if (res.status === 0) {
    suitesPassed++;
    console.log(`✔ SUITE PASSED: ${testFile}`);
  } else {
    totalFailed++;
    console.error(`✖ SUITE FAILED: ${testFile} (exit code ${res.status})`);
  }
}

console.log("\n═══════════════════════════════════════════════════════════════");
console.log(
  `  ALL SUITES SUMMARY: ${suitesPassed}/${testFiles.length} passed, ${totalFailed} failed`,
);
console.log("═══════════════════════════════════════════════════════════════\n");

if (totalFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
