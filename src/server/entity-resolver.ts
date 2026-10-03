/**
 * DATAINTEL — Non-Destructive Generalized Entity Resolution Engine
 *
 * Implements Requirement 6:
 * - Eliminates destructive deduplication.
 * - Never deduplicates solely on entityName.
 * - Rejects generic terms ("companies", "products", "jobs", "list", etc.) as unique entities.
 * - Generalized identity strategy:
 *   1. canonical entity name
 *   2. canonical domain
 *   3. canonical URL
 *   4. role / product specification
 *   5. contextual attributes (location, industry)
 * - If identity is ambiguous: DO NOT MERGE. Mark entityResolution = "AMBIGUOUS" and retain both.
 * - Every merge is recorded with an explainable reason.
 */

import type { DatasetRecord, Conflict } from "../lib/pipeline-schema";
import { matchRole } from "./role-matcher";

// Generic nouns that must NEVER be treated as unique entities
const GENERIC_ENTITY_TERMS = new Set([
  "companies",
  "company",
  "software companies",
  "saas companies",
  "tech companies",
  "technology companies",
  "firms",
  "organizations",
  "businesses",
  "enterprises",
  "models",
  "products",
  "items",
  "goods",
  "openings",
  "jobs",
  "job openings",
  "positions",
  "careers",
  "vacancies",
  "list",
  "listings",
  "top companies",
  "best companies",
  "all companies",
  "services",
  "providers",
  "startups",
  "indian startups",
  "results",
  "unknown",
  "n/a",
  "none",
  "various",
  "multiple",
]);

export interface EntityMergeLog {
  targetRecordId: string;
  mergedRecordId: string;
  entityName: string;
  reason: string;
  domainMatched?: string;
}

export type EntityMatchDecision = "STRONG_MATCH" | "DISTINCT" | "AMBIGUOUS";

/**
 * Extracts a normalized root domain from a URL or source string.
 * e.g., "https://careers.freshworks.com/jobs/123" → "freshworks.com"
 */
export function extractRootDomain(urlOrSource: string | null | undefined): string | null {
  if (!urlOrSource || urlOrSource === "—" || urlOrSource === "Not disclosed") return null;

  try {
    const raw = urlOrSource.trim();
    const candidate = raw.startsWith("http") ? raw : `https://${raw}`;
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    // Extract root domain (e.g. careers.freshworks.com → freshworks.com)
    const parts = hostname.split(".");
    if (parts.length >= 2) {
      // Handle co.in, com.au, etc.
      if (
        parts.length >= 3 &&
        ["co", "com", "gov", "org", "edu"].includes(parts[parts.length - 2]!)
      ) {
        return parts.slice(-3).join(".");
      }
      return parts.slice(-2).join(".");
    }
    return hostname;
  } catch {
    return null;
  }
}

/**
 * Normalizes an entity name by stripping legal suffixes and corporate prefixes.
 */
export function normalizeEntityName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(
      /\b(private|pvt|limited|ltd|inc|incorporated|corp|corporation|llc|gmbh|technologies|solutions|services|group|holdings)\b\.?/gi,
      "",
    )
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Evaluates whether two records represent the exact same entity or distinct entities.
 */
export function compareEntityIdentity(
  a: DatasetRecord,
  b: DatasetRecord,
): { decision: EntityMatchDecision; reason: string } {
  const normA = normalizeEntityName(a.entityName);
  const normB = normalizeEntityName(b.entityName);

  // 1. Guard against generic stoplist terms
  if (
    GENERIC_ENTITY_TERMS.has(normA) ||
    GENERIC_ENTITY_TERMS.has(normB) ||
    normA.length < 2 ||
    normB.length < 2
  ) {
    return {
      decision: "DISTINCT",
      reason: `GENERIC_OR_EMPTY_ENTITY: '${a.entityName}' or '${b.entityName}' is a generic categorization term, not a unique entity.`,
    };
  }

  // 2. Extract domains from evidence or source
  const domainA = extractRootDomain(a.evidence?.[0]?.url || a.source || a.attributes?.["Source"]);
  const domainB = extractRootDomain(b.evidence?.[0]?.url || b.source || b.attributes?.["Source"]);

  const roleA = (a.role || a.attributes?.["Role"] || "").trim();
  const roleB = (b.role || b.attributes?.["Role"] || "").trim();

  // 3. Domain comparison (exclude third-party job boards / aggregators from first-party identity)
  const THIRD_PARTY_PLATFORMS = new Set([
    "linkedin.com",
    "naukri.com",
    "glassdoor.com",
    "indeed.com",
    "foundit.in",
    "monster.com",
    "cutshort.io",
    "instahyre.com",
    "wellfound.com",
    "hirist.com",
    "google.com",
    "bing.com",
  ]);

  const isFirstPartyA = domainA && !THIRD_PARTY_PLATFORMS.has(domainA);
  const isFirstPartyB = domainB && !THIRD_PARTY_PLATFORMS.has(domainB);
  const bothHaveFirstPartyDomains = Boolean(isFirstPartyA && isFirstPartyB);
  const domainsMatch = bothHaveFirstPartyDomains && domainA === domainB;
  const domainsDiffer = bothHaveFirstPartyDomains && domainA !== domainB;

  // 4. Role / Specification comparison
  let rolesConflict = false;
  if (roleA && roleB && roleA !== "—" && roleB !== "—") {
    const roleComp = matchRole(roleA, roleB);
    if (roleComp.result === "NO_MATCH") {
      rolesConflict = true;
    }
  }

  // If same company domain but distinctly different roles → DISTINCT (different jobs at the same company)
  if (domainsMatch && rolesConflict) {
    return {
      decision: "DISTINCT",
      reason: `DIFFERENT_POSITIONS_AT_SAME_COMPANY: Domain matches (${domainA}), but positions '${roleA}' and '${roleB}' are distinct.`,
    };
  }

  // If different first-party domains → DISTINCT
  if (domainsDiffer) {
    return {
      decision: "DISTINCT",
      reason: `DOMAIN_MISMATCH: '${domainA}' != '${domainB}'.`,
    };
  }

  // 5. Entity name equality
  const namesMatch = normA === normB;

  if (namesMatch) {
    if (rolesConflict) {
      // Same company name, but completely different job role → retain both records!
      return {
        decision: "DISTINCT",
        reason: `DISTINCT_ROLES_SAME_COMPANY_NAME: Entity name matches ('${a.entityName}'), but roles '${roleA}' and '${roleB}' are distinct.`,
      };
    }

    // Check location compatibility
    const locA = (a.location || a.attributes?.["Location"] || "").toLowerCase();
    const locB = (b.location || b.attributes?.["Location"] || "").toLowerCase();
    if (
      locA &&
      locB &&
      locA !== "—" &&
      locB !== "—" &&
      !locA.includes(locB) &&
      !locB.includes(locA)
    ) {
      // Different stated locations (e.g. Bangalore vs New York) → AMBIGUOUS, retain both
      return {
        decision: "AMBIGUOUS",
        reason: `AMBIGUOUS_LOCATION: Same entity name ('${a.entityName}'), but conflicting locations ('${locA}' vs '${locB}'). Retaining both.`,
      };
    }

    return {
      decision: "STRONG_MATCH",
      reason: `STRONG_IDENTITY_MATCH: Exact normalized entity name '${normA}' with compatible specifications.`,
    };
  }

  return {
    decision: "DISTINCT",
    reason: `DIFFERENT_ENTITIES: '${normA}' != '${normB}'.`,
  };
}

/**
 * Non-destructive entity resolver and deduplication pass.
 * Merges ONLY when identity evidence is strong.
 * Preserves ambiguous and distinct entities without loss.
 */
export function resolveAndDeduplicateEntities(records: DatasetRecord[]): {
  unique: DatasetRecord[];
  duplicatesMerged: number;
  merges: EntityMergeLog[];
} {
  const result: DatasetRecord[] = [];
  const merges: EntityMergeLog[] = [];
  let duplicatesMerged = 0;

  for (const candidate of records) {
    let merged = false;

    for (let i = 0; i < result.length; i++) {
      const existing = result[i]!;
      const comparison = compareEntityIdentity(existing, candidate);

      if (comparison.decision === "STRONG_MATCH") {
        duplicatesMerged++;
        merged = true;

        // Non-destructive evidence merge
        const combinedEv = [...existing.evidence, ...candidate.evidence];
        const dedupedEv = combinedEv.filter(
          (e, idx, arr) => arr.findIndex((x) => x.field === e.field && x.url === e.url) === idx,
        );

        // Detect cross-source attribute conflicts
        const mergedAttrs = { ...(existing.attributes || {}) };
        const conflictsList: Conflict[] = [...(existing.conflicts || [])];

        for (const [attrKey, candVal] of Object.entries(candidate.attributes || {})) {
          const existVal = existing.attributes?.[attrKey];
          if (
            existVal &&
            candVal &&
            existVal !== "—" &&
            candVal !== "—" &&
            !existVal.toLowerCase().includes("not disclosed") &&
            !candVal.toLowerCase().includes("not disclosed") &&
            existVal.toLowerCase().replace(/[^a-z0-9]/g, "") !==
              candVal.toLowerCase().replace(/[^a-z0-9]/g, "")
          ) {
            const conflictItem: Conflict = {
              field: attrKey,
              values: [
                {
                  source: existing.source,
                  value: existVal,
                  url: existing.evidence[0]?.url || "—",
                  retrieved: new Date().toLocaleTimeString(),
                  snippet:
                    existing.evidence.find((e) => e.field?.toLowerCase() === attrKey.toLowerCase())
                      ?.snippet || `Reported as ${existVal}`,
                },
                {
                  source: candidate.source,
                  value: candVal,
                  url: candidate.evidence[0]?.url || "—",
                  retrieved: new Date().toLocaleTimeString(),
                  snippet:
                    candidate.evidence.find((e) => e.field?.toLowerCase() === attrKey.toLowerCase())
                      ?.snippet || `Reported as ${candVal}`,
                },
              ],
            };

            if (!conflictsList.some((c) => c.field === attrKey)) {
              conflictsList.push(conflictItem);
            }
          }

          // Fill in missing attributes from candidate
          if ((!existVal || existVal === "—") && candVal && candVal !== "—") {
            mergedAttrs[attrKey] = candVal;
          }
        }

        // Keep highest confidence record as base
        const base = candidate.confidence > existing.confidence ? candidate : existing;
        result[i] = {
          ...base,
          id: existing.id, // preserve stable original ID
          evidence: dedupedEv,
          attributes: mergedAttrs,
          conflict: conflictsList[0] || existing.conflict || candidate.conflict,
          conflicts: conflictsList,
        };

        merges.push({
          targetRecordId: existing.id,
          mergedRecordId: candidate.id,
          entityName: candidate.entityName,
          reason: comparison.reason,
        });

        break;
      } else if (comparison.decision === "AMBIGUOUS") {
        // Mark candidate as ambiguous and retain BOTH records
        const amb = candidate as DatasetRecord & {
          entityResolution?: string;
          ambiguityReason?: string;
        };
        amb.entityResolution = "AMBIGUOUS";
        amb.ambiguityReason = comparison.reason;
      }
    }

    if (!merged) {
      result.push(candidate);
    }
  }

  return {
    unique: result.map((r, idx) => ({
      ...r,
      id: r.id || `R-${String(idx + 1).padStart(3, "0")}`,
    })),
    duplicatesMerged,
    merges,
  };
}
