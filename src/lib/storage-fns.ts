import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { PersistedRun, RunComparison } from "./storage-schema";

// ─── Get Active Run ───────────────────────────────────────────────────────────
export const getActiveRunFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<PersistedRun | null> => {
    const { getActiveRun } = await import("../server/storage");
    return getActiveRun();
  },
);

// ─── Set Active Run ───────────────────────────────────────────────────────────
export const setActiveRunFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ runId: z.string() }).parse(input))
  .handler(async ({ data }): Promise<PersistedRun | null> => {
    const { setActiveRun } = await import("../server/storage");
    return setActiveRun(data.runId);
  });

import type { TaskItem } from "../components/dashboard-ui";

// ─── Get History Data ─────────────────────────────────────────────────────────
export type HistoryData = {
  activeRun: PersistedRun | null;
  requestRuns: PersistedRun[];
  allRuns: PersistedRun[];
  allRequests: TaskItem[];
};

export const getHistoryDataFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<HistoryData> => {
    const { getStore, getActiveRun } = await import("../server/storage");
    const store = await getStore();
    const activeRun = (await getActiveRun()) ?? store.runs[0] ?? null;

    const targetReqId = activeRun ? activeRun.requestId : store.activeRequestId;
    const requestRuns = store.runs
      .filter((r) => r.requestId === targetReqId)
      .sort((a, b) => b.runNumber - a.runNumber);

    const allRequests = store.requests.map((req) => {
      const latestRun = store.runs.find((r) => r.id === req.activeRunId) ?? store.runs.find((r) => r.requestId === req.id);
      return {
        id: req.id,
        name: req.name,
        prompt: req.prompt,
        status: req.status === "completed" ? "Complete" : req.status === "running" ? "Running" : "Needs review",
        updated: req.updatedAt,
        records: latestRun?.records.length ?? 36,
        quality: latestRun ? Math.round((latestRun.quality.validated / Math.max(1, latestRun.quality.unique)) * 100) : 88,
        progress: req.status === "completed" ? 100 : 82,
      };
    });

    return {
      activeRun,
      requestRuns,
      allRuns: store.runs,
      allRequests,
    };
  },
);

// ─── Get Overview Data ────────────────────────────────────────────────────────
export type OverviewData = {
  activeWorkflowsCount: number;
  totalRecordsCollected: number;
  averageQuality: number;
  sourceCoverage: number;
  activeRun: PersistedRun | null;
  attention: {
    needingVerification: number;
    conflicts: number;
    incomplete: number;
    coveragePercent: number;
  };
  tasks: TaskItem[];
};

export const getOverviewDataFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<OverviewData> => {
    const { getStore, getActiveRun } = await import("../server/storage");
    const store = await getStore();
    const activeRun = (await getActiveRun()) ?? store.runs[0] ?? null;

    const totalCollected = store.runs.reduce((acc, r) => acc + r.quality.collected, 0);
    const avgQuality = activeRun
      ? Math.round((activeRun.quality.validated / Math.max(1, activeRun.quality.unique)) * 100)
      : 88;

    const distinctSources = new Set(
      store.runs.flatMap((r) => r.sources.map((s) => s.name)),
    );

    const tasks = store.requests.map((req) => {
      const run = store.runs.find((r) => r.id === req.activeRunId) ?? store.runs.find((r) => r.requestId === req.id);
      return {
        id: req.id,
        name: req.name,
        status: (req.status === "running" ? "Running" : "Complete") as "Running" | "Complete",
        progress: req.status === "running" ? 82 : 100,
        records: run?.quality.unique ?? 36,
        quality: run ? Math.round((run.quality.validated / Math.max(1, run.quality.unique)) * 100) : 88,
        updated: req.updatedAt,
      };
    });

    return {
      activeWorkflowsCount: store.requests.filter((r) => r.status === "running").length || 1,
      totalRecordsCollected: totalCollected || 47,
      averageQuality: avgQuality,
      sourceCoverage: distinctSources.size || 9,
      activeRun,
      attention: {
        needingVerification: activeRun ? activeRun.records.filter((r) => r.status === "Review").length : 5,
        conflicts: activeRun ? activeRun.quality.conflicts : 2,
        incomplete: activeRun ? activeRun.quality.incomplete : 3,
        coveragePercent: activeRun
          ? Math.round(
              (activeRun.records.flatMap((r) => r.evidence).filter((e) => e.verification !== "Needs verification").length /
                Math.max(1, activeRun.records.flatMap((r) => r.evidence).length)) *
                100,
            )
          : 78,
      },
      tasks,
    };
  },
);

// ─── Rerun Workflow ───────────────────────────────────────────────────────────
export const rerunWorkflowFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ requestId: z.string().optional() }).parse(input),
  )
  .handler(
    async ({ data }): Promise<{ success: boolean; newRun?: PersistedRun; comparison?: RunComparison; error?: string }> => {
      try {
        const { rerunWorkflow, getActiveRun, getStore } = await import("../server/storage");
        let reqId = data.requestId;
        if (!reqId) {
          const activeRun = await getActiveRun();
          const store = await getStore();
          reqId = activeRun ? activeRun.requestId : store.activeRequestId;
        }

        const res = await rerunWorkflow(reqId);
        return { success: true, newRun: res.newRun, comparison: res.comparison };
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Failed to rerun workflow",
        };
      }
    },
  );
