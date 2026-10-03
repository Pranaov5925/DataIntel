/**
 * DATAINTEL — Production SQLite Database Engine
 *
 * Powered by Node.js built-in `node:sqlite` (DatabaseSync).
 * Provides a normalized schema for requests, runs, sources, records,
 * record_fields, evidence, conflicts, verification attempts, and workflow steps.
 * Includes automatic schema initialization, indexing, and migration from store.json.
 */

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type { AppStore, PersistedDataRequest, PersistedRun } from "../lib/storage-schema";
import type { DatasetRecord, SourceSummary, Evidence, Conflict } from "../lib/pipeline-schema";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "dataintel.sqlite");
const STORE_JSON_FILE = path.join(DATA_DIR, "store.json");

let dbInstance: DatabaseSync | null = null;

export interface DbRequestRow {
  id: string;
  name: string;
  prompt: string;
  status: string;
  active_run_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbRunRow {
  id: string;
  request_id: string;
  run_number: number;
  request_name: string;
  original_prompt: string;
  status: "Completed" | "Running" | "Failed";
  quality_collected: number;
  quality_unique: number;
  quality_validated: number;
  quality_conflicts: number;
  quality_duplicates: number;
  quality_incomplete: number;
  quality_qualified: number;
  quality_needs_verification: number;
  quality_excluded: number;
  quality_json?: string;
  quality_score?: number;
  adaptive_summary?: string;
  understanding_json?: string;
  blueprint_stages_json?: string;
  executed_stages_json?: string;
  adaptive_outcomes_json?: string;
  interventions_json?: string;
  comparison_json?: string;
  created_at: string;
  completed_at: string;
}

export interface DbRecordRow {
  id: string;
  run_id: string;
  entity_name: string;
  attributes_json?: string;
  qualification_status: "Qualified" | "Needs verification" | "Excluded" | "Conflict";
  qualification_reason?: string | null;
  verification_status?: string | null;
  reliability_score: number;
  breakdown_json?: string | null;
  created_at: string;
}

export interface DbEvidenceRow {
  id: string;
  record_id: string;
  run_id: string;
  source_id?: string | null;
  url?: string | null;
  field_name: string;
  raw_value?: string | null;
  quote?: string | null;
  location?: string | null;
  directness?: string;
  verification_status?: string;
  retrieved_at: string;
}

export interface DbConflictRow {
  id: string;
  record_id: string;
  run_id: string;
  field_name: string;
  values_json?: string;
  sources_json?: string;
  conflict_status: string;
  resolution_status?: string;
  resolution_reason?: string | null;
  created_at: string;
}

export interface DbSourceRow {
  id: string;
  run_id: string;
  url: string;
  canonical_url?: string;
  domain: string;
  title?: string | null;
  fetched_at?: string;
  published_at?: string | null;
  source_type?: string;
  quality_tier?: string;
  quality_score?: number;
  reliability_score?: number;
  http_status?: number | null;
  search_rank?: number;
  accessibility?: string;
  freshness_status?: string;
  retrieval_method?: string;
  created_at: string;
}

export function getDatabase(): DatabaseSync {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new DatabaseSync(DB_FILE);
  // Enable WAL mode and foreign keys for high reliability and concurrency
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  initSchema(db);
  dbInstance = db;
  return db;
}

function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      name TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      status TEXT NOT NULL,
      active_run_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      run_number INTEGER NOT NULL,
      request_name TEXT NOT NULL,
      original_prompt TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      understanding_json TEXT NOT NULL,
      blueprint_stages_json TEXT NOT NULL,
      executed_stages_json TEXT NOT NULL,
      quality_json TEXT NOT NULL,
      interventions_json TEXT NOT NULL,
      adaptive_outcomes_json TEXT NOT NULL,
      adaptive_summary TEXT,
      comparison_json TEXT,
      FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      url TEXT NOT NULL,
      canonical_url TEXT,
      domain TEXT NOT NULL,
      title TEXT,
      fetched_at TEXT NOT NULL,
      published_at TEXT,
      source_type TEXT NOT NULL,
      http_status INTEGER,
      content_hash TEXT,
      search_rank INTEGER,
      retrieval_method TEXT,
      accessibility TEXT,
      freshness TEXT,
      quality_score REAL,
      FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      request_id TEXT,
      entity_name TEXT NOT NULL,
      normalized_entity TEXT,
      qualification_status TEXT NOT NULL,
      qualification_reason TEXT,
      verification_status TEXT,
      reliability_score REAL NOT NULL,
      breakdown_json TEXT,
      attributes_json TEXT NOT NULL,
      raw_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS record_fields (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      raw_value TEXT,
      normalized_value TEXT,
      unit TEXT,
      status TEXT NOT NULL,
      verification_status TEXT,
      conflict_status TEXT,
      FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      source_id TEXT,
      url TEXT,
      field_name TEXT NOT NULL,
      raw_value TEXT,
      quote TEXT NOT NULL,
      location TEXT,
      directness TEXT,
      verification_status TEXT,
      retrieved_at TEXT,
      FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS conflicts (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      values_json TEXT NOT NULL,
      sources_json TEXT,
      conflict_status TEXT,
      resolution_status TEXT,
      resolution_reason TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS verification_attempts (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      query TEXT NOT NULL,
      status TEXT NOT NULL,
      outcome TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workflow_steps (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      step_order INTEGER NOT NULL,
      name TEXT NOT NULL,
      detail TEXT,
      status TEXT NOT NULL,
      count TEXT,
      is_blueprint INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
    );

    -- Canonical Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);
    CREATE INDEX IF NOT EXISTS idx_runs_request_id ON runs(request_id);
    CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
    CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at);
    CREATE INDEX IF NOT EXISTS idx_sources_run_id ON sources(run_id);
    CREATE INDEX IF NOT EXISTS idx_sources_url ON sources(url);
    CREATE INDEX IF NOT EXISTS idx_records_run_id ON records(run_id);
    CREATE INDEX IF NOT EXISTS idx_records_entity ON records(entity_name);
    CREATE INDEX IF NOT EXISTS idx_records_status ON records(qualification_status);
    CREATE INDEX IF NOT EXISTS idx_record_fields_record_id ON record_fields(record_id);
    CREATE INDEX IF NOT EXISTS idx_record_fields_field ON record_fields(field_name);
    CREATE INDEX IF NOT EXISTS idx_evidence_record_id ON evidence(record_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_field ON evidence(field_name);
    CREATE INDEX IF NOT EXISTS idx_evidence_source ON evidence(source_id);
    CREATE INDEX IF NOT EXISTS idx_conflicts_record_id ON conflicts(record_id);
    CREATE INDEX IF NOT EXISTS idx_verification_attempts_record_id ON verification_attempts(record_id);
    CREATE INDEX IF NOT EXISTS idx_workflow_steps_run_id ON workflow_steps(run_id);
  `);
}

/**
 * Migrate existing JSON store into SQLite if SQLite is empty
 */
export function migrateFromJsonStoreIfNeeded(): void {
  const db = getDatabase();
  const countRow = db.prepare("SELECT COUNT(*) as count FROM runs").get() as { count: number };
  if (countRow && countRow.count > 0) {
    return; // Already has data
  }

  if (!fs.existsSync(STORE_JSON_FILE)) {
    return;
  }

  try {
    const raw = fs.readFileSync(STORE_JSON_FILE, "utf-8");
    const parsed = JSON.parse(raw) as AppStore;
    if (!parsed || !Array.isArray(parsed.runs)) return;

    for (const req of parsed.requests || []) {
      dbSaveRequest(req);
    }
    for (const run of parsed.runs || []) {
      dbSaveRun(run);
    }
    console.log(
      `[SQLite Migration] Successfully migrated ${parsed.runs.length} runs and ${parsed.requests?.length || 0} requests into SQLite.`,
    );
  } catch (err) {
    console.error("[SQLite Migration] Error migrating from store.json:", err);
  }
}

// ─── Database Operations ──────────────────────────────────────────────────────

export function dbSaveRequest(req: PersistedDataRequest): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO requests (id, name, prompt, status, active_run_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      prompt = excluded.prompt,
      status = excluded.status,
      active_run_id = excluded.active_run_id,
      updated_at = excluded.updated_at
  `);
  stmt.run(
    req.id,
    req.name,
    req.prompt,
    req.status,
    req.activeRunId || null,
    req.createdAt,
    req.updatedAt,
  );
}

export function dbGetRequests(): PersistedDataRequest[] {
  const db = getDatabase();
  const rows = db
    .prepare("SELECT * FROM requests ORDER BY created_at DESC")
    .all() as unknown as DbRequestRow[];
  return rows.map((r) => {
    // Get run IDs for this request
    const runRows = db
      .prepare("SELECT id FROM runs WHERE request_id = ? ORDER BY run_number DESC")
      .all(r.id) as { id: string }[];
    const validStatus = (
      ["draft", "planning", "running", "completed", "failed"].includes(r.status)
        ? r.status
        : "completed"
    ) as "draft" | "planning" | "running" | "completed" | "failed";
    return {
      id: r.id,
      name: r.name,
      prompt: r.prompt,
      status: validStatus,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      runIds: runRows.map((x) => x.id),
      activeRunId: r.active_run_id || (runRows[0]?.id ?? ""),
    };
  });
}

export function dbGetRequestById(id: string): PersistedDataRequest | null {
  const db = getDatabase();
  const r = db.prepare("SELECT * FROM requests WHERE id = ?").get(id) as unknown as
    DbRequestRow | undefined;
  if (!r) return null;
  const runRows = db
    .prepare("SELECT id FROM runs WHERE request_id = ? ORDER BY run_number DESC")
    .all(id) as { id: string }[];
  return {
    id: r.id,
    name: r.name,
    prompt: r.prompt,
    status: r.status as "draft" | "planning" | "running" | "completed" | "failed",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    runIds: runRows.map((x) => x.id),
    activeRunId: r.active_run_id || (runRows[0]?.id ?? ""),
  };
}

export function dbSaveRun(run: PersistedRun): void {
  const db = getDatabase();

  // 1. Ensure request exists
  const existingReq = db.prepare("SELECT id FROM requests WHERE id = ?").get(run.requestId);
  if (!existingReq) {
    dbSaveRequest({
      id: run.requestId,
      name: run.requestName || "Custom Data Request",
      prompt: run.originalPrompt,
      status: "completed",
      createdAt: run.createdAt,
      updatedAt: run.completedAt || run.createdAt,
      runIds: [run.id],
      activeRunId: run.id,
    });
  } else {
    db.prepare("UPDATE requests SET active_run_id = ?, updated_at = ? WHERE id = ?").run(
      run.id,
      run.completedAt || run.createdAt,
      run.requestId,
    );
  }

  // 2. Insert or replace run record
  const stmt = db.prepare(`
    INSERT INTO runs (
      id, request_id, run_number, request_name, original_prompt, status,
      created_at, completed_at, understanding_json, blueprint_stages_json,
      executed_stages_json, quality_json, interventions_json, adaptive_outcomes_json,
      adaptive_summary, comparison_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      request_name = excluded.request_name,
      status = excluded.status,
      completed_at = excluded.completed_at,
      understanding_json = excluded.understanding_json,
      blueprint_stages_json = excluded.blueprint_stages_json,
      executed_stages_json = excluded.executed_stages_json,
      quality_json = excluded.quality_json,
      interventions_json = excluded.interventions_json,
      adaptive_outcomes_json = excluded.adaptive_outcomes_json,
      adaptive_summary = excluded.adaptive_summary,
      comparison_json = excluded.comparison_json
  `);

  stmt.run(
    run.id,
    run.requestId,
    run.runNumber,
    run.requestName,
    run.originalPrompt,
    run.status,
    run.createdAt,
    run.completedAt || null,
    JSON.stringify(run.understanding),
    JSON.stringify(run.blueprintStages || []),
    JSON.stringify(run.executedStages || []),
    JSON.stringify(run.quality),
    JSON.stringify(run.interventions || []),
    JSON.stringify(run.adaptiveOutcomes || []),
    run.adaptiveSummary || null,
    run.comparison ? JSON.stringify(run.comparison) : null,
  );

  // 3. Save sources
  if (Array.isArray(run.sources)) {
    const srcStmt = db.prepare(`
      INSERT INTO sources (
        id, run_id, url, canonical_url, domain, title, fetched_at,
        published_at, source_type, http_status, content_hash, search_rank,
        retrieval_method, accessibility, freshness, quality_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        quality_score = excluded.quality_score
    `);

    for (let idx = 0; idx < run.sources.length; idx++) {
      const s = run.sources[idx]!;
      const srcId = `${run.id}-SRC-${idx + 1}`;
      const srcDomain = s.domain || "unknown";
      const srcUrl =
        ("url" in s && typeof s.url === "string" ? s.url : undefined) ||
        (srcDomain.startsWith("http") ? srcDomain : `https://${srcDomain}`);
      srcStmt.run(
        srcId,
        run.id,
        srcUrl,
        srcUrl,
        srcDomain,
        s.name || null,
        s.checked || run.createdAt,
        null,
        s.type || "Aggregator",
        200,
        null,
        idx + 1,
        "search",
        "accessible",
        "Active",
        typeof s.reliability === "number" ? s.reliability : 80,
      );
    }
  }

  // 4. Save records, fields, evidence, and conflicts
  if (Array.isArray(run.records)) {
    const recStmt = db.prepare(`
      INSERT INTO records (
        id, run_id, request_id, entity_name, normalized_entity,
        qualification_status, qualification_reason, verification_status,
        reliability_score, breakdown_json, attributes_json, raw_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        entity_name = excluded.entity_name,
        qualification_status = excluded.qualification_status,
        qualification_reason = excluded.qualification_reason,
        verification_status = excluded.verification_status,
        reliability_score = excluded.reliability_score,
        breakdown_json = excluded.breakdown_json,
        attributes_json = excluded.attributes_json
    `);

    const fieldStmt = db.prepare(`
      INSERT INTO record_fields (
        id, record_id, run_id, field_name, raw_value, normalized_value,
        unit, status, verification_status, conflict_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        raw_value = excluded.raw_value,
        status = excluded.status
    `);

    const evStmt = db.prepare(`
      INSERT INTO evidence (
        id, record_id, run_id, source_id, url, field_name,
        raw_value, quote, location, directness, verification_status, retrieved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        quote = excluded.quote,
        verification_status = excluded.verification_status
    `);

    const confStmt = db.prepare(`
      INSERT INTO conflicts (
        id, record_id, run_id, field_name, values_json, sources_json,
        conflict_status, resolution_status, resolution_reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        values_json = excluded.values_json
    `);

    for (let rIdx = 0; rIdx < run.records.length; rIdx++) {
      const rec = run.records[rIdx]!;
      const recId = rec.id || `${run.id}-REC-${rIdx + 1}`;
      const reliability = typeof rec.confidence === "number" ? rec.confidence : 75;
      const breakdownJson = rec.evidenceBreakdown ? JSON.stringify(rec.evidenceBreakdown) : null;
      const attrsJson = JSON.stringify(rec.attributes || {});

      recStmt.run(
        recId,
        run.id,
        run.requestId,
        rec.entityName,
        rec.entityName.toLowerCase().trim(),
        rec.qualificationStatus,
        rec.qualificationReason || null,
        rec.verificationStatus || null,
        reliability,
        breakdownJson,
        attrsJson,
        JSON.stringify(rec),
        run.createdAt,
      );

      // Save fields
      if (rec.attributes) {
        for (const [fName, fVal] of Object.entries(rec.attributes)) {
          const fieldId = `${recId}-FLD-${fName.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
          const isMissing = !fVal || fVal === "—" || fVal.toLowerCase() === "not disclosed";
          fieldStmt.run(
            fieldId,
            recId,
            run.id,
            fName,
            fVal || null,
            fVal || null,
            null,
            isMissing ? "NOT_FOUND" : "FOUND",
            rec.verificationStatus || "Needs review",
            "NONE",
          );
        }
      }

      // Save evidence
      if (Array.isArray(rec.evidence)) {
        for (let eIdx = 0; eIdx < rec.evidence.length; eIdx++) {
          const ev = rec.evidence[eIdx]!;
          const evId = `${recId}-EV-${eIdx + 1}`;
          evStmt.run(
            evId,
            recId,
            run.id,
            null,
            ev.url || null,
            ev.field || "General",
            ev.value || null,
            ev.snippet || "",
            null,
            "directness" in ev && typeof (ev as { directness?: unknown }).directness === "string"
              ? String((ev as { directness?: unknown }).directness)
              : "DIRECT",
            ev.verification || "Confirmed",
            run.createdAt,
          );
        }
      }

      // Save conflicts
      if (Array.isArray(rec.conflicts)) {
        for (let cIdx = 0; cIdx < rec.conflicts.length; cIdx++) {
          const conf = rec.conflicts[cIdx]!;
          const confId = `${recId}-CONF-${cIdx + 1}`;
          confStmt.run(
            confId,
            recId,
            run.id,
            conf.field,
            JSON.stringify(conf.values),
            JSON.stringify(conf.values.map((v) => v.source)),
            "ACTIVE",
            "UNRESOLVED",
            null,
            run.createdAt,
          );
        }
      }
    }
  }
}

export function dbGetRuns(): PersistedRun[] {
  const db = getDatabase();
  const rows = db
    .prepare("SELECT * FROM runs ORDER BY created_at DESC")
    .all() as unknown as DbRunRow[];
  return rows.map(hydrateRunFromRow);
}

export function dbGetRunById(runId: string): PersistedRun | null {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM runs WHERE id = ?").get(runId) as unknown as
    DbRunRow | undefined;
  if (!row) return null;
  return hydrateRunFromRow(row);
}

function hydrateRunFromRow(row: DbRunRow): PersistedRun {
  const db = getDatabase();

  // Load records
  const recRows = db
    .prepare("SELECT * FROM records WHERE run_id = ? ORDER BY id ASC")
    .all(row.id) as unknown as DbRecordRow[];
  const records: DatasetRecord[] = recRows.map((r) => {
    // Load evidence for this record
    const evRows = db
      .prepare("SELECT * FROM evidence WHERE record_id = ?")
      .all(r.id) as unknown as DbEvidenceRow[];
    const evidence: Evidence[] = evRows.map((e) => ({
      field: e.field_name,
      value: e.raw_value || "",
      source: e.url
        ? new URL(e.url.startsWith("http") ? e.url : `https://${e.url}`).hostname
        : "Web Research",
      url: e.url || "—",
      retrieved: e.retrieved_at || row.created_at,
      snippet: e.quote || "",
      verification:
        (e.verification_status as "Confirmed" | "Partially verified" | "Needs verification") ||
        "Confirmed",
    }));

    // Load conflicts for this record
    const confRows = db
      .prepare("SELECT * FROM conflicts WHERE record_id = ?")
      .all(r.id) as unknown as DbConflictRow[];
    const conflicts: Conflict[] = confRows.map((c) => ({
      field: c.field_name,
      values: JSON.parse(c.values_json || "[]"),
    }));

    const attributes = JSON.parse(r.attributes_json || "{}");
    const breakdown = r.breakdown_json ? JSON.parse(r.breakdown_json) : undefined;
    const qualStatus = r.qualification_status;
    const legacyStatus: "Verified" | "Review" | "Conflict" | "Incomplete" =
      qualStatus === "Qualified" ? "Verified" : qualStatus === "Conflict" ? "Conflict" : "Review";

    return {
      id: r.id,
      entityName: r.entity_name,
      company: attributes["Company"] || r.entity_name,
      role: attributes["Role"] || "—",
      location: attributes["Location"] || "—",
      experience: attributes["Experience"] || "—",
      salary: attributes["Salary"] || "Not disclosed",
      size: attributes["Company Size"] || "—",
      source: attributes["Source"] || "Web Research",
      status: legacyStatus,
      qualificationStatus: qualStatus,
      qualificationReason: r.qualification_reason || undefined,
      verificationStatus:
        (r.verification_status as "Confirmed" | "Partially verified" | "Needs verification") ||
        "Needs verification",
      confidence: Math.round(r.reliability_score),
      reliabilityScore: Math.round(r.reliability_score),
      evidenceBreakdown: breakdown,
      attributes,
      evidence,
      conflicts,
      conflict: conflicts[0],
    };
  });

  // Load sources
  const srcRows = db
    .prepare("SELECT * FROM sources WHERE run_id = ? ORDER BY search_rank ASC")
    .all(row.id) as unknown as DbSourceRow[];
  const sources: SourceSummary[] = srcRows.map((s) => ({
    name: s.title || s.domain,
    domain: s.domain,
    type: s.source_type || "Aggregator",
    records: 1,
    reliability: Math.round(s.quality_score || 80),
    checked: s.fetched_at || row.created_at || "Just now",
  }));

  return {
    id: row.id,
    requestId: row.request_id,
    runNumber: row.run_number,
    requestName: row.request_name,
    originalPrompt: row.original_prompt,
    status: row.status as "Completed" | "Running" | "Failed",
    createdAt: row.created_at,
    completedAt: row.completed_at || row.created_at,
    understanding: JSON.parse(row.understanding_json || "{}"),
    blueprintStages: JSON.parse(row.blueprint_stages_json || "[]"),
    executedStages: JSON.parse(row.executed_stages_json || "[]"),
    quality: (() => {
      interface QualityPayload {
        collected?: number;
        unique?: number;
        validated?: number;
        conflicts?: number;
        duplicates?: number;
        incomplete?: number;
        qualified?: number;
        needsVerification?: number;
        excluded?: number;
      }
      let qObj: QualityPayload = {};
      if (row.quality_json) {
        try {
          qObj = JSON.parse(row.quality_json) as QualityPayload;
        } catch {
          // ignore
        }
      }
      const qualifiedCount = records.filter(
        (r) => r.qualificationStatus === "Qualified" || r.status === "Verified",
      ).length;
      const needsVerifCount = records.filter(
        (r) => r.qualificationStatus === "Needs verification" || r.status === "Review",
      ).length;
      const conflictsCount = records.filter(
        (r) => r.qualificationStatus === "Conflict" || r.status === "Conflict",
      ).length;
      const totalRecs = records.length;

      const collected =
        typeof qObj.collected === "number" && Number.isFinite(qObj.collected) && qObj.collected > 0
          ? qObj.collected
          : totalRecs;
      const unique =
        typeof qObj.unique === "number" && Number.isFinite(qObj.unique) && qObj.unique > 0
          ? qObj.unique
          : totalRecs;
      const validated =
        typeof qObj.validated === "number" && Number.isFinite(qObj.validated)
          ? qObj.validated
          : qualifiedCount;
      const conflicts =
        typeof qObj.conflicts === "number" && Number.isFinite(qObj.conflicts)
          ? qObj.conflicts
          : conflictsCount;
      const duplicates =
        typeof qObj.duplicates === "number" && Number.isFinite(qObj.duplicates)
          ? qObj.duplicates
          : 0;
      const incomplete =
        typeof qObj.incomplete === "number" && Number.isFinite(qObj.incomplete)
          ? qObj.incomplete
          : needsVerifCount;
      const qualified =
        typeof qObj.qualified === "number" && Number.isFinite(qObj.qualified)
          ? qObj.qualified
          : qualifiedCount;
      const needsVerification =
        typeof qObj.needsVerification === "number" && Number.isFinite(qObj.needsVerification)
          ? qObj.needsVerification
          : needsVerifCount;
      const excluded =
        typeof qObj.excluded === "number" && Number.isFinite(qObj.excluded) ? qObj.excluded : 0;

      return {
        collected,
        unique,
        validated,
        conflicts,
        duplicates,
        incomplete,
        qualified,
        needsVerification,
        excluded,
      };
    })(),
    records,
    sources,
    interventions: JSON.parse(row.interventions_json || "[]"),
    adaptiveOutcomes: JSON.parse(row.adaptive_outcomes_json || "[]"),
    adaptiveSummary: row.adaptive_summary || "",
    comparison: row.comparison_json ? JSON.parse(row.comparison_json) : undefined,
  };
}
