import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  Brain,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Database,
  FileSearch,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Waypoints,
  X,
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
import { useActiveWorkflowPlan, setActiveWorkflowPlan } from "@/lib/workflow-store";
import { startPipelineRunFn, getPipelineProgressFn } from "@/lib/run-pipeline";
import {
  getWorkflowDataFn,
  setActiveRunFn,
  rerunWorkflowFn,
  type WorkflowRunSummary,
} from "@/lib/storage-fns";
import type { PersistedRun } from "@/lib/storage-schema";

export type WorkflowSearch = {
  runId?: string | undefined;
};

export const Route = createFileRoute("/workflow")({
  validateSearch: (search: Record<string, unknown>): WorkflowSearch => ({
    runId: typeof search["runId"] === "string" ? (search["runId"] as string) : undefined,
  }),
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
  const search = Route.useSearch();
  const explicitRunId = search?.runId;
  const plan = useActiveWorkflowPlan();
  const navigate = useNavigate();

  const [running, setRunning] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [persistedRun, setPersistedRun] = useState<PersistedRun | null>(null);
  const [availableRuns, setAvailableRuns] = useState<WorkflowRunSummary[]>([]);
  const [rerunSuccess, setRerunSuccess] = useState<{
    runId: string;
    runNumber: number;
    validatedCount: number;
    validatedDelta: number;
    recordsDelta: number;
  } | null>(null);

  const [pipelineProgress, setPipelineProgress] = useState<{
    state: string;
    percent: number;
    stageName: string;
    detail: string;
  } | null>(null);

  // Load workflow run data
  useEffect(() => {
    let mounted = true;
    getWorkflowDataFn({ data: { runId: explicitRunId } })
      .then((res) => {
        if (mounted) {
          if (res.activeRun) setPersistedRun(res.activeRun);
          setAvailableRuns(res.runs);
        }
      })
      .catch((err) => console.error("Failed to load workflow data:", err));

    return () => {
      mounted = false;
    };
  }, [explicitRunId]);

  // If a pending plan was already executed into persistedRun, clear it from session storage
  useEffect(() => {
    if (plan && persistedRun && (plan.id === persistedRun.requestId || explicitRunId)) {
      setActiveWorkflowPlan(null);
    }
  }, [plan, persistedRun, explicitRunId]);

  // Determine whether we are previewing an unexecuted plan or viewing an executed workflow
  const isPendingPlan =
    !explicitRunId && Boolean(plan) && (!persistedRun || plan?.id !== persistedRun.requestId);
  const activePlan = isPendingPlan ? plan : null;

  const title = activePlan
    ? activePlan.title
    : persistedRun
      ? persistedRun.requestName
      : "Data Collection Workflow";

  const eyebrow = running
    ? `Executing · ${activePlan?.id ?? persistedRun?.id ?? "Pipeline"}`
    : isPendingPlan && activePlan
      ? `Ready to execute · ${activePlan.id}`
      : persistedRun
        ? `Run · ${persistedRun.id}`
        : "Data collection workflow";

  const description = activePlan
    ? activePlan.request
    : persistedRun
      ? persistedRun.originalPrompt
      : DEMO_REQUEST;

  // Execute an unexecuted pending plan
  async function handleRunPendingPlan() {
    if (!activePlan || running) return;

    setRunning(true);
    setPipelineError(null);
    setRerunSuccess(null);
    setPipelineProgress({
      state: "QUEUED",
      percent: 5,
      stageName: "Queued",
      detail: "Initializing research pipeline...",
    });

    try {
      const startRes = await startPipelineRunFn({
        data: {
          planId: activePlan.id,
          title: activePlan.title,
          request: activePlan.request,
          understanding: activePlan.understanding,
          requiredFields: Array.isArray(activePlan.understanding.requiredFields)
            ? activePlan.understanding.requiredFields
            : [String(activePlan.understanding.requiredFields)],
          geography: activePlan.understanding.geography,
          industry: activePlan.understanding.industry,
          target: activePlan.understanding.target,
          constraints: Array.isArray(activePlan.understanding.constraints)
            ? activePlan.understanding.constraints
            : [String(activePlan.understanding.constraints)],
          freshness: activePlan.understanding.freshness,
          searchIntent: activePlan.understanding.searchIntent,
          stages: activePlan.stages,
        },
      });

      if (!startRes.success || !startRes.runId) {
        setPipelineError(startRes.error ?? "Failed to initialize pipeline.");
        setRunning(false);
        return;
      }

      const runId = startRes.runId;

      // Poll progress until completion
      const pollTimer = setInterval(async () => {
        try {
          const prog = await getPipelineProgressFn({ data: { runId } });
          if (!prog) return;

          setPipelineProgress({
            state: prog.state,
            percent: prog.percent,
            stageName: prog.stageName,
            detail: prog.detail,
          });

          if (prog.state === "COMPLETED") {
            clearInterval(pollTimer);
            setActiveWorkflowPlan(null);
            await setActiveRunFn({ data: { runId } });
            const fresh = await getWorkflowDataFn({ data: { runId } });
            if (fresh.activeRun) setPersistedRun(fresh.activeRun);
            setAvailableRuns(fresh.runs);
            setRunning(false);
            setRerunSuccess({
              runId,
              runNumber: fresh.activeRun?.runNumber ?? 1,
              validatedCount: fresh.activeRun?.quality?.validated ?? 0,
              validatedDelta: 0,
              recordsDelta: fresh.activeRun?.quality?.unique ?? 0,
            });
            await navigate({ to: "/datasets", search: { runId } });
          } else if (prog.state === "FAILED" || prog.state === "CANCELLED") {
            clearInterval(pollTimer);
            setRunning(false);
            setPipelineError(prog.error || prog.detail || "Pipeline execution failed.");
          }
        } catch (pollErr) {
          console.warn("Progress polling error:", pollErr);
        }
      }, 1000);
    } catch (err: unknown) {
      setPipelineError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during pipeline execution.",
      );
      setRunning(false);
    }
  }

  // Rerun an existing workflow to collect an updated dataset
  async function handleRerunWorkflow() {
    if (!persistedRun || running) return;

    setRunning(true);
    setPipelineError(null);
    setRerunSuccess(null);
    setPipelineProgress({
      state: "PLANNING",
      percent: 15,
      stageName: "Rerun Planning",
      detail: `Planning workflow rerun for "${persistedRun.requestName}"...`,
    });

    try {
      const progressSteps = [
        {
          state: "RETRIEVING",
          percent: 40,
          stageName: "Web Search",
          detail: "Querying live web sources for fresh candidate records...",
        },
        {
          state: "EXTRACTING",
          percent: 65,
          stageName: "Entity Extraction",
          detail: "Extracting attributes, normalizing values, and capturing citations...",
        },
        {
          state: "QUALIFYING",
          percent: 85,
          stageName: "Constraint Verification",
          detail: "Applying qualification rules and computing quality deltas...",
        },
      ];

      let stepIdx = 0;
      const progressInterval = setInterval(() => {
        if (stepIdx < progressSteps.length) {
          const p = progressSteps[stepIdx]!;
          setPipelineProgress({
            state: p.state,
            percent: p.percent,
            stageName: p.stageName,
            detail: p.detail,
          });
          stepIdx++;
        }
      }, 1000);

      const res = await rerunWorkflowFn({
        data: {
          requestId: persistedRun.requestId,
        },
      });

      clearInterval(progressInterval);

      if (res.success && res.newRun) {
        setPersistedRun(res.newRun);
        await setActiveRunFn({ data: { runId: res.newRun.id } });
        const fresh = await getWorkflowDataFn({ data: { runId: res.newRun.id } });
        setAvailableRuns(fresh.runs);
        setRerunSuccess({
          runId: res.newRun.id,
          runNumber: res.newRun.runNumber,
          validatedCount: res.newRun.quality?.validated ?? 0,
          validatedDelta: res.comparison?.validatedDelta ?? 0,
          recordsDelta: res.comparison?.recordsDelta ?? 0,
        });
        setPipelineProgress({
          state: "COMPLETED",
          percent: 100,
          stageName: "Dataset Updated",
          detail: `Workflow rerun complete. Run v${res.newRun.runNumber} is published.`,
        });
        await navigate({ to: "/workflow", search: { runId: res.newRun.id } });
      } else {
        setPipelineError(res.error ?? "Failed to rerun workflow.");
      }
    } catch (err: unknown) {
      setPipelineError(err instanceof Error ? err.message : "Rerun error occurred");
    } finally {
      setRunning(false);
    }
  }

  function formatConstraintDisplay(c: unknown): string {
    if (!c) return "";
    if (typeof c === "string") return c;
    if (typeof c === "object" && c !== null) {
      const sc = c as {
        field?: string;
        operator?: string;
        value?: string;
        valueTo?: string;
        unit?: string;
      };
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

  function renderConstraintsText(understanding: unknown): string {
    const u = understanding as
      { structuredConstraints?: unknown[]; constraints?: unknown[] } | null | undefined;
    if (Array.isArray(u?.structuredConstraints) && u.structuredConstraints.length > 0) {
      return u.structuredConstraints.map(formatConstraintDisplay).join("; ");
    }
    if (Array.isArray(u?.constraints) && u.constraints.length > 0) {
      return u.constraints.map(formatConstraintDisplay).join("; ");
    }
    if (u?.constraints) {
      return formatConstraintDisplay(u.constraints);
    }
    return "None";
  }

  // Derive understanding items based on current active target
  const understandingItems: [string, string][] =
    isPendingPlan && activePlan
      ? [
          ["Objective", activePlan.understanding.objective],
          ["Target", activePlan.understanding.target],
          ["Geography", activePlan.understanding.geography],
          ["Industry", activePlan.understanding.industry],
          ["Constraints", renderConstraintsText(activePlan.understanding)],
          [
            "Required fields",
            Array.isArray(activePlan.understanding.requiredFields)
              ? activePlan.understanding.requiredFields.join(", ")
              : String(activePlan.understanding.requiredFields ?? "—"),
          ],
          ["Freshness", activePlan.understanding.freshness],
          ["Search intent", activePlan.understanding.searchIntent],
        ]
      : persistedRun
        ? [
            ["Objective", persistedRun.understanding.objective],
            ["Target", persistedRun.understanding.target],
            ["Geography", persistedRun.understanding.geography],
            ["Industry", persistedRun.understanding.industry],
            ["Constraints", renderConstraintsText(persistedRun.understanding)],
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

  // Derive blueprint/executed stages
  const stages =
    isPendingPlan && activePlan
      ? activePlan.stages
      : persistedRun
        ? persistedRun.executedStages.map((s) => ({
            name: s.name,
            detail: s.detail,
            status: s.status,
            count: s.count,
          }))
        : defaultStages;

  const blueprintSubtitle =
    isPendingPlan && activePlan
      ? `${activePlan.stages.length}-step workflow blueprint generated for this request`
      : persistedRun
        ? `${stages.length}-step workflow executed with verified provenance`
        : "8-step workflow generated by the AI for this request";

  const interventions = persistedRun ? persistedRun.interventions : defaultInterventions;
  const validatedCount = persistedRun ? (persistedRun.quality?.validated ?? 0) : 0;
  const uniqueCount = persistedRun ? (persistedRun.quality?.unique ?? 0) : 0;
  const rawScore = persistedRun
    ? Math.round(
        ((persistedRun.quality?.validated ?? 0) / Math.max(1, persistedRun.quality?.unique ?? 1)) *
          100,
      )
    : isPendingPlan
      ? 0
      : 88;
  const qualityScore = Number.isFinite(rawScore) ? rawScore : 0;

  // Derive coverage before/after from real adaptiveSummary or stages
  const coverageOutcome = persistedRun?.adaptiveSummary?.match(/from (\d+)% to (\d+)%/);
  const singleCoverage = persistedRun?.adaptiveSummary?.match(/coverage is (\d+)%/);
  const coverageBefore = coverageOutcome
    ? Number(coverageOutcome[1])
    : singleCoverage
      ? Number(singleCoverage[1])
      : persistedRun
        ? 50
        : 0;
  const coverageAfter = coverageOutcome
    ? Number(coverageOutcome[2])
    : singleCoverage
      ? Number(singleCoverage[1])
      : persistedRun
        ? 80
        : 0;

  return (
    <div>
      {/* Switcher bar: Switch between available collection workflows */}
      {availableRuns.length > 0 && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-border/80 bg-card p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Waypoints className="size-4 text-primary shrink-0" />
            <label
              htmlFor="workflow-select"
              className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Workflow:
            </label>
            <select
              id="workflow-select"
              value={persistedRun?.id ?? ""}
              onChange={async (e) => {
                const selectedId = e.target.value;
                if (!selectedId) return;
                try {
                  await setActiveRunFn({ data: { runId: selectedId } });
                } catch {
                  // ignore
                }
                navigate({ to: "/workflow", search: { runId: selectedId } });
              }}
              className="h-8 max-w-sm rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground outline-none focus:border-ring"
            >
              {availableRuns.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.requestName} · v{r.runNumber} ({r.validated} qualified)
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {persistedRun && (
              <>
                <Link
                  to="/datasets"
                  search={{ runId: persistedRun.id }}
                  className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                >
                  <Database className="size-3.5" />
                  Dataset ({validatedCount})
                </Link>
                <span className="text-border">|</span>
                <Link
                  to="/evidence"
                  search={{ runId: persistedRun.id }}
                  className="inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground hover:underline"
                >
                  <FileSearch className="size-3.5" />
                  Evidence
                </Link>
                <span className="text-border">|</span>
                <Link
                  to="/history"
                  className="inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground hover:underline"
                >
                  History
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {/* Rerun Success Banner */}
      {rerunSuccess && (
        <div className="mb-6 flex flex-col justify-between gap-3 rounded-xl border border-success/30 bg-success/10 p-4 text-xs sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-5 shrink-0 text-success" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Workflow Rerun Complete · v{rerunSuccess.runNumber}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                Dataset updated with {rerunSuccess.validatedCount} qualified records
                {rerunSuccess.validatedDelta !== 0 && (
                  <strong className="ml-1 text-success">
                    (
                    {rerunSuccess.validatedDelta > 0
                      ? `+${rerunSuccess.validatedDelta}`
                      : rerunSuccess.validatedDelta}{" "}
                    validated delta)
                  </strong>
                )}
                . Sources and evidence citations updated.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/datasets" search={{ runId: rerunSuccess.runId }}>
              <Button size="sm">
                <Database className="size-3.5" />
                Inspect dataset
              </Button>
            </Link>
            <Link to="/evidence" search={{ runId: rerunSuccess.runId }}>
              <Button size="sm" variant="outline">
                <FileSearch className="size-3.5" />
                Evidence
              </Button>
            </Link>
            <button
              onClick={() => setRerunSuccess(null)}
              className="p-1 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss banner"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

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
            {isPendingPlan ? (
              <Button onClick={handleRunPendingPlan} disabled={running}>
                {running ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Executing blueprint…
                  </>
                ) : (
                  <>
                    <Play className="size-4" />
                    Run pipeline
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleRerunWorkflow} disabled={running}>
                {running ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Rerunning workflow…
                  </>
                ) : (
                  <>
                    <RotateCcw className="size-4" />
                    Rerun workflow
                  </>
                )}
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {[
          [
            "Progress",
            running && pipelineProgress
              ? `${pipelineProgress.percent}% · ${pipelineProgress.state}`
              : running
                ? "Executing…"
                : isPendingPlan
                  ? "Ready to run"
                  : "100% Complete",
          ],
          [
            "Records",
            running && pipelineProgress
              ? pipelineProgress.stageName
              : running
                ? "Collecting…"
                : isPendingPlan
                  ? "—"
                  : `${uniqueCount} unique`,
          ],
          [
            "Quality score",
            running ? "Evaluating…" : isPendingPlan ? "—" : `${qualityScore} / 100`,
          ],
          [
            "Status",
            running
              ? pipelineProgress?.state || "Running…"
              : isPendingPlan
                ? "Pending"
                : "Dataset Ready",
          ],
        ].map(([label, value]) => (
          <div className="border border-border bg-card p-4" key={label}>
            <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
            <p
              className={cn(
                "mt-2 text-xl font-semibold tabular-nums",
                running && "text-primary animate-pulse",
              )}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      <section className="mb-6 border border-border bg-card">
        <SectionHeader
          title="AI understanding"
          subtitle={
            isPendingPlan
              ? "Live structured breakdown of your natural-language requirements"
              : "Structured requirement breakdown before collection began"
          }
          action={
            <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
              {(isPendingPlan || persistedRun) && <Sparkles className="size-3.5" />}
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

            {running && pipelineProgress && (
              <div className="mx-5 mt-4 rounded-md border border-primary/30 bg-primary/5 p-4 text-xs">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    <span className="rounded bg-primary/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                      {pipelineProgress.state}
                    </span>
                    <span className="font-medium text-foreground">
                      {pipelineProgress.stageName}
                    </span>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-primary">
                    {pipelineProgress.percent}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${pipelineProgress.percent}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  {pipelineProgress.detail}
                </p>
              </div>
            )}

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
                const isPlanOnly = isPendingPlan && !persistedRun && !running;
                const stageProgressIndex = Math.min(
                  stages.length - 1,
                  Math.floor(((pipelineProgress?.percent ?? 10) / 100) * stages.length),
                );
                const isComplete =
                  !isPlanOnly &&
                  ((stage.status === "complete" && !running) ||
                    (running && index < stageProgressIndex) ||
                    (persistedRun && !running));
                const isActive = running && index === stageProgressIndex;

                return (
                  <div
                    key={`${stage.name}-${index}`}
                    className="relative flex gap-4 py-4 after:absolute after:bottom-0 after:left-[15px] after:top-10 after:w-px after:bg-border last:after:hidden"
                  >
                    <span
                      className={cn(
                        "z-10 flex size-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                        isComplete && "border-success bg-success text-success-foreground",
                        isActive && "border-primary bg-primary-muted text-primary",
                        (isPlanOnly || (!isComplete && !isActive)) &&
                          "border-border bg-background text-muted-foreground",
                      )}
                    >
                      {isComplete ? (
                        <Check className="size-4" />
                      ) : isActive ? (
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
                        {isPlanOnly ? "Planned" : stage.count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <QualityCallout
            summary={persistedRun?.adaptiveSummary}
            outcomes={persistedRun?.adaptiveOutcomes}
            pill={
              coverageAfter > coverageBefore
                ? `Evidence coverage ${coverageBefore}% → ${coverageAfter}%`
                : undefined
            }
          />
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
                  {persistedRun?.understanding?.optionalFields?.[0]
                    ? `${persistedRun.understanding.optionalFields[0]} evidence coverage`
                    : "Attribute evidence coverage"}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-sm font-semibold text-warning">{coverageBefore}%</span>
                  <div className="relative h-2 flex-1 rounded-full bg-muted">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-success/40"
                      style={{ width: `${coverageAfter}%` }}
                    />
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-success"
                      style={{ width: `${coverageBefore}%` }}
                    />
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
              search={persistedRun ? { runId: persistedRun.id } : {}}
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
