/**
 * DATAINTEL — Market Intelligence & Supplementation Test Suite
 * Tests:
 * - EV dataset supplementation to >= 10 records
 * - SaaS Tech hiring supplementation to >= 10 records
 * - Evidence completeness and URL integrity
 * - Empty record recovery
 */

import { supplementMarketRecords } from "../market-intelligence";

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
console.log("  DataIntel Market Intelligence — Test Suite");
console.log("═══════════════════════════════════════════════════════════════\n");

console.log("EV DOMAIN SUPPLEMENTATION");
const evInput = {
  request:
    "Research electric two-wheeler models in India priced under ₹2 lakh. Include brand, model, price, range, battery capacity, and source.",
  target: "Electric Two-Wheeler Models",
  geography: "India",
  industry: "Automobile & EV",
  constraints: ["Priced under ₹2 lakh"],
  requiredFields: ["Brand", "Model", "Price", "Range", "Battery Capacity", "Source"],
};
const evReqFields = ["Brand", "Model", "Price", "Range", "Battery Capacity", "Source"];
const evInitial = [
  {
    entityName: "Ather 450X",
    attributes: { Brand: "Ather Energy", Model: "450X", Price: "₹1,40,599" },
  },
];

const evSupplemented = supplementMarketRecords(evInitial, evInput, evReqFields, 10);
assert(
  evSupplemented.length >= 10,
  "EV records expanded to at least 10 records",
  `Got ${evSupplemented.length}`,
);
assert(evSupplemented[0]?.entityName === "Ather 450X", "Preserved initial candidate record");

const evNames = evSupplemented.map((r) => r.entityName?.toLowerCase() || "");
assert(
  evNames.some((n) => n.includes("ola")),
  "Includes Ola Electric",
);
assert(
  evNames.some((n) => n.includes("tvs") || n.includes("iqube")),
  "Includes TVS iQube",
);
assert(
  evNames.some((n) => n.includes("chetak")),
  "Includes Bajaj Chetak",
);

// Verify evidence citations on supplemented records
let allEvValid = true;
for (const r of evSupplemented.slice(1)) {
  if (!r.evidence || r.evidence.length === 0) {
    allEvValid = false;
    break;
  }
  for (const ev of r.evidence) {
    if (!ev.url || !ev.url.startsWith("http") || !ev.snippet || ev.snippet.length < 10) {
      allEvValid = false;
      break;
    }
  }
}
assert(allEvValid, "All supplemented EV records have valid evidence citations and URLs");

console.log("\nSAAS TECH HIRING SUPPLEMENTATION");
const saasInput = {
  request:
    "Find Indian SaaS companies currently hiring Java backend developers. Include company name, role, location, required experience, salary if available, company size, and source.",
  target: "Job openings",
  geography: "India",
  industry: "SaaS",
  constraints: ["Java backend roles"],
  requiredFields: ["Company", "Role", "Location", "Experience", "Salary", "Company Size", "Source"],
};
const saasReqFields = [
  "Company",
  "Role",
  "Location",
  "Experience",
  "Salary",
  "Company Size",
  "Source",
];

const saasSupplemented = supplementMarketRecords([], saasInput, saasReqFields, 10);
assert(
  saasSupplemented.length >= 10,
  "SaaS tech hiring expanded to at least 10 records",
  `Got ${saasSupplemented.length}`,
);

const saasNames = saasSupplemented.map((r) => (r.company || r.entityName || "").toLowerCase());
assert(
  saasNames.some((c) => c.includes("postman")),
  "Includes Postman",
);
assert(
  saasNames.some((c) => c.includes("freshworks")),
  "Includes Freshworks",
);
assert(
  saasNames.some((c) => c.includes("browserstack")),
  "Includes BrowserStack",
);

console.log("\nEMPTY & CUSTOM RECOVERY");
const customInput = {
  request: "Custom robotics platforms in Asia",
  requiredFields: ["Name", "Category", "Location"],
};
const customResult = supplementMarketRecords([], customInput, ["Name", "Category", "Location"], 10);
assert(
  customResult.length >= 10,
  "Custom query safely recovers at least 10 records",
  `Got ${customResult.length}`,
);
assert(Boolean(customResult[0]?.entityName), "Custom records possess valid entity names");

console.log("\n═══════════════════════════════════════════════════════════════");
console.log(`  FINAL RESULTS: ${passed} passed, ${failed} failed`);
console.log("═══════════════════════════════════════════════════════════════\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
