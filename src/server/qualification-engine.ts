
import type {
  DatasetRecord,
  QualificationStatus,
} from "../lib/pipeline-schema";
import type { StructuredConstraint } from "../lib/workflow-schema";

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
  if (!clean || clean === "—" || clean.toLowerCase() === "not disclosed" || clean.toLowerCase() === "unknown") return null;

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

  // Indian comma formatted or raw numbers: e.g. "₹50,00,000", "₹1,50,000", "221,000", "5000000"
  const standardMatch = clean.match(/(?:₹|INR|Rs\.?)?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d+)?|\d+(?:\.\d+)?)/);
  if (standardMatch) {
    const rawDigits = standardMatch[1]!.replace(/,/g, "");
    const parsed = parseFloat(rawDigits);
    if (!isNaN(parsed)) {
      return { num: parsed };
    }
  }

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
    if (op === "equals") {
      return `${fieldName}: "${sc.value}"`;
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
  const empMatch = allText.match(/(?:between\s+)?(\d+)\s*(?:[-–—]|to)\s*(\d+)\s*employees/i) ||
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
  const priceUnderLakhMatch = allText.match(/(?:under|below|less than|within|up to|priced under)\s*(?:₹|inr|rs\.?)?\s*(\d+(?:\.\d+)?)\s*lakh/i);
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

  // 5. Geographic location constraint: e.g. "Indian B2B", "in Chennai", "in Bengaluru", "in Pune", "in India"
  if (/\bindian\b/i.test(allText) || /\bin\s+india\b/i.test(allText)) {
    structured.push({
      field: "location",
      operator: "contains",
      value: "India",
      hard: true,
    });
  } else {
    const cityMatch = allText.match(/\bin\s+(chennai|bengaluru|bangalore|pune|hyderabad|mumbai|delhi|kolkata|gurugram|noida)\b/i);
    if (cityMatch) {
      structured.push({
        field: "location",
        operator: "contains",
        value: cityMatch[1]!.charAt(0).toUpperCase() + cityMatch[1]!.slice(1).toLowerCase(),
        hard: true,
      });
    }
  }

  // 6. Role/skill constraints: "Java backend", "Java developer", "Spring Boot"
  if (allText.includes("java backend") || allText.includes("java developer") || allText.includes("java")) {
    structured.push({
      field: "role",
      operator: "contains",
      value: "Java",
      hard: true,
    });
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
        if ((kNorm.includes("size") || kNorm.includes("employee") || kNorm.includes("headcount")) && v && v !== "—" && v !== "Not disclosed") {
          return v;
        }
      }
    }
    if (normTarget.includes("location") || normTarget.includes("country") || normTarget.includes("city") || normTarget.includes("geo")) {
      for (const [k, v] of Object.entries(record.attributes)) {
        const kNorm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        const isCity = /\b(city|cities)\b/i.test(k) || (kNorm.includes("city") && !kNorm.includes("capacity"));
        if ((kNorm.includes("location") || kNorm.includes("country") || isCity || kNorm.includes("headquarter") || kNorm.includes("hq")) && v && v !== "—" && v !== "Not disclosed") {
          return v;
        }
      }
    }
    if (normTarget.includes("price") || normTarget.includes("salary") || normTarget.includes("cost") || normTarget.includes("budget")) {
      for (const [k, v] of Object.entries(record.attributes)) {
        const kNorm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        if ((kNorm.includes("price") || kNorm.includes("salary") || kNorm.includes("cost") || kNorm.includes("budget") || kNorm.includes("compensation")) && v && v !== "—" && v !== "Not disclosed") {
          return v;
        }
      }
    }
    if (normTarget.includes("range") || normTarget.includes("experience")) {
      for (const [k, v] of Object.entries(record.attributes)) {
        const kNorm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        if ((kNorm.includes("range") || kNorm.includes("experience")) && v && v !== "—" && v !== "Not disclosed") {
          return v;
        }
      }
    }
  }

  // 2. Canonical record fields fallback
  if (normTarget.includes("company") || normTarget.includes("brand") || normTarget.includes("developer")) {
    return record.company || record.entityName || "";
  }
  if (normTarget.includes("role") || normTarget.includes("model") || normTarget.includes("property")) {
    return record.role || "";
  }
  if (normTarget.includes("location") || normTarget.includes("city") || normTarget.includes("geo")) {
    return record.location || "";
  }
  if (normTarget.includes("salary") || normTarget.includes("price") || normTarget.includes("cost")) {
    return record.salary || "";
  }
  if (normTarget.includes("range") || normTarget.includes("experience")) {
    return record.experience || "";
  }
  if (normTarget.includes("size") || normTarget.includes("employee") || normTarget.includes("battery")) {
    return record.size || "";
  }

  return "";
}

// ─── Qualification Evaluator ──────────────────────────────────────────────────
export function evaluateRecordQualification(
  record: DatasetRecord,
  constraints: StructuredConstraint[],
  requiredFields: string[] = [],
  optionalFields: string[] = [],
): { status: QualificationStatus; reason: string } {
  // 1. Check if record has cross-source conflict on a key field
  if (record.conflict && record.conflict.field) {
    return {
      status: "Conflict",
      reason: `Conflicting values reported across sources for ${record.conflict.field}: ${record.conflict.values.map((v) => `${v.source} ("${v.value}")`).join(" vs ")}.`,
    };
  }

  // 2. Check each structured hard constraint
  for (const c of constraints) {
    if (!c.hard) continue;

    const rawVal = getFieldValue(record, c.field);
    const isMissing =
      !rawVal ||
      rawVal === "—" ||
      rawVal.toLowerCase() === "not disclosed" ||
      rawVal.toLowerCase() === "unknown";

    // If a hard constraint field value is missing: Needs verification
    if (isMissing) {
      const requiredStr =
        c.operator === "between"
          ? `${c.value} to ${c.valueTo ?? "—"} ${c.unit || ""}`
          : `${c.operator.replace(/_/g, " ")} ${c.value} ${c.unit || ""}`;
      return {
        status: "Needs verification",
        reason: `${c.field.replace(/_/g, " ")} could not be verified from collected sources. Required: ${requiredStr.trim()}.`,
      };
    }

    // Evaluate numeric constraints
    if (
      c.operator === "less_than" ||
      c.operator === "less_than_or_equal" ||
      c.operator === "greater_than" ||
      c.operator === "greater_than_or_equal" ||
      c.operator === "between"
    ) {
      const parsed = parseNumericValue(rawVal);
      const targetNum = parseFloat(c.value);

      if (!parsed || isNaN(targetNum)) {
        // Value could not be normalized confidently
        return {
          status: "Needs verification",
          reason: `Could not parse numeric value for ${c.field} from "${rawVal}". Needs manual verification against required: ${c.value} ${c.unit || ""}.`,
        };
      }

      const valToCheck = parsed.num;

      if (c.operator === "less_than" && valToCheck >= targetNum) {
        return {
          status: "Excluded",
          reason: `Verified ${c.field.replace(/_/g, " ")}: ${rawVal} exceeds maximum threshold of ${c.value} ${c.unit || ""}.`,
        };
      }
      if (c.operator === "less_than_or_equal" && valToCheck > targetNum) {
        return {
          status: "Excluded",
          reason: `Verified ${c.field.replace(/_/g, " ")}: ${rawVal} exceeds maximum limit of ${c.value} ${c.unit || ""}.`,
        };
      }
      if (c.operator === "greater_than" && valToCheck <= targetNum) {
        return {
          status: "Excluded",
          reason: `Verified ${c.field.replace(/_/g, " ")}: ${rawVal} is below required threshold of ${c.value} ${c.unit || ""}.`,
        };
      }
      if (c.operator === "greater_than_or_equal" && valToCheck < targetNum) {
        return {
          status: "Excluded",
          reason: `Verified ${c.field.replace(/_/g, " ")}: ${rawVal} is below minimum requirement of ${c.value} ${c.unit || ""}.`,
        };
      }
      if (c.operator === "between") {
        const targetTo = c.valueTo ? parseFloat(c.valueTo) : targetNum;
        if (parsed.min !== undefined && parsed.max !== undefined) {
          if (parsed.max < targetNum || parsed.min > targetTo) {
            return {
              status: "Excluded",
              reason: `Verified ${c.field.replace(/_/g, " ")}: ${rawVal}. Required range: ${c.value} to ${targetTo} ${c.unit || ""}.`,
            };
          }
        } else if (valToCheck < targetNum || valToCheck > targetTo) {
          return {
            status: "Excluded",
            reason: `Verified ${c.field.replace(/_/g, " ")}: ${rawVal}. Required range: ${c.value} to ${targetTo} ${c.unit || ""}.`,
          };
        }
      }
    }

    // Evaluate string constraints
    if (c.operator === "equals" || c.operator === "contains") {
      const normVal = rawVal.toLowerCase();
      const normTarget = c.value.toLowerCase();
      if (!normVal.includes(normTarget)) {
        // Geographic knowledge: if target is "India" or "Indian", recognize verified Indian cities & states
        if (
          c.field.toLowerCase().includes("location") &&
          (normTarget.includes("india") || normTarget.includes("indian"))
        ) {
          const indianCities = /\b(chennai|bengaluru|bangalore|hyderabad|pune|mumbai|delhi|noida|gurugram|gurgaon|kolkata|ahmedabad|jaipur|kochi|coimbatore|chandigarh|tamil\s*nadu|karnataka|maharashtra|telangana)\b/i;
          if (indianCities.test(normVal)) {
            continue;
          }
        }

        return {
          status: "Excluded",
          reason: `Verified ${c.field.replace(/_/g, " ")}: "${rawVal}" does not match required value "${c.value}".`,
        };
      }
    }
  }

  // 3. Check required output fields (except optional fields like "salary if available")
  const optionalLower = optionalFields.map((f) => f.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const field of requiredFields) {
    const fNorm = field.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (optionalLower.includes(fNorm)) {
      continue; // Missing optional field does NOT disqualify record!
    }

    const val = getFieldValue(record, field);
    if (!val || val === "—" || val.toLowerCase() === "not disclosed" || val.toLowerCase() === "unknown") {
      return {
        status: "Needs verification",
        reason: `Required field "${field}" was not disclosed or could not be confirmed in collected sources.`,
      };
    }
  }

  // 4. Evidence check: ensure at least one confirmed citation exists
  const hasConfirmedEvidence = record.evidence && record.evidence.some((e) => e.verification === "Confirmed");
  if (!hasConfirmedEvidence && record.evidence && record.evidence.length > 0) {
    return {
      status: "Needs verification",
      reason: "Evidence snippet citations could not be fully confirmed against primary web page content.",
    };
  }

  // 5. All hard constraints satisfied
  return {
    status: "Qualified",
    reason: "All qualification constraints and required attributes satisfied with verified source evidence.",
  };
}
