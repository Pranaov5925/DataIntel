import fs from "node:fs/promises";
import path from "node:path";
import type {
  AppStore,
  PersistedDataRequest,
  PersistedRun,
  RunComparison,
} from "../lib/storage-schema";
import {
  datasetRows,
  DEMO_REQUEST,
  interventions as mockInterventions,
  qualitySummary as mockQ,
  sources as mockSources,
  understanding as mockUnderstanding,
  workflowStages as mockStages,
  tasks as mockTasks,
} from "../lib/mock-data";
import type { RequirementUnderstanding, WorkflowStep } from "../lib/workflow-schema";
import type { ExecutedStage } from "../lib/pipeline-schema";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

let memoryCache: AppStore | null = null;

function nowIST(): string {
  return new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });
}

function timeAgo(minutesAgo: number): string {
  const d = new Date(Date.now() - minutesAgo * 60 * 1000);
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });
}

// ─── Default Initial Seed ─────────────────────────────────────────────────────
function buildInitialSeed(): AppStore {
  const understandingObj: RequirementUnderstanding = {
    objective: "Identify Indian SaaS companies hiring Java backend developers with verified salary and company size data",
    target: "Job openings",
    geography: "India",
    industry: "SaaS",
    constraints: ["Java backend roles", "Indian SaaS companies"],
    requiredFields: [
      "Company",
      "Role",
      "Location",
      "Experience",
      "Salary",
      "Company Size",
      "Source",
    ],
    freshness: "Listings active in the last 30 days",
    searchIntent: "Competitive intelligence and talent market mapping",
  };

  const blueprintStages: WorkflowStep[] = mockStages.map((s) => ({
    name: s.name,
    detail: s.detail,
    status: s.status as "complete" | "active" | "pending",
    count: s.count,
  }));

  const executedStages: ExecutedStage[] = mockStages.map((s) => ({
    name: s.name,
    detail: s.detail,
    status: (s.status === "active" ? "complete" : s.status) as "complete" | "active" | "pending",
    count: s.count,
  }));

  // Initial Run 1 (v1 baseline before adaptive retry)
  const run1Records = datasetRows.map((r, idx) => {
    if (idx >= 26) {
      return {
        ...r,
        status: "Incomplete" as const,
        salary: "Not disclosed",
      };
    }
    return r;
  });

  const run1: PersistedRun = {
    id: "RUN-DR1048-v1",
    requestId: "DR-1048",
    runNumber: 1,
    requestName: "Indian SaaS companies hiring Java backend developers",
    originalPrompt: DEMO_REQUEST,
    status: "Completed",
    createdAt: timeAgo(45),
    completedAt: timeAgo(38),
    understanding: understandingObj,
    blueprintStages,
    executedStages,
    quality: {
      collected: 47,
      unique: 36,
      validated: 26,
      duplicates: 11,
      incomplete: 8,
      conflicts: 4,
    },
    records: run1Records,
    sources: mockSources.slice(0, 4),
    interventions: [
      {
        time: mockInterventions[0]?.time ?? "14:09:12",
        title: mockInterventions[0]?.title ?? "Initial collection complete",
        detail: mockInterventions[0]?.detail ?? "47 candidate records collected from 6 sources.",
        tone: (mockInterventions[0]?.tone ?? "accent") as "accent" | "warning" | "success",
      },
      {
        time: mockInterventions[1]?.time ?? "14:15:30",
        title: mockInterventions[1]?.title ?? "Evidence gap detected",
        detail: mockInterventions[1]?.detail ?? "Salary evidence coverage is 42%. Missing salary for 29 records.",
        tone: (mockInterventions[1]?.tone ?? "warning") as "accent" | "warning" | "success",
      },
    ],
    adaptiveOutcomes: [
      ["26", "Records verified"],
      ["11", "Duplicates removed"],
      ["4", "Conflicts detected"],
      ["29 → 8", "Incomplete records"],
    ],
    adaptiveSummary:
      "Initial collection completed with 26 of 36 records validated. 4 conflicts detected and salary evidence coverage at 42%.",
  };

  // Run 2 (v2 current run with adaptive verification)
  const run2Comparison: RunComparison = {
    previousRunId: "RUN-DR1048-v1",
    previousRunNumber: 1,
    recordsDelta: 0,
    validatedDelta: 5,
    conflictsDelta: -2,
    coverageDelta: 36,
    qualityDelta: 17,
    summary:
      "+5 validated records (26 → 31), 2 conflicts resolved, +36% salary coverage recovered via adaptive search.",
  };

  const run2: PersistedRun = {
    id: "RUN-DR1048-v2",
    requestId: "DR-1048",
    runNumber: 2,
    requestName: "Indian SaaS companies hiring Java backend developers",
    originalPrompt: DEMO_REQUEST,
    status: "Completed",
    createdAt: timeAgo(22),
    completedAt: timeAgo(14),
    understanding: understandingObj,
    blueprintStages,
    executedStages,
    quality: { ...mockQ },
    records: datasetRows,
    sources: mockSources,
    interventions: mockInterventions.map((i) => ({
      ...i,
      tone: i.tone as "accent" | "warning" | "success",
    })),
    adaptiveOutcomes: [
      ["+5", "Additional records verified"],
      ["11", "Duplicates removed"],
      ["2", "Conflicts detected"],
      ["8 → 3", "Incomplete records"],
    ],
    adaptiveSummary:
      "Key field (Salary) was missing for 29 records. Adaptive follow-up research recovered coverage from 42% to 78% (+36 pts), confirming 5 additional verified records.",
    comparison: run2Comparison,
  };

  // Main DR-1048 Request
  const request1048: PersistedDataRequest = {
    id: "DR-1048",
    name: "Indian SaaS companies hiring Java backend developers",
    prompt: DEMO_REQUEST,
    status: "completed",
    createdAt: timeAgo(45),
    updatedAt: timeAgo(14),
    runIds: ["RUN-DR1048-v1", "RUN-DR1048-v2"],
    activeRunId: "RUN-DR1048-v2",
  };

  // Other historical requests
  const otherRequests: PersistedDataRequest[] = mockTasks
    .filter((t) => t.id !== "DR-1048")
    .map((t) => ({
      id: t.id,
      name: t.name,
      prompt: `Collect structured data for: ${t.name}`,
      status: (t.status === "Running" ? "running" : "completed") as "running" | "completed",
      createdAt: timeAgo(240),
      updatedAt: timeAgo(120),
      runIds: [`RUN-${t.id}-v1`],
      activeRunId: `RUN-${t.id}-v1`,
    }));

  const otherRuns: PersistedRun[] = mockTasks
    .filter((t) => t.id !== "DR-1048")
    .map((t) => ({
      id: `RUN-${t.id}-v1`,
      requestId: t.id,
      runNumber: 1,
      requestName: t.name,
      originalPrompt: `Collect structured data for: ${t.name}`,
      status: "Completed" as const,
      createdAt: timeAgo(240),
      completedAt: timeAgo(210),
      understanding: {
        ...understandingObj,
        objective: `Collection for ${t.name}`,
      },
      blueprintStages,
      executedStages,
      quality: {
        collected: Math.round(t.records * 1.3),
        unique: t.records,
        validated: Math.round(t.records * (t.quality / 100)),
        duplicates: Math.round(t.records * 0.3),
        incomplete: Math.max(1, Math.round(t.records * 0.08)),
        conflicts: Math.max(1, Math.round(t.records * 0.04)),
      },
      records: datasetRows.slice(0, Math.min(datasetRows.length, t.records)),
      sources: mockSources,
      interventions: mockInterventions.slice(0, 2).map((i) => ({
        ...i,
        tone: i.tone as "accent" | "warning" | "success",
      })),
      adaptiveOutcomes: [
        [String(Math.round(t.records * (t.quality / 100))), "Records verified"],
        [String(Math.round(t.records * 0.3)), "Duplicates removed"],
        ["1", "Conflicts detected"],
        ["3", "Incomplete records"],
      ],
      adaptiveSummary: `Completed collection run for ${t.name} with ${t.quality}% quality score.`,
    }));

  return {
    activeRequestId: "DR-1048",
    activeRunId: "RUN-DR1048-v2",
    requests: [request1048, ...otherRequests],
    runs: [run2, run1, ...otherRuns],
  };
}

// ─── File I/O ─────────────────────────────────────────────────────────────────
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // directory exists
  }
}

export async function getStore(): Promise<AppStore> {
  if (memoryCache) return memoryCache;

  await ensureDataDir();
  try {
    const raw = await fs.readFile(STORE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as AppStore;
    if (parsed && Array.isArray(parsed.requests) && Array.isArray(parsed.runs)) {
      memoryCache = parsed;
      return parsed;
    }
  } catch {
    // file does not exist or invalid JSON – initialize
  }

  const initial = buildInitialSeed();
  await saveStore(initial);
  return initial;
}

export async function saveStore(store: AppStore): Promise<void> {
  memoryCache = store;
  await ensureDataDir();
  const tempFile = `${STORE_FILE}.tmp.${Date.now()}`;
  await fs.writeFile(tempFile, JSON.stringify(store, null, 2), "utf-8");
  try {
    await fs.rename(tempFile, STORE_FILE);
  } catch {
    // Windows rename overwrite fallback
    await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf-8");
    try {
      await fs.unlink(tempFile);
    } catch {
      // ignore
    }
  }
}

// ─── Query & Mutate Methods ───────────────────────────────────────────────────
export async function getActiveRun(): Promise<PersistedRun | null> {
  const store = await getStore();
  const run = store.runs.find((r) => r.id === store.activeRunId);
  return run ?? store.runs[0] ?? null;
}

export async function setActiveRun(runId: string): Promise<PersistedRun | null> {
  const store = await getStore();
  const target = store.runs.find((r) => r.id === runId);
  if (!target) return null;

  store.activeRunId = runId;
  store.activeRequestId = target.requestId;

  const req = store.requests.find((r) => r.id === target.requestId);
  if (req) {
    req.activeRunId = runId;
  }

  await saveStore(store);
  return target;
}

export async function getRunById(runId: string): Promise<PersistedRun | null> {
  const store = await getStore();
  return store.runs.find((r) => r.id === runId) ?? null;
}

export async function getRunsList(): Promise<PersistedRun[]> {
  const store = await getStore();
  return store.runs;
}

export async function getRequestsList(): Promise<PersistedDataRequest[]> {
  const store = await getStore();
  return store.requests;
}

export async function saveNewRun(run: PersistedRun): Promise<PersistedRun> {
  const store = await getStore();

  // Find or create request
  let req = store.requests.find((r) => r.id === run.requestId);
  if (!req) {
    req = {
      id: run.requestId,
      name: run.requestName || (run as unknown as { title?: string }).title || "Custom Data Request",
      prompt: run.originalPrompt,
      status: "completed",
      createdAt: run.createdAt || nowIST(),
      updatedAt: nowIST(),
      runIds: [run.id],
      activeRunId: run.id,
    };
    store.requests.unshift(req);
  } else {
    if (!req.runIds.includes(run.id)) {
      req.runIds.unshift(run.id);
    }
    req.activeRunId = run.id;
    req.status = "completed";
    req.updatedAt = nowIST();
  }

  // Prepend run to front of runs list
  const existingIdx = store.runs.findIndex((r) => r.id === run.id);
  if (existingIdx !== -1) {
    store.runs[existingIdx] = run;
  } else {
    store.runs.unshift(run);
  }

  store.activeRunId = run.id;
  store.activeRequestId = run.requestId;

  await saveStore(store);
  return run;
}

// ─── Rerun Workflow Logic ─────────────────────────────────────────────────────
export async function rerunWorkflow(
  requestId: string,
): Promise<{ newRun: PersistedRun; comparison: RunComparison }> {
  const store = await getStore();
  const req = store.requests.find((r) => r.id === requestId);
  if (!req) {
    throw new Error(`Request ${requestId} not found.`);
  }

  // Find previous runs for this request
  const previousRuns = store.runs
    .filter((r) => r.requestId === requestId)
    .sort((a, b) => b.runNumber - a.runNumber);

  const prevRun = previousRuns[0];
  const nextRunNumber = (prevRun?.runNumber ?? 1) + 1;
  const newRunId = `RUN-${requestId}-v${nextRunNumber}`;

  // REQUIREMENT #13: Execute the REAL pipeline again with Gemini 3.8 Flash
  // No copying old records, no fake status upgrades, no Math.random()
  const { runGeminiPipeline } = await import("./pipeline-runner");

  const understanding = prevRun?.understanding ?? {
    objective: req.name,
    target: "Job openings",
    geography: "India",
    industry: "SaaS",
    constraints: [],
    requiredFields: [
      "Company",
      "Role",
      "Location",
      "Experience",
      "Salary",
      "Company Size",
      "Source",
    ],
    freshness: "Listings active in the last 30 days",
    searchIntent: "Competitive intelligence and talent mapping",
  };

  const pipelineRes = await runGeminiPipeline({
    planId: requestId,
    title: req.name,
    request: req.prompt,
    requiredFields: Array.isArray(understanding.requiredFields)
      ? understanding.requiredFields
      : [String(understanding.requiredFields)],
    geography: understanding.geography,
    industry: understanding.industry,
    target: understanding.target,
    stages: prevRun?.blueprintStages,
  });

  if (!pipelineRes.success) {
    throw new Error(`Real rerun failed: ${pipelineRes.error}`);
  }

  const result = pipelineRes.data;

  // Real deltas compared to previous run
  const prevUnique = prevRun?.quality.unique ?? 0;
  const prevValidated = prevRun?.quality.validated ?? 0;
  const prevConflicts = prevRun?.quality.conflicts ?? 0;

  const recordsDelta = result.quality.unique - prevUnique;
  const validatedDelta = result.quality.validated - prevValidated;
  const conflictsDelta = result.quality.conflicts - prevConflicts;

  const prevCoverage = prevRun
    ? Math.round((prevRun.quality.validated / Math.max(1, prevRun.quality.unique)) * 100)
    : 70;
  const currentCoverage = Math.round(
    (result.quality.validated / Math.max(1, result.quality.unique)) * 100,
  );
  const coverageDelta = currentCoverage - prevCoverage;

  const comparison: RunComparison = {
    previousRunId: prevRun ? prevRun.id : "initial",
    previousRunNumber: prevRun ? prevRun.runNumber : 1,
    recordsDelta,
    validatedDelta,
    conflictsDelta,
    coverageDelta,
    qualityDelta: Math.abs(validatedDelta),
    summary: `Run ${nextRunNumber} executed real collection: ${result.quality.collected} collected, ${result.quality.unique} unique, ${validatedDelta >= 0 ? `+${validatedDelta}` : validatedDelta} validated, ${conflictsDelta <= 0 ? conflictsDelta : `+${conflictsDelta}`} conflicts.`,
  };

  const newRun: PersistedRun = {
    id: newRunId,
    requestId,
    runNumber: nextRunNumber,
    requestName: req.name,
    originalPrompt: req.prompt,
    status: "Completed",
    createdAt: nowIST(),
    completedAt: nowIST(),
    understanding,
    blueprintStages: prevRun ? prevRun.blueprintStages : result.stages,
    executedStages: result.stages,
    quality: result.quality,
    records: result.records,
    sources: result.sources,
    interventions: [
      {
        time: nowIST(),
        title: `Workflow Rerun #${nextRunNumber} executed`,
        detail: `Real web search collection completed with Gemini 3.8 Flash for request "${req.name}".`,
        tone: "accent",
      },
      ...result.interventions,
    ],
    adaptiveOutcomes: result.adaptiveOutcomes,
    adaptiveSummary: result.adaptiveSummary,
    comparison,
  };

  await saveNewRun(newRun);
  return { newRun, comparison };
}
