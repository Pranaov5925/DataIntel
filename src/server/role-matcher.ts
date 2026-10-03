/**
 * DataIntel — Structured Role Matching Engine
 *
 * Replaces exact substring matching with a structured decomposition:
 *   Raw Title → Normalize → Extract Role Family + Technologies + Seniority → Compare
 *
 * Architecture:
 *   1. Deterministic normalization (fast, always runs)
 *   2. Role family classification via keyword vocabulary
 *   3. Technology extraction via known tech dictionary
 *   4. Seniority extraction via title prefix/suffix patterns
 *   5. Structured comparison producing MATCH / NO_MATCH / UNKNOWN
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type RoleFamily =
  | "BACKEND"
  | "FRONTEND"
  | "FULLSTACK"
  | "MOBILE"
  | "DEVOPS"
  | "DATA_ENGINEERING"
  | "DATA_SCIENCE"
  | "ML_AI"
  | "QA_TESTING"
  | "SECURITY"
  | "DATABASE"
  | "CLOUD"
  | "DESIGN"
  | "PRODUCT"
  | "MANAGEMENT"
  | "OTHER"
  | "UNKNOWN";

export type Seniority =
  | "INTERN"
  | "ENTRY"
  | "JUNIOR"
  | "MID"
  | "SENIOR"
  | "LEAD"
  | "STAFF"
  | "PRINCIPAL"
  | "ARCHITECT"
  | "MANAGER"
  | "DIRECTOR"
  | "UNKNOWN";

export type RoleMatchResult = "MATCH" | "NO_MATCH" | "UNKNOWN";

export interface ParsedRole {
  rawTitle: string;
  normalizedTitle: string;
  roleFamily: RoleFamily;
  technologies: string[];
  seniority: Seniority;
}

export interface RoleComparisonResult {
  result: RoleMatchResult;
  reason: string;
  requiredParsed: ParsedRole;
  actualParsed: ParsedRole;
  roleFamilyMatch: boolean | null; // null = unknown
  technologyMatch: boolean | null;
  seniorityMatch: boolean | null;
}

// ─── Step 1: Title Normalization ──────────────────────────────────────────────

export function normalizeTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      // Normalize punctuation separators to spaces
      .replace(/[-–—/\\&|,;:•·]+/g, " ")
      // Remove parentheses, brackets
      .replace(/[()[\]{}]/g, " ")
      // Normalize dots in known contexts (keep in tech names like "Node.js")
      .replace(/(?<![a-z])\.(?![a-z])/g, " ")
      // Collapse whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

// ─── Step 2: Role Family Classification ───────────────────────────────────────

// Each entry: [pattern, roleFamily, priority]
// Priority: higher = more specific = wins over lower
const ROLE_FAMILY_PATTERNS: Array<[RegExp, RoleFamily, number]> = [
  // ── BACKEND (priority 10) ──
  [/\bback\s*end\b/, "BACKEND", 10],
  [/\bserver[\s-]*side\b/, "BACKEND", 10],
  [/\bapi\s+(developer|engineer|architect)\b/, "BACKEND", 10],
  [/\bmicroservices?\s+(developer|engineer)\b/, "BACKEND", 10],

  // ── FRONTEND (priority 10) ──
  [/\bfront\s*end\b/, "FRONTEND", 10],
  [/\bclient[\s-]*side\b/, "FRONTEND", 10],
  [/\bui\s+(developer|engineer)\b/, "FRONTEND", 10],
  [/\bui\/ux\b/, "FRONTEND", 10],
  [/\breact\s+(developer|engineer)\b/, "FRONTEND", 9],
  [/\bangular\s+(developer|engineer)\b/, "FRONTEND", 9],
  [/\bvue\s+(developer|engineer)\b/, "FRONTEND", 9],

  // ── FULLSTACK (priority 11, beats frontend/backend) ──
  [/\bfull\s*stack\b/, "FULLSTACK", 11],
  [/\bfull[\s-]*stack\b/, "FULLSTACK", 11],
  [/\bmern\s+(developer|engineer)\b/, "FULLSTACK", 11],
  [/\bmean\s+(developer|engineer)\b/, "FULLSTACK", 11],

  // ── MOBILE (priority 10) ──
  [/\bandroid\b/, "MOBILE", 10],
  [/\bios\b/, "MOBILE", 10],
  [/\bmobile\b/, "MOBILE", 10],
  [/\bflutter\s+(developer|engineer)\b/, "MOBILE", 10],
  [/\breact\s+native\b/, "MOBILE", 10],
  [/\bswift\s+(developer|engineer)\b/, "MOBILE", 10],
  [/\bkotlin\s+(developer|engineer)\b/, "MOBILE", 9],

  // ── DEVOPS (priority 10) ──
  [/\bdevops\b/, "DEVOPS", 10],
  [/\bsite\s+reliability\b/, "DEVOPS", 10],
  [/\bsre\b/, "DEVOPS", 10],
  [/\binfrastructure\s+(engineer|developer)\b/, "DEVOPS", 10],
  [/\bplatform\s+engineer\b/, "DEVOPS", 9],
  [/\brelease\s+engineer\b/, "DEVOPS", 9],

  // ── DATA_ENGINEERING (priority 10) ──
  [/\bdata\s+engineer/i, "DATA_ENGINEERING", 10],
  [/\betl\s+(developer|engineer)\b/, "DATA_ENGINEERING", 10],
  [/\bdata\s+pipeline\b/, "DATA_ENGINEERING", 10],
  [/\bbig\s+data\s+(developer|engineer)\b/, "DATA_ENGINEERING", 10],

  // ── DATA_SCIENCE (priority 10) ──
  [/\bdata\s+scien/, "DATA_SCIENCE", 10],
  [/\bdata\s+analyst\b/, "DATA_SCIENCE", 10],
  [/\bstatistician\b/, "DATA_SCIENCE", 10],
  [/\banalytics\s+engineer\b/, "DATA_SCIENCE", 10],

  // ── ML_AI (priority 10) ──
  [/\bmachine\s+learning\b/, "ML_AI", 10],
  [/\bml\s+(engineer|developer|scientist)\b/, "ML_AI", 10],
  [/\bai\s+(engineer|developer|scientist|researcher)\b/, "ML_AI", 10],
  [/\bdeep\s+learning\b/, "ML_AI", 10],
  [/\bnlp\s+(engineer|developer|scientist)\b/, "ML_AI", 10],
  [/\bcomputer\s+vision\b/, "ML_AI", 10],

  // ── QA_TESTING (priority 10) ──
  [/\bqa\b/, "QA_TESTING", 10],
  [/\bquality\s+assurance\b/, "QA_TESTING", 10],
  [/\btest\s+(engineer|developer|automation|analyst|lead)\b/, "QA_TESTING", 10],
  [/\bsdet\b/, "QA_TESTING", 10],
  [/\bautomation\s+(engineer|tester)\b/, "QA_TESTING", 10],

  // ── SECURITY (priority 10) ──
  [/\bsecurity\s+(engineer|analyst|architect)\b/, "SECURITY", 10],
  [/\bcyber\s+security\b/, "SECURITY", 10],
  [/\bpentester\b/, "SECURITY", 10],
  [/\binfosec\b/, "SECURITY", 10],

  // ── DATABASE (priority 10) ──
  [/\bdba\b/, "DATABASE", 10],
  [/\bdatabase\s+(administrator|engineer|developer)\b/, "DATABASE", 10],

  // ── CLOUD (priority 10) ──
  [/\bcloud\s+(engineer|architect|developer)\b/, "CLOUD", 10],
  [/\baws\s+(engineer|architect|developer)\b/, "CLOUD", 9],
  [/\bazure\s+(engineer|architect|developer)\b/, "CLOUD", 9],
  [/\bgcp\s+(engineer|architect|developer)\b/, "CLOUD", 9],

  // ── DESIGN (priority 10) ──
  [/\bui\s*\/?\s*ux\s+(design|designer)\b/, "DESIGN", 10],
  [/\bux\s+(design|designer|researcher)\b/, "DESIGN", 10],
  [/\bgraphic\s+design\b/, "DESIGN", 10],
  [/\bproduct\s+design\b/, "DESIGN", 10],

  // ── PRODUCT (priority 10) ──
  [/\bproduct\s+manager\b/, "PRODUCT", 10],
  [/\bproduct\s+owner\b/, "PRODUCT", 10],
  [/\bprogram\s+manager\b/, "PRODUCT", 9],

  // ── MANAGEMENT (priority 10) ──
  [/\bengineering\s+manager\b/, "MANAGEMENT", 10],
  [/\bvp\s+(?:of\s+)?engineering\b/, "MANAGEMENT", 10],
  [/\bcto\b/, "MANAGEMENT", 10],
  [/\bdirector\s+(?:of\s+)?engineering\b/, "MANAGEMENT", 10],
];

export function classifyRoleFamily(normalizedTitle: string): RoleFamily {
  let bestMatch: RoleFamily = "UNKNOWN";
  let bestPriority = -1;

  for (const [pattern, family, priority] of ROLE_FAMILY_PATTERNS) {
    if (pattern.test(normalizedTitle) && priority > bestPriority) {
      bestMatch = family;
      bestPriority = priority;
    }
  }

  return bestMatch;
}

// ─── Step 3: Technology Extraction ────────────────────────────────────────────

// Normalized aliases: alias → canonical name
const TECH_ALIASES: Record<string, string> = {
  js: "javascript",
  javascript: "javascript",
  ts: "typescript",
  typescript: "typescript",
  "react.js": "react",
  reactjs: "react",
  react: "react",
  "react native": "react native",
  angular: "angular",
  angularjs: "angular",
  vue: "vue",
  "vue.js": "vue",
  vuejs: "vue",
  node: "node.js",
  "node.js": "node.js",
  nodejs: "node.js",
  express: "express",
  "express.js": "express",
  "next.js": "next.js",
  nextjs: "next.js",
  java: "java",
  spring: "spring",
  "spring boot": "spring boot",
  springboot: "spring boot",
  python: "python",
  django: "django",
  flask: "flask",
  fastapi: "fastapi",
  go: "go",
  golang: "go",
  rust: "rust",
  "c++": "c++",
  cpp: "c++",
  "c#": "c#",
  csharp: "c#",
  ".net": ".net",
  dotnet: ".net",
  ruby: "ruby",
  rails: "ruby on rails",
  "ruby on rails": "ruby on rails",
  php: "php",
  laravel: "laravel",
  scala: "scala",
  kotlin: "kotlin",
  swift: "swift",
  flutter: "flutter",
  dart: "dart",
  sql: "sql",
  mysql: "mysql",
  postgresql: "postgresql",
  postgres: "postgresql",
  mongodb: "mongodb",
  mongo: "mongodb",
  redis: "redis",
  kafka: "kafka",
  elasticsearch: "elasticsearch",
  docker: "docker",
  kubernetes: "kubernetes",
  k8s: "kubernetes",
  aws: "aws",
  azure: "azure",
  gcp: "gcp",
  terraform: "terraform",
  graphql: "graphql",
  rest: "rest",
  grpc: "grpc",
};

// Technologies that are multi-word and must be matched before single-word extraction
const MULTI_WORD_TECHS = [
  "spring boot",
  "ruby on rails",
  "react native",
  "node.js",
  "vue.js",
  "next.js",
  "express.js",
  "react.js",
  "machine learning",
  "deep learning",
];

export function extractTechnologies(normalizedTitle: string): string[] {
  const techs = new Set<string>();
  let remaining = normalizedTitle;

  // First pass: multi-word tech extraction
  for (const mw of MULTI_WORD_TECHS) {
    if (remaining.includes(mw)) {
      const canonical = TECH_ALIASES[mw] || mw;
      techs.add(canonical);
      remaining = remaining.replace(
        new RegExp(mw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        " ",
      );
    }
  }

  // Second pass: single-word tech extraction
  const words = remaining.split(/\s+/);
  for (const word of words) {
    const cleaned = word.replace(/[^a-z0-9.#+]/g, "");
    if (cleaned && TECH_ALIASES[cleaned]) {
      techs.add(TECH_ALIASES[cleaned]!);
    }
  }

  return Array.from(techs);
}

// ─── Step 4: Seniority Extraction ─────────────────────────────────────────────

const SENIORITY_PATTERNS: Array<[RegExp, Seniority]> = [
  [/\bintern\b/, "INTERN"],
  [/\btrainee\b/, "INTERN"],
  [/\bentry[\s-]*level\b/, "ENTRY"],
  [/\bfresher\b/, "ENTRY"],
  [/\bjunior\b|\bjr\b/, "JUNIOR"],
  [/\bmid[\s-]*level\b/, "MID"],
  [/\bsenior\b|\bsr\b/, "SENIOR"],
  [/\blead\b/, "LEAD"],
  [/\btech\s+lead\b/, "LEAD"],
  [/\bteam\s+lead\b/, "LEAD"],
  [/\bstaff\b/, "STAFF"],
  [/\bprincipal\b/, "PRINCIPAL"],
  [/\barchitect\b/, "ARCHITECT"],
  [/\bmanager\b/, "MANAGER"],
  [/\bdirector\b/, "DIRECTOR"],
  [/\bvp\b/, "DIRECTOR"],
  [/\bhead\s+of\b/, "DIRECTOR"],
];

export function extractSeniority(normalizedTitle: string): Seniority {
  // Check patterns in order (most specific first by length match)
  for (const [pattern, seniority] of SENIORITY_PATTERNS) {
    if (pattern.test(normalizedTitle)) {
      return seniority;
    }
  }
  return "UNKNOWN";
}

// ─── Step 5: Full Title Parsing ───────────────────────────────────────────────

export function parseRole(rawTitle: string): ParsedRole {
  const normalizedTitle = normalizeTitle(rawTitle);

  return {
    rawTitle,
    normalizedTitle,
    roleFamily: classifyRoleFamily(normalizedTitle),
    technologies: extractTechnologies(normalizedTitle),
    seniority: extractSeniority(normalizedTitle),
  };
}

// ─── Step 6 & 7: Structured Role Comparison ───────────────────────────────────

// Engineer ↔ Developer equivalence: these words are interchangeable in title context
const ROLE_WORD_EQUIVALENCES: string[][] = [
  ["engineer", "developer", "programmer", "coder"],
  ["software engineer", "software developer"],
  ["backend engineer", "backend developer", "back end engineer", "back end developer"],
  ["frontend engineer", "frontend developer", "front end engineer", "front end developer"],
];

function areRoleFamiliesCompatible(required: RoleFamily, actual: RoleFamily): boolean | null {
  // Exact match
  if (required === actual) return true;

  // Either is UNKNOWN → can't determine
  if (required === "UNKNOWN" || actual === "UNKNOWN") return null;

  // FULLSTACK is compatible with both BACKEND and FRONTEND
  if (required === "FULLSTACK" && (actual === "BACKEND" || actual === "FRONTEND")) return null; // ambiguous
  if (actual === "FULLSTACK" && (required === "BACKEND" || required === "FRONTEND")) return null; // ambiguous

  // Different known families → incompatible
  return false;
}

function areTechnologiesCompatible(requiredTechs: string[], actualTechs: string[]): boolean | null {
  // No required tech → any tech is fine
  if (requiredTechs.length === 0) return true;

  // No actual tech → can't determine
  if (actualTechs.length === 0) return null;

  // Check if required technologies are present in actual
  const hasAllRequired = requiredTechs.every((rt) => actualTechs.includes(rt));
  if (hasAllRequired) return true;

  // Check for conflicting technology (different language in same category)
  // e.g., required "java" but actual has "python" and NOT "java"
  const languageTechs = [
    "java",
    "python",
    "javascript",
    "typescript",
    "go",
    "rust",
    "c++",
    "c#",
    "ruby",
    "php",
    "scala",
    "kotlin",
    "swift",
    "dart",
  ];
  const requiredLangs = requiredTechs.filter((t) => languageTechs.includes(t));
  const actualLangs = actualTechs.filter((t) => languageTechs.includes(t));

  if (requiredLangs.length > 0 && actualLangs.length > 0) {
    const hasRequiredLang = requiredLangs.some((rl) => actualLangs.includes(rl));
    if (!hasRequiredLang) {
      // Has a different language explicitly → NO_MATCH
      return false;
    }
  }

  // Required tech not found but no conflicting tech → unknown
  return null;
}

function areSenioritiesCompatible(required: Seniority, actual: Seniority): boolean | null {
  // If required seniority is UNKNOWN, we don't constrain seniority
  if (required === "UNKNOWN") return true;
  // If actual seniority is UNKNOWN, we can't determine
  if (actual === "UNKNOWN") return null;
  // Same seniority → match
  if (required === actual) return true;

  // Define seniority levels for comparison
  const levels: Seniority[] = [
    "INTERN",
    "ENTRY",
    "JUNIOR",
    "MID",
    "SENIOR",
    "LEAD",
    "STAFF",
    "PRINCIPAL",
    "ARCHITECT",
    "MANAGER",
    "DIRECTOR",
  ];
  const reqIdx = levels.indexOf(required);
  const actIdx = levels.indexOf(actual);

  // Adjacent levels are acceptable (MID↔SENIOR, SENIOR↔LEAD)
  if (Math.abs(reqIdx - actIdx) <= 1) return true;

  // Far apart → incompatible
  return false;
}

export function compareRoles(required: ParsedRole, actual: ParsedRole): RoleComparisonResult {
  const roleFamilyMatch = areRoleFamiliesCompatible(required.roleFamily, actual.roleFamily);
  const technologyMatch = areTechnologiesCompatible(required.technologies, actual.technologies);
  const seniorityMatch = areSenioritiesCompatible(required.seniority, actual.seniority);

  // ── Decision logic ──────────────────────────────────────────────────────

  // DEFINITE NO_MATCH: role family is known and incompatible
  if (roleFamilyMatch === false) {
    return {
      result: "NO_MATCH",
      reason: `Role family ${actual.roleFamily} conflicts with required ${required.roleFamily} role.`,
      requiredParsed: required,
      actualParsed: actual,
      roleFamilyMatch,
      technologyMatch,
      seniorityMatch,
    };
  }

  // DEFINITE NO_MATCH: technology is known and conflicting
  if (technologyMatch === false) {
    const reqTech = required.technologies.join(", ");
    const actTech = actual.technologies.join(", ");
    return {
      result: "NO_MATCH",
      reason: `Technology ${actTech} does not match required ${reqTech}.`,
      requiredParsed: required,
      actualParsed: actual,
      roleFamilyMatch,
      technologyMatch,
      seniorityMatch,
    };
  }

  // DEFINITE NO_MATCH: seniority is known and incompatible
  if (seniorityMatch === false) {
    return {
      result: "NO_MATCH",
      reason: `Seniority ${actual.seniority} is incompatible with required ${required.seniority}.`,
      requiredParsed: required,
      actualParsed: actual,
      roleFamilyMatch,
      technologyMatch,
      seniorityMatch,
    };
  }

  // STRONG MATCH: role family matches AND required technology present
  if (roleFamilyMatch === true && technologyMatch === true) {
    const parts: string[] = [];
    parts.push(`Role family matches ${required.roleFamily}`);
    if (required.technologies.length > 0) {
      parts.push(
        `required technology ${required.technologies.join(", ").toUpperCase()} is present`,
      );
    }
    return {
      result: "MATCH",
      reason: parts.join(" and ") + ".",
      requiredParsed: required,
      actualParsed: actual,
      roleFamilyMatch,
      technologyMatch,
      seniorityMatch,
    };
  }

  // MATCH: role family matches, no tech requirement or tech is unknown
  if (roleFamilyMatch === true && (technologyMatch === true || technologyMatch === null)) {
    let reason = `Role family matches ${required.roleFamily}`;
    if (technologyMatch === null && required.technologies.length > 0) {
      reason += `, but required technology ${required.technologies.join(", ").toUpperCase()} could not be confirmed`;
    }
    return {
      result: technologyMatch === null && required.technologies.length > 0 ? "UNKNOWN" : "MATCH",
      reason: reason + ".",
      requiredParsed: required,
      actualParsed: actual,
      roleFamilyMatch,
      technologyMatch,
      seniorityMatch,
    };
  }

  // UNKNOWN: role family is unknown but technology matches
  if (roleFamilyMatch === null && technologyMatch === true) {
    return {
      result: "UNKNOWN",
      reason: `Role family could not be reliably determined from the title. Required technology ${required.technologies.join(", ").toUpperCase()} is present.`,
      requiredParsed: required,
      actualParsed: actual,
      roleFamilyMatch,
      technologyMatch,
      seniorityMatch,
    };
  }

  // UNKNOWN: everything is ambiguous
  return {
    result: "UNKNOWN",
    reason: "Role family could not be reliably determined from the available evidence.",
    requiredParsed: required,
    actualParsed: actual,
    roleFamilyMatch,
    technologyMatch,
    seniorityMatch,
  };
}

// ─── Main Entry Point: Match a role against a requirement ─────────────────────

// In-memory cache for role matching results
// Key: "normalizedRequired|normalizedActual" → result
const roleMatchCache = new Map<string, RoleComparisonResult>();
const ROLE_CACHE_MAX_SIZE = 500;

/**
 * Determines if an actual job title matches a required role specification.
 * Returns MATCH, NO_MATCH, or UNKNOWN with a human-readable explanation.
 *
 * This function is deterministic and does NOT call Mistral.
 * Results are cached to avoid re-classification of identical title pairs.
 * For ambiguous cases (UNKNOWN), the caller can optionally invoke Mistral
 * for semantic classification.
 */
export function matchRole(requiredRole: string, actualRole: string): RoleComparisonResult {
  const cacheKey = `${normalizeTitle(requiredRole)}|${normalizeTitle(actualRole)}`;

  const cached = roleMatchCache.get(cacheKey);
  if (cached) return cached;

  const required = parseRole(requiredRole);
  const actual = parseRole(actualRole);
  const result = compareRoles(required, actual);

  // Evict oldest entries if cache is too large
  if (roleMatchCache.size >= ROLE_CACHE_MAX_SIZE) {
    const firstKey = roleMatchCache.keys().next().value;
    if (firstKey !== undefined) roleMatchCache.delete(firstKey);
  }
  roleMatchCache.set(cacheKey, result);

  return result;
}

/** Clear the role match cache (for testing) */
export function clearRoleMatchCache(): void {
  roleMatchCache.clear();
}
