import type {
  DatasetRecord,
  QualificationStatus,
  QualificationDetails,
  ConstraintEvaluation,
} from "../lib/pipeline-schema";
import type { StructuredConstraint } from "../lib/workflow-schema";
import { matchRole, type RoleComparisonResult } from "./role-matcher";
import { matchLocation, type LocationComparison } from "./location-matcher";

// ─── Currency & Number Normalizer ─────────────────────────────────────────────
export interface ParsedNumber {
  num: number;
  min?: number;
  max?: number;
  unit?: string;
}

export function parseNumericValue(text: string): ParsedNumber | null {
  if (!text) return null;
  // If the text looks like an article title rather than a metric, or starts with listicle number:
  const clean = text.replace(/^(?:top|best|list of|\d+\s+best|\d+\s+top)\s+\d+\b/i, "").trim();
  if (
    !clean ||
    clean === "—" ||
    clean.toLowerCase() === "not disclosed" ||
    clean.toLowerCase() === "unknown"
  )
    return null;

  // Range detection: e.g. "50–500", "50 - 500", "50 to 500 employees"
  const rangeMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:[-–—]|to)\s*(\d+(?:\.\d+)?)/i);
  if (rangeMatch && !clean.toLowerCase().includes("lakh") && !clean.toLowerCase().includes("cr")) {
    const min = parseFloat(rangeMatch[1]!);
    const max = parseFloat(rangeMatch[2]!);
    return { num: min, min, max };
  }

  // Lakhs detection: e.g. "₹50 lakh", "₹ 1.5 Lakh", "50L", "1.5 Lakhs"
  const lakhMatch = clean.match(/(?:₹|INR|Rs\.?)?\s*(\d+(?:\.\d+)?)\s*(?:lakhs?|l)\b/i);
  if (lakhMatch) {
    const val = parseFloat(lakhMatch[1]!) * 100000;
    return { num: val, unit: "INR" };
  }

  // Crores detection: e.g. "₹5 Cr", "5 Crore"
  const crMatch = clean.match(/(?:₹|INR|Rs\.?)?\s*(\d+(?:\.\d+)?)\s*(?:crores?|cr)\b/i);
  if (crMatch) {
    const val = parseFloat(crMatch[1]!) * 10000000;
    return { num: val, unit: "INR" };
  }

  // Indian comma formatted numbers: e.g. "₹50,00,000", "₹1,50,000", "221,000"
  // Must contain at least one comma to match this pattern
  const commaMatch = clean.match(/(?:₹|INR|Rs\.?)?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?)/);
  if (commaMatch) {
    const rawDigits = commaMatch[1]!.replace(/,/g, "");
    const parsed = parseFloat(rawDigits);
    if (!isNaN(parsed)) {
      return { num: parsed };
    }
  }

  // Raw numbers without commas: e.g. "5000000", "200000", "42.5"
  const rawMatch = clean.match(/(?:₹|INR|Rs\.?)?\s*(\d+(?:\.\d+)?)/);
  if (rawMatch) {
    const parsed = parseFloat(rawMatch[1]!);
    if (!isNaN(parsed)) {
      return { num: parsed };
    }
  }

  return null;
}

export function parseDateValue(text: string): Date | null {
  if (!text) return null;
  const clean = text.trim();
  const timestamp = Date.parse(clean);
  if (!isNaN(timestamp)) return new Date(timestamp);
  const yearMatch = clean.match(/\b(19\d\d|20\d\d)\b/);
  if (yearMatch) return new Date(`${yearMatch[1]}-01-01`);
  return null;
}

export function formatConstraintDisplay(c: unknown): string {
  if (!c) return "";
  if (typeof c === "string") return c;
  if (typeof c === "object" && c !== null) {
    const sc = c as Partial<StructuredConstraint>;
    const fieldName = (sc.field || "Field")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
    const op = sc.operator;
    const unit = sc.unit ? ` ${sc.unit}` : "";

    let displayVal = sc.value || "";
    if (sc.unit === "INR" || fieldName.toLowerCase().includes("price")) {
      const num = parseFloat(sc.value || "0");
      if (num >= 10000000) {
        displayVal = `₹${(num / 10000000).toFixed(1).replace(/\.0$/, "")} Cr`;
      } else if (num >= 100000) {
        displayVal = `₹${(num / 100000).toFixed(1).replace(/\.0$/, "")} lakh`;
      }
    }

    if (op === "between") {
      return `${fieldName}: ${sc.value}–${sc.valueTo || "—"}${unit}`;
    }
    if (op === "less_than_or_equal") {
      return `${fieldName}: <= ${displayVal}${unit && !displayVal.includes(unit) ? unit : ""}`;
    }
    if (op === "less_than") {
      return `${fieldName}: < ${displayVal}${unit && !displayVal.includes(unit) ? unit : ""}`;
    }
    if (op === "greater_than_or_equal") {
      return `${fieldName}: >= ${displayVal}${unit && !displayVal.includes(unit) ? unit : ""}`;
    }
    if (op === "greater_than") {
      return `${fieldName}: > ${displayVal}${unit && !displayVal.includes(unit) ? unit : ""}`;
    }
    if (op === "contains") {
      return `${fieldName}: contains "${sc.value}"`;
    }
    if (op === "not_contains") {
      return `${fieldName}: does not contain "${sc.value}"`;
    }
    if (op === "equals") {
      return `${fieldName}: "${sc.value}"`;
    }
    if (op === "not_equals") {
      return `${fieldName}: != "${sc.value}"`;
    }
    if (op === "starts_with") {
      return `${fieldName}: starts with "${sc.value}"`;
    }
    if (op === "ends_with") {
      return `${fieldName}: ends with "${sc.value}"`;
    }
    if (op === "in") {
      return `${fieldName}: in [${sc.value}]`;
    }
    if (op === "not_in") {
      return `${fieldName}: not in [${sc.value}]`;
    }
    if (op === "contains_any") {
      return `${fieldName}: contains any of [${sc.value}]`;
    }
    if (op === "contains_all") {
      return `${fieldName}: contains all of [${sc.value}]`;
    }
    if (op === "before") {
      return `${fieldName}: before ${sc.value}`;
    }
    if (op === "after") {
      return `${fieldName}: after ${sc.value}`;
    }
    if (op === "within") {
      return `${fieldName}: within ${sc.value}${unit}`;
    }
    if (op === "semantic_match") {
      return `${fieldName}: ~ "${sc.value}"`;
    }
    if (sc.value) {
      return `${fieldName}: ${sc.value}${unit}`;
    }
  }
  return String(c);
}

// ─── Natural Language Constraint Extractor (Fallback & Supplement) ───────────
export function extractDeterministicConstraints(
  request: string,
  existingConstraints: string[] = [],
): {
  structuredConstraints: StructuredConstraint[];
  optionalFields: string[];
} {
  const structured: StructuredConstraint[] = [];
  const optional: string[] = [];
  const allText = (request + " " + existingConstraints.join(" ")).toLowerCase();

  // 1. Detect optional fields: e.g. "salary if available", "price when available", "if possible"
  if (/salary\s+(?:if\s+available|where\s+possible|when\s+available|optional)/i.test(request)) {
    optional.push("salary");
    optional.push("Salary");
  }
  if (/experience\s+(?:if\s+available|where\s+possible|when\s+available|optional)/i.test(request)) {
    optional.push("experience");
    optional.push("Experience");
  }

  // 2. Employee size: "50–500 employees", "50-500 employees", "between 50 and 500"
  const empMatch =
    allText.match(/(?:between\s+)?(\d+)\s*(?:[-–—]|to)\s*(\d+)\s*employees/i) ||
    allText.match(/(\d+)\s*(?:[-–—]|to)\s*(\d+)\s*(?:people|staff|headcount|emp)/i);
  if (empMatch) {
    structured.push({
      field: "company_size",
      operator: "between",
      value: empMatch[1]!,
      valueTo: empMatch[2]!,
      unit: "employees",
      hard: true,
    });
  }

  // 3. Price under: "under ₹50 lakh", "under ₹1.5 lakh", "under 50 lakh", "priced under ₹2 lakh"
  const priceUnderLakhMatch = allText.match(
    /(?:under|below|less than|within|up to|priced under)\s*(?:₹|inr|rs\.?)?\s*(\d+(?:\.\d+)?)\s*lakh/i,
  );
  if (priceUnderLakhMatch) {
    const lakhVal = parseFloat(priceUnderLakhMatch[1]!) * 100000;
    structured.push({
      field: "price",
      operator: "less_than_or_equal",
      value: String(lakhVal),
      unit: "INR",
      hard: true,
    });
  }

  // 4. Range at least: "at least 100 km", "min 100 km", "minimum 100 km", "100+ km range"
  const rangeMinMatch = allText.match(/(?:at least|minimum|min|>=)\s*(\d+)\s*km/i);
  if (rangeMinMatch) {
    structured.push({
      field: "range",
      operator: "greater_than_or_equal",
      value: rangeMinMatch[1]!,
      unit: "km",
      hard: true,
    });
  }

  // 5. Geographic location constraint — soft (non-disqualifying) since geography
  //    scopes the web search, not individual record qualification
  if (/\bindian\b/i.test(allText) || /\bin\s+india\b/i.test(allText)) {
    structured.push({
      field: "location",
      operator: "contains",
      value: "India",
      hard: false,
    });
  } else {
    const cityMatch = allText.match(
      /\bin\s+(chennai|bengaluru|bangalore|pune|hyderabad|mumbai|delhi|kolkata|gurugram|noida)\b/i,
    );
    if (cityMatch) {
      structured.push({
        field: "location",
        operator: "contains",
        value: cityMatch[1]!.charAt(0).toUpperCase() + cityMatch[1]!.slice(1).toLowerCase(),
        hard: false,
      });
    }
  }

  // 6. Role/skill constraints: extract full role specification from request text
  // Look for compound role phrases first, then fall back to technology-only
  const rolePatterns: Array<[RegExp, string]> = [
    [/java\s+backend\s+(?:developer|engineer)/i, "Java Backend Developer"],
    [/python\s+backend\s+(?:developer|engineer)/i, "Python Backend Developer"],
    [/react\s+(?:frontend|front[\s-]?end)\s+(?:developer|engineer)/i, "React Frontend Developer"],
    [/full[\s-]?stack\s+(?:developer|engineer)/i, "Full Stack Developer"],
    [/backend\s+(?:developer|engineer)/i, "Backend Developer"],
    [/frontend\s+(?:developer|engineer)/i, "Frontend Developer"],
    [/java\s+(?:developer|engineer)/i, "Java Developer"],
    [/python\s+(?:developer|engineer)/i, "Python Developer"],
  ];
  for (const [pattern, roleValue] of rolePatterns) {
    if (pattern.test(allText)) {
      structured.push({
        field: "role",
        operator: "contains",
        value: roleValue,
        hard: true,
      });
      break; // Only add first (most specific) role match
    }
  }

  return { structuredConstraints: structured, optionalFields: optional };
}

// ─── Helper to find record attribute value ────────────────────────────────────
function getFieldValue(record: DatasetRecord, fieldName: string): string {
  const normTarget = fieldName.toLowerCase().replace(/[^a-z0-9]/g, "");

  // 1. Direct or normalized exact attribute match
  if (record.attributes) {
    if (record.attributes[fieldName]) return record.attributes[fieldName]!;
    for (const [k, v] of Object.entries(record.attributes)) {
      if (k.toLowerCase().replace(/[^a-z0-9]/g, "") === normTarget && v) {
        return v;
      }
    }

    // 1b. Semantic attribute matching in record.attributes
    if (normTarget.includes("size") || normTarget.includes("employee")) {
      for (const [k, v] of Object.entries(record.attributes)) {
        const kNorm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (
          (kNorm.includes("size") || kNorm.includes("employee") || kNorm.includes("headcount")) &&
          v &&
          v !== "—" &&
          v !== "Not disclosed"
        ) {
          return v;
        }
      }
    }
    if (
      normTarget.includes("location") ||
      normTarget.includes("country") ||
      normTarget.includes("city") ||
      normTarget.includes("geo")
    ) {
      for (const [k, v] of Object.entries(record.attributes)) {
        const kNorm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        const isCity =
          /\b(city|cities)\b/i.test(k) || (kNorm.includes("city") && !kNorm.includes("capacity"));
        if (
          (kNorm.includes("location") ||
            kNorm.includes("country") ||
            isCity ||
            kNorm.includes("headquarter") ||
            kNorm.includes("hq")) &&
          v &&
          v !== "—" &&
          v !== "Not disclosed"
        ) {
          return v;
        }
      }
    }
    if (
      normTarget.includes("price") ||
      normTarget.includes("salary") ||
      normTarget.includes("cost") ||
      normTarget.includes("budget")
    ) {
      for (const [k, v] of Object.entries(record.attributes)) {
        const kNorm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (
          (kNorm.includes("price") ||
            kNorm.includes("salary") ||
            kNorm.includes("cost") ||
            kNorm.includes("budget") ||
            kNorm.includes("compensation")) &&
          v &&
          v !== "—" &&
          v !== "Not disclosed"
        ) {
          return v;
        }
      }
    }
    if (normTarget.includes("range") || normTarget.includes("experience")) {
      for (const [k, v] of Object.entries(record.attributes)) {
        const kNorm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (
          (kNorm.includes("range") || kNorm.includes("experience")) &&
          v &&
          v !== "—" &&
          v !== "Not disclosed"
        ) {
          return v;
        }
      }
    }
  }

  // 2. Canonical record fields fallback
  if (
    normTarget.includes("company") ||
    normTarget.includes("brand") ||
    normTarget.includes("developer")
  ) {
    return record.company || record.entityName || "";
  }
  if (
    normTarget.includes("role") ||
    normTarget.includes("model") ||
    normTarget.includes("property")
  ) {
    return record.role || "";
  }
  if (
    normTarget.includes("location") ||
    normTarget.includes("city") ||
    normTarget.includes("geo")
  ) {
    return record.location || "";
  }
  if (
    normTarget.includes("salary") ||
    normTarget.includes("price") ||
    normTarget.includes("cost")
  ) {
    return record.salary || "";
  }
  if (normTarget.includes("range") || normTarget.includes("experience")) {
    return record.experience || "";
  }
  if (
    normTarget.includes("size") ||
    normTarget.includes("employee") ||
    normTarget.includes("battery")
  ) {
    return record.size || "";
  }

  return "";
}

// ─── Qualification Evaluator (Three-State Logic) ──────────────────────────────
// CRITICAL: This evaluator uses PASS / FAIL / UNKNOWN for every constraint.
// Missing fields produce UNKNOWN, NOT FAIL. Only fields that are present and
// definitively violate a constraint produce FAIL. This prevents false exclusions.
export function evaluateRecordQualification(
  record: DatasetRecord,
  constraints: StructuredConstraint[],
  requiredFields: string[] = [],
  optionalFields: string[] = [],
): { status: QualificationStatus; reason: string; details: QualificationDetails } {
  const evaluations: ConstraintEvaluation[] = [];
  const missingFields: string[] = [];

  // ── 1. Evaluate ALL structured constraints — no early returns ────────────
  for (const c of constraints) {
    if (!c.hard) continue;

    const rawVal = getFieldValue(record, c.field);
    const isMissing =
      !rawVal ||
      rawVal === "—" ||
      rawVal.toLowerCase() === "not disclosed" ||
      rawVal.toLowerCase() === "unknown";

    // UNKNOWN: field value is missing or not found
    if (isMissing) {
      const expectedStr =
        c.operator === "between"
          ? `${c.value} to ${c.valueTo ?? "—"} ${c.unit || ""}`
          : `${c.operator.replace(/_/g, " ")} ${c.value} ${c.unit || ""}`;
      evaluations.push({
        field: c.field,
        operator: c.operator,
        expected: expectedStr.trim(),
        actual: null,
        normalizedValue: null,
        result: "UNKNOWN",
        reason: "FIELD_NOT_FOUND",
      });
      continue;
    }

    // ── Numeric constraints ────────────────────────────────────────────────
    if (
      c.operator === "less_than" ||
      c.operator === "less_than_or_equal" ||
      c.operator === "greater_than" ||
      c.operator === "greater_than_or_equal" ||
      c.operator === "between"
    ) {
      const parsed = parseNumericValue(rawVal);
      const targetNum = parseFloat(c.value);
      const expectedStr =
        c.operator === "between"
          ? `${c.value} to ${c.valueTo ?? "—"} ${c.unit || ""}`
          : `${c.operator.replace(/_/g, " ")} ${c.value} ${c.unit || ""}`;

      if (!parsed || isNaN(targetNum)) {
        // Value exists but cannot be parsed — UNKNOWN, not FAIL
        evaluations.push({
          field: c.field,
          operator: c.operator,
          expected: expectedStr.trim(),
          actual: rawVal,
          normalizedValue: null,
          result: "UNKNOWN",
          reason: "VALUE_UNPARSEABLE",
        });
        continue;
      }

      const valToCheck = parsed.num;
      let passes = true;
      let failReason = "";

      if (c.operator === "less_than") {
        passes = valToCheck < targetNum;
        failReason = passes ? "WITHIN_LIMIT" : "VALUE_EXCEEDS_MAXIMUM";
      } else if (c.operator === "less_than_or_equal") {
        passes = valToCheck <= targetNum;
        failReason = passes ? "WITHIN_LIMIT" : "VALUE_EXCEEDS_MAXIMUM";
      } else if (c.operator === "greater_than") {
        passes = valToCheck > targetNum;
        failReason = passes ? "MEETS_MINIMUM" : "VALUE_BELOW_MINIMUM";
      } else if (c.operator === "greater_than_or_equal") {
        passes = valToCheck >= targetNum;
        failReason = passes ? "MEETS_MINIMUM" : "VALUE_BELOW_MINIMUM";
      } else if (c.operator === "between") {
        const targetTo = c.valueTo ? parseFloat(c.valueTo) : targetNum;
        if (parsed.min !== undefined && parsed.max !== undefined) {
          passes = !(parsed.max < targetNum || parsed.min > targetTo);
        } else {
          passes = valToCheck >= targetNum && valToCheck <= targetTo;
        }
        failReason = passes ? "WITHIN_RANGE" : "OUTSIDE_RANGE";
      }

      evaluations.push({
        field: c.field,
        operator: c.operator,
        expected: expectedStr.trim(),
        actual: rawVal,
        normalizedValue: parsed.num,
        result: passes ? "PASS" : "FAIL",
        reason: failReason,
      });
      continue;
    }

    // ── Generalized Operator Engine ───────────────────────────────────────
    const normVal = rawVal.toLowerCase().trim();
    const normTargetVal = (c.value || "").toLowerCase().trim();
    const fieldNorm = c.field.toLowerCase().replace(/[^a-z0-9]/g, "");

    const isRoleField =
      fieldNorm.includes("role") ||
      fieldNorm.includes("title") ||
      fieldNorm.includes("designation") ||
      fieldNorm.includes("position");

    const isLocationField =
      fieldNorm.includes("location") ||
      fieldNorm.includes("city") ||
      fieldNorm.includes("country") ||
      fieldNorm.includes("geography") ||
      fieldNorm.includes("state");

    // ── 1. Role matching with semantic taxonomy ────────────────────────────
    if (
      isRoleField &&
      (c.operator === "equals" || c.operator === "contains" || c.operator === "semantic_match")
    ) {
      const roleComparison = matchRole(c.value, rawVal);
      const constraintResult: "PASS" | "FAIL" | "UNKNOWN" =
        roleComparison.result === "MATCH"
          ? "PASS"
          : roleComparison.result === "NO_MATCH"
            ? "FAIL"
            : "UNKNOWN";

      evaluations.push({
        field: c.field,
        operator: c.operator,
        expected: c.value,
        actual: rawVal,
        normalizedValue: null,
        result: constraintResult,
        reason: roleComparison.reason,
      });
      continue;
    }

    // ── 2. Location matching with normalized geography ─────────────────────
    if (
      isLocationField &&
      (c.operator === "equals" || c.operator === "contains" || c.operator === "semantic_match")
    ) {
      const locComparison = matchLocation(c.value, rawVal);
      evaluations.push({
        field: c.field,
        operator: c.operator,
        expected: c.value,
        actual: rawVal,
        normalizedValue: null,
        result: locComparison.result,
        reason: locComparison.reason,
      });
      continue;
    }

    // Location negative matching
    if (isLocationField && (c.operator === "not_equals" || c.operator === "not_contains")) {
      const locComparison = matchLocation(c.value, rawVal);
      const res: "PASS" | "FAIL" | "UNKNOWN" =
        locComparison.result === "PASS"
          ? "FAIL"
          : locComparison.result === "FAIL"
            ? "PASS"
            : "UNKNOWN";

      evaluations.push({
        field: c.field,
        operator: c.operator,
        expected: `NOT ${c.value}`,
        actual: rawVal,
        normalizedValue: null,
        result: res,
        reason: res === "PASS" ? "LOCATION_EXCLUDED_AS_REQUESTED" : "LOCATION_MATCHES_DISALLOWED",
      });
      continue;
    }

    // ── 3. Date operators: before, after ──────────────────────────────────
    if (c.operator === "before" || c.operator === "after") {
      const actualDate = parseDateValue(rawVal);
      const targetDate = parseDateValue(c.value);

      if (!actualDate || !targetDate) {
        evaluations.push({
          field: c.field,
          operator: c.operator,
          expected: c.value,
          actual: rawVal,
          normalizedValue: null,
          result: "UNKNOWN",
          reason: "DATE_UNPARSEABLE",
        });
        continue;
      }

      const passes =
        c.operator === "before"
          ? actualDate.getTime() < targetDate.getTime()
          : actualDate.getTime() > targetDate.getTime();

      evaluations.push({
        field: c.field,
        operator: c.operator,
        expected: c.value,
        actual: rawVal,
        normalizedValue: actualDate.getTime(),
        result: passes ? "PASS" : "FAIL",
        reason: passes
          ? `${c.operator.toUpperCase()}_DATE_SATISFIED`
          : `DATE_${c.operator.toUpperCase()}_VIOLATION`,
      });
      continue;
    }

    // ── 4. Set membership: in, not_in ──────────────────────────────────────
    if (c.operator === "in" || c.operator === "not_in") {
      const setVals = c.value
        .toLowerCase()
        .split(/[,|]/)
        .map((s) => s.trim())
        .filter(Boolean);

      const isMember = setVals.some((item) => normVal.includes(item) || normVal === item);
      const passes = c.operator === "in" ? isMember : !isMember;

      evaluations.push({
        field: c.field,
        operator: c.operator,
        expected: `[${setVals.join(", ")}]`,
        actual: rawVal,
        normalizedValue: null,
        result: passes ? "PASS" : "FAIL",
        reason: passes
          ? c.operator === "in"
            ? "MEMBER_OF_ALLOWED_SET"
            : "NOT_IN_DISALLOWED_SET"
          : c.operator === "in"
            ? "NOT_IN_ALLOWED_SET"
            : "FOUND_IN_DISALLOWED_SET",
      });
      continue;
    }

    // ── 5. Multi-containment: contains_any, contains_all ───────────────────
    if (c.operator === "contains_any" || c.operator === "contains_all") {
      const items = c.value
        .toLowerCase()
        .split(/[,|]/)
        .map((s) => s.trim())
        .filter(Boolean);

      const passes =
        c.operator === "contains_any"
          ? items.some((i) => normVal.includes(i))
          : items.every((i) => normVal.includes(i));

      evaluations.push({
        field: c.field,
        operator: c.operator,
        expected: `[${items.join(c.operator === "contains_any" ? " OR " : " AND ")}]`,
        actual: rawVal,
        normalizedValue: null,
        result: passes ? "PASS" : "FAIL",
        reason: passes
          ? `${c.operator.toUpperCase()}_SATISFIED`
          : `${c.operator.toUpperCase()}_FAILED`,
      });
      continue;
    }

    // ── 6. String boundaries: starts_with, ends_with ───────────────────────
    if (c.operator === "starts_with") {
      const passes = normVal.startsWith(normTargetVal);
      evaluations.push({
        field: c.field,
        operator: c.operator,
        expected: c.value,
        actual: rawVal,
        normalizedValue: null,
        result: passes ? "PASS" : "FAIL",
        reason: passes ? "STARTS_WITH_MATCH" : "DOES_NOT_START_WITH",
      });
      continue;
    }

    if (c.operator === "ends_with") {
      const passes = normVal.endsWith(normTargetVal);
      evaluations.push({
        field: c.field,
        operator: c.operator,
        expected: c.value,
        actual: rawVal,
        normalizedValue: null,
        result: passes ? "PASS" : "FAIL",
        reason: passes ? "ENDS_WITH_MATCH" : "DOES_NOT_END_WITH",
      });
      continue;
    }

    // ── 7. Negation: not_equals, not_contains ─────────────────────────────
    if (c.operator === "not_equals") {
      const passes = normVal !== normTargetVal;
      evaluations.push({
        field: c.field,
        operator: c.operator,
        expected: `!= ${c.value}`,
        actual: rawVal,
        normalizedValue: null,
        result: passes ? "PASS" : "FAIL",
        reason: passes ? "NOT_EQUAL_SATISFIED" : "VALUE_EQUALS_DISALLOWED",
      });
      continue;
    }

    if (c.operator === "not_contains") {
      const passes = !normVal.includes(normTargetVal);
      evaluations.push({
        field: c.field,
        operator: c.operator,
        expected: `NOT CONTAINS ${c.value}`,
        actual: rawVal,
        normalizedValue: null,
        result: passes ? "PASS" : "FAIL",
        reason: passes ? "DOES_NOT_CONTAIN" : "CONTAINS_DISALLOWED_TEXT",
      });
      continue;
    }

    // ── 8. Range/tolerance: within ─────────────────────────────────────────
    if (c.operator === "within") {
      const parsedNum = parseNumericValue(rawVal);
      const targetNum = parseFloat(c.value);
      if (parsedNum && !isNaN(targetNum)) {
        // e.g. within 10% or within specified range
        const tolerance = c.valueTo ? parseFloat(c.valueTo) : targetNum * 0.15;
        const passes = Math.abs(parsedNum.num - targetNum) <= tolerance;
        evaluations.push({
          field: c.field,
          operator: c.operator,
          expected: `${c.value} ±${tolerance}`,
          actual: rawVal,
          normalizedValue: parsedNum.num,
          result: passes ? "PASS" : "FAIL",
          reason: passes ? "WITHIN_TOLERANCE" : "OUTSIDE_TOLERANCE",
        });
        continue;
      }
      // String fallback for within
      const passes = normVal.includes(normTargetVal);
      evaluations.push({
        field: c.field,
        operator: c.operator,
        expected: c.value,
        actual: rawVal,
        normalizedValue: null,
        result: passes ? "PASS" : "FAIL",
        reason: passes ? "WITHIN_MATCH" : "OUTSIDE_BOUNDS",
      });
      continue;
    }

    // ── 9. Standard equality & containment ─────────────────────────────────
    if (c.operator === "equals" || c.operator === "contains" || c.operator === "semantic_match") {
      let passes = normVal.includes(normTargetVal);

      // Geographic knowledge fallback: Indian cities/states count as "India"
      if (
        !passes &&
        c.field.toLowerCase().includes("location") &&
        (normTargetVal.includes("india") || normTargetVal.includes("indian"))
      ) {
        const indianCities =
          /\b(chennai|bengaluru|bangalore|hyderabad|pune|mumbai|delhi|noida|gurugram|gurgaon|kolkata|ahmedabad|jaipur|kochi|coimbatore|chandigarh|tamil\s*nadu|karnataka|maharashtra|telangana)\b/i;
        if (indianCities.test(normVal)) {
          passes = true;
        }
      }

      evaluations.push({
        field: c.field,
        operator: c.operator,
        expected: c.value,
        actual: rawVal,
        normalizedValue: null,
        result: passes ? "PASS" : "FAIL",
        reason: passes ? "MATCHES" : "DOES_NOT_MATCH",
      });
      continue;
    }

    // Unsupported operator — treat as UNKNOWN
    evaluations.push({
      field: c.field,
      operator: c.operator,
      expected: c.value,
      actual: rawVal,
      normalizedValue: null,
      result: "UNKNOWN",
      reason: "UNSUPPORTED_OPERATOR",
    });
  }

  // ── 2. Check required fields for completeness ───────────────────────────
  const optionalLower = optionalFields.map((f) => f.toLowerCase().replace(/[^a-z0-9]/g, ""));
  let foundRequired = 0;
  let totalRequired = 0;

  for (const field of requiredFields) {
    const fNorm = field.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (optionalLower.includes(fNorm)) continue;
    totalRequired++;

    const val = getFieldValue(record, field);
    if (
      !val ||
      val === "—" ||
      val.toLowerCase() === "not disclosed" ||
      val.toLowerCase() === "unknown"
    ) {
      missingFields.push(field);
    } else {
      foundRequired++;
    }
  }

  const completenessScore =
    totalRequired > 0 ? Math.round((foundRequired / totalRequired) * 100) : 100;

  // ── 3. Determine final qualification status ─────────────────────────────
  // Rule: any FAIL → Excluded, conflict → Conflict,
  //        any UNKNOWN or missing fields → Needs verification, else → Qualified
  const hasFail = evaluations.some((e) => e.result === "FAIL");
  const hasUnknown = evaluations.some((e) => e.result === "UNKNOWN");
  const hasConflict =
    (record.conflicts && record.conflicts.length > 0) || (record.conflict && record.conflict.field);

  let status: QualificationStatus;
  let reason: string;

  if (hasFail) {
    const failed = evaluations.filter((e) => e.result === "FAIL");
    status = "Excluded";
    reason = failed
      .map(
        (f) =>
          `${f.field.replace(/_/g, " ")}: ${f.actual} does not satisfy ${f.operator.replace(/_/g, " ")} ${f.expected}`,
      )
      .join("; ");
  } else if (hasConflict) {
    const conflictFields = (record.conflicts || []).map((c) => c.field).join(", ");
    status = "Conflict";
    reason = `Conflicting values across sources for: ${conflictFields || record.conflict?.field || "unknown field"}.`;
  } else if (hasUnknown || missingFields.length > 0) {
    const unknownFields = evaluations.filter((e) => e.result === "UNKNOWN").map((e) => e.field);
    const allMissing = [...new Set([...unknownFields, ...missingFields])];
    status = "Needs verification";
    reason = `Missing or unverifiable fields: ${allMissing.join(", ")}. These fields could not be confirmed from collected sources.`;
  } else {
    // Check evidence quality
    const hasConfirmedEvidence =
      record.evidence && record.evidence.some((e) => e.verification === "Confirmed");
    if (!hasConfirmedEvidence && record.evidence && record.evidence.length > 0) {
      status = "Needs verification";
      reason = "All constraints satisfied but evidence citations could not be fully confirmed.";
    } else {
      status = "Qualified";
      reason = "All qualification constraints satisfied with verified source evidence.";
    }
  }

  // Log qualification evaluation for debugging
  if (evaluations.length > 0) {
    console.log(
      `[Qualification] ${record.entityName}: ${status} | ` +
        evaluations
          .map(
            (e) =>
              `${e.field}=${e.actual ?? "NULL"} (norm=${e.normalizedValue ?? "N/A"}) → ${e.result} (${e.reason})`,
          )
          .join(", "),
    );
  }

  return {
    status,
    reason,
    details: {
      constraints: evaluations,
      missingFields,
      completenessScore,
    },
  };
}
