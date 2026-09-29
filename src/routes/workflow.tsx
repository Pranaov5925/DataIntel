import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  Brain,
  Check,
  Circle,
  Clock3,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageIntro, QualityCallout, SectionHeader, iconForTone } from "@/components/dashboard-ui";
import {
  DEMO_REQUEST,
  interventions as defaultInterventions,
  understanding as defaultUnderstanding,
  workflowStages as defaultStages,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useActiveWorkflowPlan } from "@/lib/workflow-store";
import { runPipelineFn } from "@/lib/run-pipeline";
import { setPipelineResult } from "@/lib/pipeline-store";
import { getActiveRunFn, rerunWorkflowFn } from "@/lib/storage-fns";
import type { PersistedRun } from "@/lib/storage-schema";

export const Route = createFileRoute("/workflow")({
  head: () => ({
    meta: [
      { title: "Active Workflow — DataIntel" },
      {
        name: "description",
        content:
          "See how the AI understood a request, the generated collection blueprint, and adaptive decisions.",
      },
      { property: "og:title", content: "Active Workflow — DataIntel" },
      {
        property: "og:description",
        content:
          "See how the AI understood a request, the generated collection blueprint, and adaptive decisions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WorkflowPage,
});

export function WorkflowPage() {
  const plan = useActiveWorkflowPlan();
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [persistedRun, setPersistedRun] = useState<PersistedRun | null>(null);

  useEffect(() => {
    let mounted = true;
    getActiveRunFn()
      .then((run) => {
        if (mounted && run) setPersistedRun(run);
      })
      .catch((err) => console.error("Failed to load active run:", err));
    return () => {
      mounted = false;
    };
  }, []);

  const title = plan ? plan.title : persistedRun ? persistedRun.requestName : "Indian SaaS companies hiring Java backend developers";
  const eyebrow = running
    ? `Executing · ${plan?.id ?? persistedRun?.requestId ?? "DR-1048"}`
    : plan
      ? `Ready to execute · ${plan.id}`
      : `Active run · ${persistedRun?.requestId ?? "DR-1048"} (v${persistedRun?.runNumber ?? 2})`;
  const description = plan ? plan.request : persistedRun ? persistedRun.originalPrompt : DEMO_REQUEST;

  async function handleRunPipeline() {
    if (running) return;

    if (plan) {
      setRunning(true);
      setPipelineError(null);

      try {
        const res = await runPipelineFn({
          data: {
            planId: plan.id,
            title: plan.title,
            request: plan.request,
            understanding: plan.understanding,
            requiredFields: Array.isArray(plan.understanding.requiredFields)
              ? plan.understanding.requiredFields
              : [String(plan.understanding.requiredFields)],
            geography: plan.understanding.geography,
            industry: plan.understanding.industry,
            target: plan.understanding.target,
            constraints: Array.isArray(plan.understanding.constraints)
              ? plan.understanding.constraints
              : [String(plan.understanding.constraints)],
            freshness: plan.understanding.freshness,
            searchIntent: plan.understanding.searchIntent,
            stages: plan.stages,
          },
        });

        if (!res.success) {
          setPipelineError(res.error ?? "Pipeline execution failed.");
          setRunning(false);
          return;
        }

        setPipelineResult(res.data);
        await navigate({ to: "/datasets" });
      } catch (err: unknown) {
        setPipelineError(
          err instanceof Error ? err.message : "An unexpected error occurred during pipeline execution.",
        );
        setRunning(false);
      }
    } else if (persistedRun) {
      setRunning(true);
      setPipelineError(null);
      try {
        const res = await rerunWorkflowFn({
          data: {
            requestId: persistedRun.requestId,
          },
        });
        if (res.success && res.newRun) {
          setPersistedRun(res.newRun);
          await navigate({ to: "/datasets" });
        } else {
          setPipelineError(res.error ?? "Failed to rerun workflow.");
        }
      } catch (err: unknown) {
        setPipelineError(err instanceof Error ? err.message : "Rerun error");
      } finally {
        setRunning(false);
      }
    }
  }

  const understandingItems: [string, string][] = plan
    ? [
        ["Objective", plan.understanding.objective],
        ["Target", plan.understanding.target],
        ["Geography", plan.understanding.geography],
        ["Industry", plan.understanding.industry],
        [
          "Constraints",
          Array.isArray(plan.understanding.constraints)
            ? plan.understanding.constraints.join("; ")
            : String(plan.understanding.constraints ?? "—"),
        ],
        [
          "Required fields",
          Array.isArray(plan.understanding.requiredFields)
            ? plan.understanding.requiredFields.join(", ")
            : String(plan.understanding.requiredFields ?? "—"),
        ],
        ["Freshness", plan.understanding.freshness],
        ["Search intent", plan.understanding.searchIntent],
      ]
    : persistedRun
      ? [
          ["Objective", persistedRun.understanding.objective],
          ["Target", persistedRun.understanding.target],
          ["Geography", persistedRun.understanding.geography],
          ["Industry", persistedRun.understanding.industry],
          [
            "Constraints",
            Array.isArray(persistedRun.understanding.constraints)
              ? persistedRun.understanding.constraints.join("; ")
              : String(persistedRun.understanding.constraints ?? "—"),
          ],
          [
            "Required fields",
            Array.isArray(persistedRun.understanding.requiredFields)
              ? persistedRun.understanding.requiredFields.join(", ")
              : String(persistedRun.understanding.requiredFields ?? "—"),
          ],
          ["Freshness", persistedRun.understanding.freshness],
          ["Search intent", persistedRun.understanding.searchIntent],
        ]
      : (defaultUnderstanding as unknown as [string, string][]);

  const stages = plan
    ? plan.stages
    : persistedRun
      ? persistedRun.executedStages.map((s) => ({
          name: s.name,
          detail: s.detail,
          status: s.status,
          count: s.count,
        }))
      : defaultStages;

  const blueprintSubtitle = plan
    ? `${plan.stages.length}-step workflow generated for this request`
    : persistedRun
      ? `${stages.length}-step workflow executed with verified provenance`
      : "8-step workflow generated by the AI for this request";

  const interventions = persistedRun ? persistedRun.interventions : defaultInterventions;
  const validatedCount = persistedRun ? persistedRun.quality.validated : 31;
  const uniqueCount = persistedRun ? persistedRun.quality.unique : 36;
  const qualityScore = persistedRun
    ? Math.round((persistedRun.quality.validated / Math.max(1, persistedRun.quality.unique)) * 100)
    : 88;

  // Derive salary coverage before/after from real adaptiveSummary or stages
  const coverageOutcome = persistedRun?.adaptiveSummary?.match(/from (\d+)% to (\d+)%/);
  const singleCoverage = persistedRun?.adaptiveSummary?.match(/coverage is (\d+)%/);
  const coverageBefore = coverageOutcome ? Number(coverageOutcome[1]) : singleCoverage ? Number(singleCoverage[1]) : (persistedRun ? 50 : 0);
  const coverageAfter = coverageOutcome ? Number(coverageOutcome[2]) : singleCoverage ? Number(singleCoverage[1]) : (persistedRun ? 80 : 0);

  return (
    <div>
      <PageIntro
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          <>
            <Link to="/requests">
              <Button variant="outline" disabled={running}>
                <Plus className="size-4" />
                New request
              </Button>
            </Link>
            <Button onClick={handleRunPipeline} disabled={running}>
              {running ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Collecting data…
                </>
              ) : plan ? (
                <>
                  <Play className="size-4" />
                  Run pipeline
                </>
              ) : (
                <>
                  <RotateCcw className="size-4" />
                  Rerun pipeline
                </>
              )}
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {[
          ["Progress", running ? "Executing…" : plan ? "Ready to run" : "100% Complete"],
          ["Records", running ? "Collecting…" : plan ? "—" : `${uniqueCount} unique`],
          ["Quality score", running ? "Processing…" : plan ? "—" : `${qualityScore} / 100`],
          ["Status", running ? "Running…" : plan ? "Pending" : "Dataset Ready"],
        ].map(([label, value]) => (
          <div className="border border-border bg-card p-4" key={label}>
            <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
            <p className={cn("mt-2 text-xl font-semibold tabular-nums", running && "text-primary animate-pulse")}>{value}</p>
          </div>
        ))}
      </div>

      <section className="mb-6 border border-border bg-card">
        <SectionHeader
          title="AI understanding"
          subtitle={
            plan
              ? "Live structured breakdown of your natural-language requirements"
              : "Structured requirement breakdown before collection began"
          }
          action={
            <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
              {(plan || persistedRun) && <Sparkles className="size-3.5" />}
              <Brain className="size-4" />
            </div>
          }
        />
        <dl className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          {understandingItems.map(([k, v]) => (
            <div key={k} className="bg-card px-5 py-3.5">
              <dt className="text-[10px] font-semibold uppercase text-muted-foreground">{k}</dt>
              <dd className="mt-1 text-xs font-medium leading-5">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,.65fr)]">
        <div className="space-y-6">
          <section className="border border-border bg-card">
            <SectionHeader title="Collection blueprint" subtitle={blueprintSubtitle} />

            {pipelineError && (
              <div className="mx-5 mt-4 rounded-md border border-destructive/40 bg-danger-muted p-4 text-xs text-destructive">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-semibold">Pipeline Execution Error</p>
                    <p className="mt-1 leading-5 text-muted-foreground">{pipelineError}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="px-5 py-2">
              {stages.map((stage, index) => {
                const isExecuting = running && stage.status === "pending";
                return (
                  <div
                    key={`${stage.name}-${index}`}
                    className="relative flex gap-4 py-4 after:absolute after:bottom-0 after:left-[15px] after:top-10 after:w-px after:bg-border last:after:hidden"
                  >
                    <span
                      className={cn(
                        "z-10 flex size-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                        stage.status === "complete" &&
                          "border-success bg-success text-success-foreground",
                        (stage.status === "active" || (running && index === stages.findIndex((s) => s.status === "pending"))) &&
                          "border-primary bg-primary-muted text-primary",
                        stage.status === "pending" && !isExecuting &&
                          "border-border bg-background text-muted-foreground",
                      )}
                    >
                      {stage.status === "complete" ? (
                        <Check className="size-4" />
                      ) : stage.status === "active" || (running && index === stages.findIndex((s) => s.status === "pending")) ? (
                        <span className="size-2 animate-pulse rounded-full bg-primary" />
                      ) : (
                        <Circle className="size-3" />
                      )}
                    </span>
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">
                          <span className="mr-1.5 text-muted-foreground">{index + 1}.</span>
                          {stage.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{stage.detail}</p>
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                        {stage.count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <QualityCallout />
        </div>

        <aside className="space-y-6">
          <section className="border border-border bg-card">
            <SectionHeader
              title="Adaptive decisions"
              subtitle="Live audit trail of adjustments made"
            />
            <div className="p-5">
              {interventions.map((item) => {
                const Icon = iconForTone(item.tone);
                return (
                  <div key={item.title} className="relative flex gap-3 pb-6 last:pb-0">
                    <Icon
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        item.tone === "success"
                          ? "text-success"
                          : item.tone === "warning"
                            ? "text-warning"
                            : "text-primary",
                      )}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold">{item.title}</p>
                        <span className="text-[10px] tabular-nums text-muted-foreground">
                          {item.time}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                );
              })}
              <div className="mt-2 border-t border-border pt-4">
                <p className="text-[10px] uppercase text-muted-foreground">
                  Salary evidence coverage
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-sm font-semibold text-warning">{coverageBefore}%</span>
                  <div className="relative h-2 flex-1 rounded-full bg-muted">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-success/40" style={{ width: `${coverageAfter}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-full bg-success" style={{ width: `${coverageBefore}%` }} />
                  </div>
                  <span className="text-sm font-semibold text-success">{coverageAfter}%</span>
                </div>
              </div>
            </div>
          </section>

          <section className="border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Validated records ready to inspect</p>
                <p className="mt-1 text-2xl font-semibold">{validatedCount}</p>
              </div>
              <Clock3 className="size-5 text-primary" />
            </div>
            <Link
              to="/datasets"
              className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs font-semibold text-primary hover:underline"
            >
              Open live dataset <ArrowRight className="size-4" />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
