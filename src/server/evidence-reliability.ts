/**
 * ═════════════════════════════════════════════════════════════════════════════
 * DataIntel — Multi-Dimensional Evidence Reliability Engine
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Implements a transparent, calibrated, deterministic evidence reliability
 * scoring system based on actual evidence and verification quality.
 *
 * Principles:
 * 1. Not a subjective LLM confidence score — represents verifiable evidence reliability.
 * 2. Multi-dimensional: Required-field coverage, Evidence directness, Source quality,
 *    Source agreement/independence, Freshness, Extraction reliability, Entity consistency,
 *    and Conflict penalties.
 * 3. Dynamic required fields from user request — no hardcoded field lists.
 * 4. Generic source quality classification — no hardcoded company domains.
 * 5. Independent from qualification status (a record can be QUALIFIED + 92% or
 *    QUALIFIED + 68%, or NEEDS_VERIFICATION + 45%).
 * 6. High score (>50%) naturally emerges from strong, verified, primary evidence.
 */

import type { DatasetRecord, Evidence, Conflict, EvidenceBreakdown } from "../lib/pipeline-schema";
import type { StructuredConstraint } from "../lib/workflow-schema";
import { matchRole } from "./role-matcher";

// ─── Directness Level ────────────────────────────────────────────────────────
export type DirectnessLevel = "DIRECT" | "INDIRECT" | "WEAK" | "MISSING";

export interface FieldDirectnessResult {
  level: DirectnessLevel;
  score: number;
  snippet?: string;
  reason: string;
}

// ─── Source Quality Tier ──────────────────────────────────────────────────────
export type SourceTier =
  | "PRIMARY_OFFICIAL"
  | "AUTHORITATIVE"
  | "ESTABLISHED_PLATFORM"
  | "SECONDARY_SOURCE"
  | "AGGREGATOR"
  | "SEARCH_SNIPPET";

export interface SourceQualityResult {
  tier: SourceTier;
  score: number;
  domain: string;
  reason: string;
}

// ─── Freshness Status ─────────────────────────────────────────────────────────
export type FreshnessStatus = "RECENT" | "MODERATE" | "AGED" | "UNKNOWN";

export interface FreshnessResult {
  status: FreshnessStatus;
  score: number;
  reason: string;
}

// ─── Reliability Result ───────────────────────────────────────────────────────
export interface ReliabilityResult {
  reliabilityScore: number;
  breakdown: EvidenceBreakdown;
  verificationGrade: "High" | "Moderate" | "Low" | "Unverified";
  directnessMap: Record<string, DirectnessLevel>;
  sourceDetails: SourceQualityResult[];
  explanation: string;
}

// ─── Cache ────────────────────────────────────────────────────────────────────
// LRU-style in-memory cache for source quality evaluations
const sourceQualityCache = new Map<string, SourceQualityResult>();
const SOURCE_CACHE_MAX = 500;

function getCachedSourceQuality(url: string, entityName: string): SourceQualityResult | null {
  const key = `${url.toLowerCase().trim()}|${entityName.toLowerCase().trim()}`;
  return sourceQualityCache.get(key) || null;
}

function setCachedSourceQuality(
  url: string,
  entityName: string,
  result: SourceQualityResult,
): void {
  if (sourceQualityCache.size >= SOURCE_CACHE_MAX) {
    const firstKey = sourceQualityCache.keys().next().value;
    if (firstKey) sourceQualityCache.delete(firstKey);
  }
  const key = `${url.toLowerCase().trim()}|${entityName.toLowerCase().trim()}`;
  sourceQualityCache.set(key, result);
}

// ─── Domain & URL Extraction Helper ───────────────────────────────────────────
export function extractRootDomain(urlOrDomain: string): string {
  if (!urlOrDomain) return "";
  let clean = urlOrDomain.trim().toLowerCase();
  try {
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      clean = "https://" + clean;
    }
    const parsed = new URL(clean);
    const host = parsed.hostname.replace(/^www\./, "");
    // Extract root domain (e.g. "careers.infosys.com" -> "infosys.com", "jobs.lever.co" -> "lever.co")
    const parts = host.split(".");
    if (parts.length > 2) {
      // Handle co.in, co.uk, gov.in etc.
      const secondTld = parts[parts.length - 2];
      if (
        secondTld &&
        ["co", "gov", "ac", "nic", "org", "edu"].includes(secondTld) &&
        parts.length > 2
      ) {
        return parts.slice(-3).join(".");
      }
      return parts.slice(-2).join(".");
    }
    return host;
  } catch {
    return (
      urlOrDomain
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0] || ""
    );
  }
}

// ─── Generic Source Quality Evaluator ────────────────────────────────────────
/**
 * Evaluates source quality generically based on domain characteristics, URL structure,
 * and entity relationship — without hardcoding specific company domains.
 */
export function evaluateSourceQuality(
  url: string,
  sourceName = "",
  entityName = "",
): SourceQualityResult {
  const cached = getCachedSourceQuality(url, entityName);
  if (cached) return cached;

  if (!url || url === "—" || url === "Web Source") {
    const result: SourceQualityResult = {
      tier: "SEARCH_SNIPPET",
      score: 30,
      domain: "",
      reason: "No source URL available; search snippet only",
    };
    return result;
  }

  let domain = "";
  let pathname = "";
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    domain = parsed.hostname.replace(/^www\./, "").toLowerCase();
    pathname = parsed.pathname.toLowerCase();
  } catch {
    domain =
      url
        .toLowerCase()
        .split("/")[0]
        ?.replace(/^www\./, "") || "";
  }

  const rootDomain = extractRootDomain(domain);
  const normalizedEntity = entityName.toLowerCase().replace(/[^a-z0-9]/g, "");

  // 1. PRIMARY / OFFICIAL SOURCE:
  // - Domain matches entity name (e.g. entity: "Infosys", domain: "infosys.com" or "careers.infosys.com")
  // - Or ATS direct company subdomain/slug: e.g. "lever.co", "greenhouse.io", "myworkdayjobs.com", "ashbyhq.com"
  const domainTokens = domain.split(/[.-]/);
  const entityMatchesDomain =
    normalizedEntity.length >= 3 &&
    domainTokens.some(
      (tok) => tok === normalizedEntity || (tok.length >= 4 && normalizedEntity.includes(tok)),
    );

  const isAtsPlatform = [
    "myworkdayjobs.com",
    "lever.co",
    "greenhouse.io",
    "ashbyhq.com",
    "smartrecruiters.com",
    "bamboohr.com",
    "workable.com",
    "jobvite.com",
    "icims.com",
    "breezy.hr",
    "rippling-ats.com",
    "recruitee.com",
  ].some((ats) => domain.includes(ats));

  const hasCareerPath =
    pathname.includes("/career") ||
    pathname.includes("/jobs") ||
    pathname.includes("/job/") ||
    pathname.includes("/opening") ||
    pathname.includes("/apply") ||
    pathname.includes("/work-with-us") ||
    domain.startsWith("careers.") ||
    domain.startsWith("jobs.");

  if (
    (entityMatchesDomain && (hasCareerPath || domain.includes(normalizedEntity))) ||
    (isAtsPlatform && (entityMatchesDomain || pathname.includes(normalizedEntity)))
  ) {
    const result: SourceQualityResult = {
      tier: "PRIMARY_OFFICIAL",
      score: 96,
      domain,
      reason: "Official company careers portal / direct employer application",
    };
    setCachedSourceQuality(url, entityName, result);
    return result;
  }

  // 2. AUTHORITATIVE / REGULATORY / INSTITUTIONAL:
  // Government (.gov, .nic.in), University/Academic (.edu, .ac.in), official registries
  if (
    domain.endsWith(".gov") ||
    domain.includes(".gov.") ||
    domain.includes(".nic.in") ||
    domain.endsWith(".edu") ||
    domain.includes(".edu.") ||
    domain.includes(".ac.in")
  ) {
    const result: SourceQualityResult = {
      tier: "AUTHORITATIVE",
      score: 92,
      domain,
      reason: "Official regulatory, institutional, or government domain",
    };
    setCachedSourceQuality(url, entityName, result);
    return result;
  }

  // 3. ESTABLISHED TRUSTED PLATFORM:
  // Major recognized employment networks with direct employer postings
  const isEstablishedJobPlatform = [
    "linkedin.com",
    "indeed.com",
    "naukri.com",
    "glassdoor.com",
    "wellfound.com",
    "angellist.com",
    "monster.com",
    "dice.com",
    "builtina.com",
    "github.com",
    "hired.com",
    "efinancialcareers.com",
    "stackoverflow.com",
  ].some((platform) => domain.includes(platform));

  if (isEstablishedJobPlatform) {
    const result: SourceQualityResult = {
      tier: "ESTABLISHED_PLATFORM",
      score: 86,
      domain,
      reason: "Established, recognized recruitment or employment platform",
    };
    setCachedSourceQuality(url, entityName, result);
    return result;
  }

  // 4. AGGREGATOR / SCRAPER BOARD:
  // Third-party syndicators, repost aggregators, scrape boards
  const isAggregator = [
    "jooble.org",
    "jooble.com",
    "talent.com",
    "neuvoo",
    "adzuna",
    "salary.com",
    "ambitionbox.com",
    "mouthshut.com",
    "jobrapido",
    "simplyhired",
    "postings",
    "classifieds",
    "zwayam",
    "jobisjob",
  ].some((agg) => domain.includes(agg));

  if (isAggregator) {
    const result: SourceQualityResult = {
      tier: "AGGREGATOR",
      score: 50,
      domain,
      reason: "Third-party job aggregator or syndicated scrape board",
    };
    setCachedSourceQuality(url, entityName, result);
    return result;
  }

  // 5. SEARCH ENGINE / SNIPPET ONLY:
  const isSearchEngine = [
    "google.com",
    "google.co.in",
    "bing.com",
    "duckduckgo.com",
    "yahoo.com",
    "search.",
  ].some((se) => domain.includes(se));

  if (isSearchEngine || domain === "") {
    const result: SourceQualityResult = {
      tier: "SEARCH_SNIPPET",
      score: 30,
      domain,
      reason: "Generic search engine result snippet; no resolved landing page",
    };
    setCachedSourceQuality(url, entityName, result);
    return result;
  }

  // 6. SECONDARY SOURCE:
  // Reputable domain, tech news, company blog, or business publication
  const result: SourceQualityResult = {
    tier: "SECONDARY_SOURCE",
    score: 72,
    domain,
    reason: "Secondary source or corporate website",
  };
  setCachedSourceQuality(url, entityName, result);
  return result;
}

// ─── Evidence Directness Evaluator ───────────────────────────────────────────
/**
 * Evaluates evidence directness for a specific field:
 * DIRECT: Explicit factual assertion in snippet in context of entity/job.
 * INDIRECT: Related contextual mention or inferred from broader text.
 * WEAK: Generic text (e.g. "Infosys is an IT company") or short/boilerplate.
 * MISSING: No evidence found for the field.
 */
export function evaluateFieldDirectness(
  field: string,
  fieldValue: string | null,
  evidenceList: Evidence[],
  entityName: string,
): FieldDirectnessResult {
  if (
    !fieldValue ||
    fieldValue === "—" ||
    fieldValue.toLowerCase() === "not disclosed" ||
    fieldValue.toLowerCase() === "unknown"
  ) {
    return {
      level: "MISSING",
      score: 0,
      reason: `No value or evidence found for ${field}`,
    };
  }

  const fNorm = field.toLowerCase().replace(/[^a-z0-9]/g, "");
  const vNorm = fieldValue.toLowerCase().trim();

  // Find evidence items attached to this field or "General" evidence
  const matchingEv = evidenceList.filter((e) => {
    const eFieldNorm = e.field.toLowerCase().replace(/[^a-z0-9]/g, "");
    return (
      eFieldNorm === fNorm ||
      eFieldNorm.includes(fNorm) ||
      fNorm.includes(eFieldNorm) ||
      (e.field.toLowerCase() === "general" && e.snippet?.toLowerCase().includes(vNorm))
    );
  });

  if (matchingEv.length === 0) {
    // Check if any evidence snippet mentions the value directly
    const anyMention = evidenceList.find(
      (e) => e.snippet && e.snippet.toLowerCase().includes(vNorm),
    );
    if (anyMention && anyMention.snippet) {
      return {
        level: "INDIRECT",
        score: 60,
        snippet: anyMention.snippet,
        reason: `Value found in general evidence snippet rather than field-specific citation`,
      };
    }
    return {
      level: "MISSING",
      score: 0,
      reason: `No evidence citation found for ${field}`,
    };
  }

  // Inspect the highest quality matching evidence item
  let bestLevel: DirectnessLevel = "WEAK";
  let bestScore = 25;
  let bestReason = "Generic or minimal citation";
  let bestSnippet = "";

  for (const ev of matchingEv) {
    const snippet = ev.snippet ? ev.snippet.trim() : "";
    const snipLower = snippet.toLowerCase();

    // Check for weak/generic text
    const isVeryShort = snippet.length < 15;
    const isGenericBoilerplate =
      snipLower.includes("cookie policy") ||
      snipLower.includes("privacy policy") ||
      snipLower.includes("all rights reserved") ||
      snipLower.includes("terms of service") ||
      snipLower.includes("click here to apply") ||
      (snipLower.includes("technology company") && fNorm.includes("role"));

    if (isVeryShort || isGenericBoilerplate) {
      if (bestScore < 25) {
        bestLevel = "WEAK";
        bestScore = 25;
        bestReason = "Evidence snippet is generic boilerplate or too short";
        bestSnippet = snippet;
      }
      continue;
    }

    // Check for DIRECT evidence:
    // Snippet directly contains the value (or key tokens of the value) in context
    const containsValue = snipLower.includes(vNorm);
    const entityTokens = entityName
      .toLowerCase()
      .split(/[\s,.-]+/)
      .filter((t) => t.length > 2);
    const mentionsEntity = entityTokens.some((t) => snipLower.includes(t));

    // For numeric/experience/salary fields: check if range or number appears
    let hasFieldSpecificAssertion = containsValue;
    if (!containsValue && (fNorm.includes("experience") || fNorm.includes("exp"))) {
      const expMatch = snippet.match(/\b\d+(?:\s*[-–—to]+\s*\d+)?\s*(?:years?|yrs?)\b/i);
      if (expMatch) hasFieldSpecificAssertion = true;
    } else if (!containsValue && (fNorm.includes("role") || fNorm.includes("title"))) {
      // Role matching semantic check
      const roleCmp = matchRole(fieldValue, snippet);
      if (roleCmp.result === "MATCH") hasFieldSpecificAssertion = true;
    }

    if (hasFieldSpecificAssertion) {
      // Direct assertion: explicit field value asserted
      bestLevel = "DIRECT";
      bestScore = 100;
      bestReason = `Direct source quote confirms ${field}: "${fieldValue}"`;
      bestSnippet = snippet;
      break; // Highest possible directness reached
    } else if (snippet.length >= 25) {
      // Indirect: contextual mention
      if (bestScore < 65) {
        bestLevel = "INDIRECT";
        bestScore = 65;
        bestReason = `Contextual mention supporting ${field}`;
        bestSnippet = snippet;
      }
    }
  }

  return {
    level: bestLevel,
    score: bestScore,
    snippet: bestSnippet,
    reason: bestReason,
  };
}

// ─── Source Agreement & Independence Evaluator ──────────────────────────────
/**
 * Evaluates agreement across independent sources:
 * - Groups by root domain to avoid counting mirrors as independent confirmations.
 * - Checks snippet textual similarity to detect syndicated reposts.
 */
export function evaluateSourceAgreement(
  evidenceList: Evidence[],
  conflicts: Conflict[],
  entityName: string,
): { score: number; independentSources: number; mirrorCount: number; reason: string } {
  if (conflicts.length > 0) {
    return {
      score: 35,
      independentSources: 1,
      mirrorCount: 0,
      reason: `Contradictions detected across sources for: ${conflicts.map((c) => c.field).join(", ")}`,
    };
  }

  if (evidenceList.length === 0) {
    return {
      score: 20,
      independentSources: 0,
      mirrorCount: 0,
      reason: "No sources available to evaluate agreement",
    };
  }

  // Extract root domains
  const domainGroups = new Map<string, Evidence[]>();
  for (const ev of evidenceList) {
    const root = extractRootDomain(ev.url || ev.source);
    if (!root) continue;
    const group = domainGroups.get(root) || [];
    group.push(ev);
    domainGroups.set(root, group);
  }

  const distinctRoots = Array.from(domainGroups.keys());

  // Check snippet similarity across different domains to detect aggregator mirrors
  let mirrorCount = 0;
  const verifiedIndependentDomains: string[] = [];

  for (let i = 0; i < distinctRoots.length; i++) {
    const domA = distinctRoots[i]!;
    const snippetA = domainGroups.get(domA)?.[0]?.snippet || "";
    let isMirror = false;

    for (let j = 0; j < verifiedIndependentDomains.length; j++) {
      const domB = verifiedIndependentDomains[j]!;
      const snippetB = domainGroups.get(domB)?.[0]?.snippet || "";

      if (snippetA && snippetB && snippetA.length > 30 && snippetB.length > 30) {
        // Simple Jaccard similarity on 4-grams or word tokens
        const wordsA = new Set(snippetA.toLowerCase().split(/\s+/));
        const wordsB = new Set(snippetB.toLowerCase().split(/\s+/));
        let intersect = 0;
        for (const w of wordsA) if (wordsB.has(w)) intersect++;
        const union = wordsA.size + wordsB.size - intersect;
        const jaccard = union > 0 ? intersect / union : 0;
        if (jaccard > 0.85) {
          isMirror = true;
          mirrorCount++;
          break;
        }
      }
    }

    if (!isMirror) {
      verifiedIndependentDomains.push(domA);
    }
  }

  const independentCount = verifiedIndependentDomains.length;

  if (independentCount >= 3) {
    return {
      score: 98,
      independentSources: independentCount,
      mirrorCount,
      reason: `${independentCount} independent sources confirmed key claims without contradiction`,
    };
  } else if (independentCount === 2) {
    return {
      score: 92,
      independentSources: independentCount,
      mirrorCount,
      reason: `2 independent agreeing sources confirmed key claims`,
    };
  } else if (independentCount === 1) {
    // Single source: evaluate tier of that single source
    const singleUrl = evidenceList[0]?.url || "";
    const tier = evaluateSourceQuality(singleUrl, "", entityName);
    if (tier.tier === "PRIMARY_OFFICIAL") {
      return {
        score: 85,
        independentSources: 1,
        mirrorCount,
        reason: `Single official primary source (high inherent authority)`,
      };
    } else if (tier.tier === "ESTABLISHED_PLATFORM") {
      return {
        score: 80,
        independentSources: 1,
        mirrorCount,
        reason: `Single established platform posting`,
      };
    } else if (tier.tier === "SECONDARY_SOURCE") {
      return {
        score: 65,
        independentSources: 1,
        mirrorCount,
        reason: `Single secondary source`,
      };
    } else {
      return {
        score: 45,
        independentSources: 1,
        mirrorCount,
        reason: `Single unverified source or aggregator`,
      };
    }
  }

  return {
    score: 30,
    independentSources: 0,
    mirrorCount: 0,
    reason: "Insufficient source independence",
  };
}

// ─── Entity Consistency Evaluator ───────────────────────────────────────────
/**
 * Verifies that all evidence items refer to the same primary entity / job.
 * Detects cross-entity contamination (Company A + Job B chimera).
 */
export function evaluateEntityConsistency(record: DatasetRecord): {
  score: number;
  isConsistent: boolean;
  reason: string;
} {
  const entityName = record.entityName || record.company || "";
  if (!entityName || entityName === "—") {
    return {
      score: 50,
      isConsistent: false,
      reason: "No entity identity established",
    };
  }

  const normEntity = entityName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const entityTokens = entityName
    .toLowerCase()
    .split(/[\s,.-]+/)
    .filter(
      (t) =>
        t.length > 2 &&
        !["pvt", "ltd", "inc", "private", "limited", "corp", "technologies", "services"].includes(
          t,
        ),
    );

  let inconsistentCitations = 0;
  let totalSubstantive = 0;

  for (const ev of record.evidence) {
    if (!ev.snippet || ev.snippet.length < 20) continue;
    totalSubstantive++;
    const snip = ev.snippet.toLowerCase();

    // Check if snippet explicitly names a DIFFERENT well-known conflicting company
    // while omitting the primary entity
    const mentionsEntity = entityTokens.some((t) => snip.includes(t));
    if (!mentionsEntity) {
      // Check if source URL domain matches the entity
      const root = extractRootDomain(ev.url);
      const domainMatches = entityTokens.some((t) => root.includes(t));
      if (!domainMatches) {
        // Snippet doesn't mention entity and domain doesn't match entity
        // If snippet prominently features another company name:
        const otherCompanyPattern = /\b(?:at|for|by|join|with|careers\s+at)\s+([A-Za-z0-9]+)\b/i;
        const match = ev.snippet.match(otherCompanyPattern);
        if (match && match[1]) {
          const detectedComp = match[1].toLowerCase().replace(/[^a-z0-9]/g, "");
          const stopWords = new Set([
            "as",
            "in",
            "at",
            "for",
            "with",
            "a",
            "an",
            "the",
            "to",
            "on",
            "of",
            "and",
            "is",
            "are",
            "our",
            "their",
          ]);
          if (
            !stopWords.has(detectedComp) &&
            detectedComp.length >= 3 &&
            detectedComp !== normEntity &&
            !normEntity.includes(detectedComp) &&
            !detectedComp.includes(normEntity)
          ) {
            inconsistentCitations++;
          }
        }
      }
    }
  }

  if (inconsistentCitations > 0) {
    return {
      score: 25,
      isConsistent: false,
      reason: `Possible entity contamination: evidence mentions conflicting organization name`,
    };
  }

  return {
    score: 100,
    isConsistent: true,
    reason: `All substantive evidence citations associate consistently with ${entityName}`,
  };
}

// ─── Extraction Reliability Evaluator ───────────────────────────────────────
/**
 * Evaluates extraction reliability:
 * Distinguishes direct quotes, normalized values, semantic matches, and inferred values.
 */
export function evaluateExtractionReliability(
  record: DatasetRecord,
  structuredConstraints: StructuredConstraint[],
): { score: number; reason: string } {
  const attributes = record.attributes || {};
  const entries = Object.entries(attributes).filter(
    ([_, v]) => v !== null && v !== undefined && v !== "—" && v !== "Not disclosed",
  );

  if (entries.length === 0) {
    return { score: 40, reason: "No extracted attributes to evaluate" };
  }

  let totalFieldReliability = 0;

  for (const [field, val] of entries) {
    const fNorm = field.toLowerCase().replace(/[^a-z0-9]/g, "");
    const matchingEv = record.evidence.find((e) => {
      const eFieldNorm = e.field.toLowerCase().replace(/[^a-z0-9]/g, "");
      return eFieldNorm === fNorm || eFieldNorm.includes(fNorm);
    });

    if (!matchingEv || !matchingEv.snippet) {
      totalFieldReliability += 50; // Inferred or unsupported
      continue;
    }

    const snip = matchingEv.snippet.toLowerCase();
    const valLower = String(val).toLowerCase().trim();

    if (snip.includes(valLower)) {
      // Direct literal extraction
      totalFieldReliability += 100;
    } else if (fNorm.includes("experience") || fNorm.includes("salary") || fNorm.includes("size")) {
      // Numerically parsed / normalized value
      totalFieldReliability += 92;
    } else if (fNorm.includes("role") || fNorm.includes("title")) {
      // Semantic role match
      const cmp = matchRole(String(val), snip);
      totalFieldReliability += cmp.result === "MATCH" ? 88 : 60;
    } else {
      totalFieldReliability += 75;
    }
  }

  const score = Math.round(totalFieldReliability / entries.length);
  return {
    score,
    reason: `Average extraction fidelity across ${entries.length} attributes`,
  };
}

// ─── Freshness Evaluator ────────────────────────────────────────────────────
/**
 * Evaluates evidence freshness:
 * - Does not invent posting dates.
 * - Recent evidence: 95%
 * - Undated: UNKNOWN (70% - neutral, does not invalidate unless requested).
 */
export function evaluateFreshness(
  evidenceList: Evidence[],
  isFreshnessRequired = false,
): FreshnessResult {
  const dates: Date[] = [];
  const now = new Date();

  for (const ev of evidenceList) {
    if (ev.retrieved) {
      const d = new Date(ev.retrieved);
      if (!isNaN(d.getTime())) dates.push(d);
    }
    // Check snippet for date mentions e.g. "2026-09", "posted 3 days ago"
    if (ev.snippet) {
      const daysAgoMatch = ev.snippet.match(/(\d+)\s+days?\s+ago/i);
      if (daysAgoMatch && daysAgoMatch[1]) {
        const days = parseInt(daysAgoMatch[1], 10);
        const inferred = new Date(now.getTime() - days * 86400000);
        dates.push(inferred);
      }
    }
  }

  if (dates.length === 0) {
    return {
      status: "UNKNOWN",
      score: 70, // Neutral
      reason: "Posting date unknown (neutral rating; freshness was not strictly disproven)",
    };
  }

  // Find most recent date
  const mostRecent = new Date(Math.max(...dates.map((d) => d.getTime())));
  const diffDays = Math.max(
    0,
    Math.floor((now.getTime() - mostRecent.getTime()) / (1000 * 60 * 60 * 24)),
  );

  if (diffDays <= 30) {
    return {
      status: "RECENT",
      score: 95,
      reason: `Verified fresh evidence (within last ${diffDays} days)`,
    };
  } else if (diffDays <= 90) {
    return {
      status: "MODERATE",
      score: 80,
      reason: `Evidence retrieved within last 90 days (${diffDays} days ago)`,
    };
  } else {
    return {
      status: "AGED",
      score: isFreshnessRequired ? 40 : 60,
      reason: `Evidence is over 90 days old (${diffDays} days ago)`,
    };
  }
}

// ─── Main Composite Reliability Calculator ──────────────────────────────────
/**
 * Calculates the multi-dimensional Evidence Reliability score (0-100)
 * and detailed breakdown for a dataset record.
 */
export function calculateEvidenceReliability(
  record: DatasetRecord,
  requiredFields: string[] = [],
  structuredConstraints: StructuredConstraint[] = [],
  userPrompt = "",
): ReliabilityResult {
  const entityName = record.entityName || record.company || "Record";

  // 1. Dynamic Required Fields & Coverage
  // If user requested specific constraints or required fields, use them as denominator.
  // Otherwise, fallback to the non-null extracted fields.
  const dynamicRequired =
    requiredFields.length > 0
      ? requiredFields
      : structuredConstraints.length > 0
        ? [...new Set(structuredConstraints.map((c) => c.field))]
        : ["Role", "Location", "Experience"];

  // Evaluate directness for all dynamic required fields
  const directnessMap: Record<string, DirectnessLevel> = {};
  let directnessSum = 0;
  let supportedRequiredCount = 0;

  for (const field of dynamicRequired) {
    const fLower = field.toLowerCase().replace(/[^a-z0-9]/g, "");
    // Find attribute value
    let val: string | null = null;
    if (record.attributes && record.attributes[field] !== undefined) {
      val = record.attributes[field];
    } else if (record.attributes) {
      for (const [k, v] of Object.entries(record.attributes)) {
        if (k.toLowerCase().replace(/[^a-z0-9]/g, "") === fLower) {
          val = v;
          break;
        }
      }
    }
    if (!val) {
      // Legacy fallback
      if (fLower.includes("role") || fLower.includes("title"))
        val = record.role !== "—" ? record.role : null;
      else if (fLower.includes("location") || fLower.includes("city"))
        val = record.location !== "—" ? record.location : null;
      else if (fLower.includes("exp")) val = record.experience !== "—" ? record.experience : null;
      else if (fLower.includes("company") || fLower.includes("brand")) val = record.company || null;
    }

    const dirResult = evaluateFieldDirectness(field, val, record.evidence, entityName);
    directnessMap[field] = dirResult.level;
    directnessSum += dirResult.score;

    if (dirResult.level === "DIRECT" || dirResult.level === "INDIRECT") {
      supportedRequiredCount++;
    }
  }

  const requiredFieldSupport = Math.round(
    (supportedRequiredCount / Math.max(1, dynamicRequired.length)) * 100,
  );
  const evidenceDirectness = Math.round(directnessSum / Math.max(1, dynamicRequired.length));

  // 2. Source Quality
  // Evaluate the primary source URL plus all evidence URLs
  const allUrls = [
    record.attributes?.["Source URL"] || "",
    ...record.evidence.map((e) => e.url),
    record.source,
  ].filter((u) => u && u !== "—" && u !== "Web Source");

  const sourceEvaluations: SourceQualityResult[] = [];
  if (allUrls.length > 0) {
    for (const u of [...new Set(allUrls)]) {
      sourceEvaluations.push(evaluateSourceQuality(u, record.source, entityName));
    }
  } else {
    sourceEvaluations.push(evaluateSourceQuality("", record.source, entityName));
  }

  // Use the best available source tier as primary source quality, with average of others
  const bestSourceScore = Math.max(...sourceEvaluations.map((s) => s.score));
  const avgSourceScore = Math.round(
    sourceEvaluations.reduce((sum, s) => sum + s.score, 0) / sourceEvaluations.length,
  );
  const sourceQuality = Math.round(bestSourceScore * 0.7 + avgSourceScore * 0.3);

  // 3. Source Agreement & Independence
  const agreementResult = evaluateSourceAgreement(
    record.evidence,
    record.conflicts || (record.conflict ? [record.conflict] : []),
    entityName,
  );
  const sourceAgreement = agreementResult.score;

  // 4. Entity Consistency
  const entityResult = evaluateEntityConsistency(record);
  const entityConsistency = entityResult.score;

  // 5. Extraction Reliability
  const extractionResult = evaluateExtractionReliability(record, structuredConstraints);
  const extractionReliability = extractionResult.score;

  // 6. Freshness
  const isFreshnessRequired =
    userPrompt.toLowerCase().includes("currently hiring") ||
    userPrompt.toLowerCase().includes("latest") ||
    userPrompt.toLowerCase().includes("active jobs") ||
    userPrompt.toLowerCase().includes("recent");
  const freshnessResult = evaluateFreshness(record.evidence, isFreshnessRequired);
  const freshness = freshnessResult.score;

  // 7. Penalties
  let conflictPenalty = 0;
  const hasConflicts =
    (record.conflicts && record.conflicts.length > 0) || (record.conflict && record.conflict.field);
  if (hasConflicts) {
    // Check if conflict is on a user-required field
    const conflictFields = (record.conflicts || []).map((c) => c.field.toLowerCase());
    if (record.conflict) conflictFields.push(record.conflict.field.toLowerCase());
    const isRequiredConflict = conflictFields.some((cf) =>
      dynamicRequired.some((dr) => dr.toLowerCase().includes(cf) || cf.includes(dr.toLowerCase())),
    );
    conflictPenalty = isRequiredConflict ? 35 : 15;
  }

  let inferencePenalty = 0;
  if (!entityResult.isConsistent) {
    inferencePenalty += 35; // Heavy penalty for cross-entity contamination
  }
  if (extractionReliability < 60) {
    inferencePenalty += 10;
  }
  const missingRequiredCount = dynamicRequired.filter((f) => directnessMap[f] === "MISSING").length;
  if (missingRequiredCount > 0) {
    inferencePenalty += missingRequiredCount * 6;
  }

  // ─── Composite Formula ─────────────────────────────────────────────────────
  // Weights (Total = 1.00):
  // Required Field Support: 30%
  // Evidence Directness:    20%
  // Source Quality:         20%
  // Source Agreement:       10%
  // Entity Consistency:     10%
  // Extraction Reliability: 10%
  const W_REQ = 0.3;
  const W_DIR = 0.2;
  const W_SRC = 0.2;
  const W_AGR = 0.1;
  const W_ENT = 0.1;
  const W_EXT = 0.1;

  let baseScore =
    W_REQ * requiredFieldSupport +
    W_DIR * evidenceDirectness +
    W_SRC * sourceQuality +
    W_AGR * sourceAgreement +
    W_ENT * entityConsistency +
    W_EXT * extractionReliability;

  // If freshness is explicitly requested by user, factor it in
  if (isFreshnessRequired) {
    baseScore = baseScore * 0.9 + freshness * 0.1;
  }

  const rawScore = baseScore - conflictPenalty - inferencePenalty;
  const finalScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  // Verification Grade
  let verificationGrade: ReliabilityResult["verificationGrade"];
  if (finalScore >= 80) verificationGrade = "High";
  else if (finalScore >= 60) verificationGrade = "Moderate";
  else if (finalScore >= 35) verificationGrade = "Low";
  else verificationGrade = "Unverified";

  // Score Formula string for traceability
  const formulaString = `0.30*Req(${requiredFieldSupport}%) + 0.20*Dir(${evidenceDirectness}%) + 0.20*Src(${sourceQuality}%) + 0.10*Agr(${sourceAgreement}%) + 0.10*Ent(${entityConsistency}%) + 0.10*Ext(${extractionReliability}%)${conflictPenalty > 0 ? ` - ConfPenalty(${conflictPenalty})` : ""}${inferencePenalty > 0 ? ` - InferPenalty(${inferencePenalty})` : ""}`;

  // Explanation Summary
  let summary = "";
  if (finalScore >= 80) {
    summary = `High reliability: Strong direct evidence from ${sourceEvaluations[0]?.tier.replace(/_/g, " ").toLowerCase() || "authoritative source"} with full required-field support.`;
  } else if (finalScore >= 60) {
    summary = `Moderate reliability: Evidence supports key claims, with some indirect citations or secondary source attribution.`;
  } else if (hasConflicts) {
    summary = `Contradiction detected: Sources disagree on factual claims (${conflictPenalty}pt conflict penalty).`;
  } else if (!entityResult.isConsistent) {
    summary = `Entity inconsistency detected: Sources appear to conflate multiple entities (${inferencePenalty}pt penalty).`;
  } else if (requiredFieldSupport < 50) {
    summary = `Incomplete evidence: Critical requested fields lack supporting citations (${dynamicRequired.filter((f) => directnessMap[f] === "MISSING").join(", ") || "missing fields"}).`;
  } else {
    summary = `Limited reliability: Weak snippet evidence without authoritative source confirmation.`;
  }

  const breakdown: EvidenceBreakdown = {
    requiredFieldSupport,
    evidenceDirectness,
    sourceQuality,
    sourceAgreement,
    freshness,
    freshnessStatus: freshnessResult.status,
    entityConsistency,
    extractionReliability,
    conflictPenalty,
    inferencePenalty,
    scoreFormula: formulaString,
    summary,
    directnessMap,
  };

  return {
    reliabilityScore: finalScore,
    breakdown,
    verificationGrade,
    directnessMap,
    sourceDetails: sourceEvaluations,
    explanation: summary,
  };
}
