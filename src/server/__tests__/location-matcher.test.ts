/**
 * DATAINTEL — Geographic Location Matcher Test Suite
 * Tests Requirement 13:
 * - Bengaluru == Bangalore
 * - Bengaluru != Chennai
 * - India satisfies country-level India requirement
 * - City requirement (e.g. Bengaluru) produces UNKNOWN if only country (India) is present
 * - Foreign countries (US, UK) produce FAIL when India is required
 * - Remote and Hybrid work matching
 */

import { matchLocation, normalizeLocation } from "../location-matcher";

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
console.log("  DataIntel Location Matcher — Comprehensive Test Suite");
console.log("═══════════════════════════════════════════════════════════════\n");

console.log("NORMALIZATION & ALIAS RESOLUTION");
const blrNorm = normalizeLocation("Bangalore, Karnataka");
assert(blrNorm.city === "Bengaluru", "Bangalore normalizes to Bengaluru", blrNorm.city);
assert(blrNorm.country === "India", "Bangalore identified in India", blrNorm.country);

const bomNorm = normalizeLocation("Mumbai (Bombay)");
assert(bomNorm.city === "Mumbai", "Mumbai identified correctly", bomNorm.city);

const gurNorm = normalizeLocation("Gurgaon, Haryana");
assert(gurNorm.city === "Gurugram", "Gurgaon normalizes to Gurugram", gurNorm.city);

console.log("\nCITY-LEVEL MATCHING");
// 1. Bengaluru = Bangalore (PASS)
const blrMatch = matchLocation("Bengaluru", "Bangalore");
assert(blrMatch.result === "PASS", "Bengaluru matches Bangalore (alias)", blrMatch.reason);

// 2. Bengaluru != Chennai (FAIL)
const blrChennai = matchLocation("Bengaluru", "Chennai, Tamil Nadu");
assert(blrChennai.result === "FAIL", "Bengaluru does NOT match Chennai (FAIL)", blrChennai.reason);

// 3. City requirement when actual is only India (UNKNOWN)
const blrIndia = matchLocation("Bengaluru", "India");
assert(
  blrIndia.result === "UNKNOWN",
  "Bengaluru required, actual only 'India' → UNKNOWN",
  blrIndia.reason,
);

// 4. City missing / null → UNKNOWN
const blrNull = matchLocation("Bengaluru", null);
assert(blrNull.result === "UNKNOWN", "Null actual location → UNKNOWN", blrNull.reason);

console.log("\nCOUNTRY-LEVEL MATCHING");
// 5. India required, Bengaluru actual → PASS
const indBlr = matchLocation("India", "Bengaluru");
assert(indBlr.result === "PASS", "India required, actual Bengaluru → PASS", indBlr.reason);

// 6. India required, actual India → PASS
const indInd = matchLocation("India", "India");
assert(indInd.result === "PASS", "India required, actual India → PASS", indInd.reason);

// 7. India required, actual London / US → FAIL
const indUS = matchLocation("India", "San Francisco, CA, USA");
assert(indUS.result === "FAIL", "India required, actual USA → FAIL", indUS.reason);

const indUK = matchLocation("India", "London, United Kingdom");
assert(indUK.result === "FAIL", "India required, actual London → FAIL", indUK.reason);

console.log("\nREMOTE & HYBRID MATCHING");
// 8. Remote required, actual Remote → PASS
const remRem = matchLocation("Remote", "100% Remote, India");
assert(remRem.result === "PASS", "Remote required, actual Remote → PASS", remRem.reason);

// 9. Remote required, actual on-site only → FAIL
const remOnsite = matchLocation("Remote", "Chennai office only");
assert(remOnsite.result === "FAIL", "Remote required, on-site only → FAIL", remOnsite.reason);

console.log(`\n═══════════════════════════════════════════════════════════════`);
console.log(`  Location Results: ${passed} passed, ${failed} failed`);
console.log(`═══════════════════════════════════════════════════════════════\n`);

if (failed > 0) process.exit(1);
