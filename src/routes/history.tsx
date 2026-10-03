import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, GitBranch, Loader2, RotateCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageIntro, SectionHeader, TaskTable } from "@/components/dashboard-ui";
import { DEMO_REQUEST, history as mockHistory } from "@/lib/mock-data";
import {
  getHistoryDataFn,
  rerunWorkflowFn,
  setActiveRunFn,
  type HistoryData,
} from "@/lib/storage-fns";
import type { PersistedRun } from "@/lib/storage-schema";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Workflow History — DataIntel" },
      {
        name: "description",
        content: "Review workflow versions, adaptive decisions, and prior collection runs.",
      },
      { property: "og:title", content: "Workflow History — DataIntel" },
      {
        property: "og:description",
        content: "Review workflow versions, adaptive decisions, and prior collection runs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rerunning, setRerunning] = useState(false);
  const [rerunMessage, setRerunMessage] = useState<string | null>(null);

  async function loadHistory() {
    try {
      const res = await getHistoryDataFn();
      setData(res);
    } catch (e) {
      console.error("Failed to load history data:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function handleRerun() {
    if (rerunning) return;
    setRerunning(true);
    setRerunMessage(null);

    try {
      const res = await rerunWorkflowFn({
        data: {
          requestId: data?.activeRun?.requestId,
        },
      });

      if (res.success && res.newRun) {
        setRerunMessage(
          `Run #${res.newRun.runNumber} created successfully! +${res.newRun.quality.validated} validated records.`,
        );
        await loadHistory();
      } else {
        setRerunMessage(res.error ?? "Failed to rerun workflow.");
      }
    } catch (err: unknown) {
      setRerunMessage(err instanceof Error ? err.message : "Error executing rerun.");
    } finally {
      setRerunning(false);
    }
  }

  async function handleSelectRun(run: PersistedRun) {
    try {
      await setActiveRunFn({ data: { runId: run.id } });
      await navigate({ to: "/datasets", search: { runId: run.id } });
    } catch (err) {
      console.error("Failed to select run:", err);
    }
  }

  const activeRun = data?.activeRun;
  const requestRuns = data?.requestRuns && data.requestRuns.length > 0 ? data.requestRuns : null;

  const title = activeRun?.requestName || "Indian SaaS companies hiring Java backend developers";
  const subtitle = activeRun
    ? `${activeRun.requestId} · Current workflow version v${activeRun.runNumber}`
    : "DR-1048 · Current workflow version v2";
  const prompt = activeRun?.originalPrompt || DEMO_REQUEST;

  return (
    <div>
      <PageIntro
        eyebrow="Audit trail"
        title="Workflow history"
        description="A complete record of generated blueprints, quality-triggered changes, and collection outcomes."
        actions={
          <Button variant="outline" onClick={handleRerun} disabled={rerunning}>
            {rerunning ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Rerunning workflow…
              </>
            ) : (
              <>
                <RotateCw className="size-4" />
                Rerun workflow
              </>
            )}
          </Button>
        }
      />

      {rerunMessage && (
        <div className="mb-6 rounded-md border border-primary/30 bg-primary-muted p-4 text-xs text-primary font-medium flex items-center justify-between">
          <span>{rerunMessage}</span>
          <button
            onClick={() => setRerunMessage(null)}
            className="text-[11px] underline hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)]">
        <section className="border border-border bg-card">
          <SectionHeader title={title} subtitle={subtitle} />
          <div className="border-b border-border bg-muted/30 px-5 py-3">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
              Original request
            </p>
            <p className="mt-1 text-xs leading-5">{prompt}</p>
          </div>
          <div className="p-5">
            {requestRuns ? (
              requestRuns.map((run, index) => {
                const isCurrent = run.id === activeRun?.id;
                const trigger =
                  run.runNumber > 1
                    ? run.comparison
                      ? "Workflow Rerun"
                      : "Adaptive retry"
                    : "Initial collection";

                const change =
                  run.adaptiveSummary ||
                  run.comparison?.summary ||
                  "Executed collection blueprint across permitted sources";

                const outcome = run.comparison
                  ? `${run.comparison.validatedDelta >= 0 ? `+${run.comparison.validatedDelta}` : run.comparison.validatedDelta} validated records`
                  : `${run.quality.validated} validated records`;

                return (
                  <div
                    key={run.id}
                    className="relative flex gap-4 pb-7 last:pb-0 after:absolute after:bottom-0 after:left-4 after:top-9 after:w-px after:bg-border last:after:hidden"
                  >
                    <span className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-[11px] font-bold">
                      v{run.runNumber}
                    </span>
                    <div className="min-w-0 flex-1 border border-border p-4">
                      <div className="flex flex-col justify-between gap-2 sm:flex-row">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">
                              {trigger}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-semibold text-primary">
                                Current
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-sm font-medium">{change}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {run.completedAt || run.createdAt}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span className="flex items-center gap-2 text-success font-medium">
                            <CheckCircle2 className="size-3.5" />
                            {outcome}
                          </span>
                          <span className="text-muted-foreground">{run.quality.unique} unique</span>
                          <span className="text-muted-foreground">
                            {run.sources.length} sources
                          </span>
                          <span className="text-muted-foreground">
                            {run.quality.conflicts} conflicts
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={async () => {
                              try {
                                await setActiveRunFn({ data: { runId: run.id } });
                              } catch {
                                // ignore
                              }
                              navigate({ to: "/workflow", search: { runId: run.id } });
                            }}
                            className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                          >
                            Workflow
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await setActiveRunFn({ data: { runId: run.id } });
                              } catch {
                                // ignore
                              }
                              navigate({ to: "/evidence", search: { runId: run.id } });
                            }}
                            className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                          >
                            Evidence
                          </button>
                          <button
                            onClick={() => handleSelectRun(run)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                          >
                            Inspect dataset <ExternalLink className="size-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center">
                <GitBranch className="mx-auto size-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-semibold">No collection runs yet</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                  Execute a research workflow to begin recording versioned collection runs and
                  adaptive decisions.
                </p>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="border border-border bg-card p-5">
            <GitBranch className="size-5 text-primary" />
            <h3 className="mt-4 text-sm font-semibold">
              {activeRun?.comparison ? "What changed between runs" : "Why the workflow changed"}
            </h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {activeRun?.comparison
                ? activeRun.comparison.summary
                : "The platform continuously checks field coverage, duplicates, and agreement between sources. When salary evidence fell below threshold, it added targeted searches instead of guessing values."}
            </p>
            <div className="mt-5 border-t border-border pt-4">
              <p className="text-[10px] uppercase text-muted-foreground">Net impact this run</p>
              <p className="mt-2 text-2xl font-semibold text-success">
                {activeRun?.comparison
                  ? `${activeRun.comparison.validatedDelta >= 0 ? `+${activeRun.comparison.validatedDelta}` : activeRun.comparison.validatedDelta} validated`
                  : "+17 pts"}
              </p>
              <p className="text-xs text-muted-foreground">
                {activeRun?.comparison
                  ? `Previous: ${activeRun.quality.validated - activeRun.comparison.validatedDelta} → Current: ${activeRun.quality.validated} records`
                  : "Quality score 71 → 88"}
              </p>
            </div>
            {activeRun?.comparison && (
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-4 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">
                    Records delta
                  </span>
                  <span className="font-semibold text-foreground">
                    {activeRun.comparison.recordsDelta >= 0
                      ? `+${activeRun.comparison.recordsDelta}`
                      : activeRun.comparison.recordsDelta}{" "}
                    records
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">
                    Conflicts
                  </span>
                  <span className="font-semibold text-foreground">
                    {activeRun.comparison.conflictsDelta <= 0
                      ? `${activeRun.comparison.conflictsDelta}`
                      : `+${activeRun.comparison.conflictsDelta}`}{" "}
                    resolved
                  </span>
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>

      <section className="mt-6 border border-border bg-card">
        <SectionHeader
          title="All workflow runs"
          subtitle="Current and previous hiring research requests"
        />
        {data?.allRequests ? <TaskTable tasks={data.allRequests} /> : <TaskTable />}
      </section>
    </div>
  );
}
