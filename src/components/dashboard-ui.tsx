import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
  MoreHorizontal,
  TrendingUp,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { adaptiveOutcomes, tasks } from "@/lib/mock-data";

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase text-primary">{eyebrow}</p>}
        <h2 className="font-display text-2xl font-semibold text-foreground md:text-[28px]">
          {title}
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Complete" || status === "Verified" || status === "Confirmed"
      ? "success"
      : status === "Running"
        ? "active"
        : status === "Conflict" || status === "Needs verification"
          ? "danger"
          : "warning";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide transition-all shadow-xs",
        tone === "success" && "border border-success/30 bg-success-muted text-success",
        tone === "active" && "border border-primary/30 bg-primary-muted text-primary font-semibold",
        tone === "warning" && "border border-warning/30 bg-warning-muted text-warning-foreground",
        tone === "danger" && "border border-destructive/30 bg-danger-muted text-destructive",
      )}
    >
      <span
        className={cn("size-1.5 rounded-full bg-current", tone === "active" && "animate-pulse")}
      />
      {status}
    </span>
  );
}

export function Metric({
  label,
  value,
  detail,
  trend,
}: {
  label: string;
  value: string;
  detail: string;
  trend?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/80 bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
          {label}
        </p>
        {trend && (
          <span className="flex items-center gap-1 rounded-full bg-success-muted px-2 py-0.5 text-[10px] font-semibold text-success">
            <TrendingUp className="size-3" />
            {trend}
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-3xl font-semibold tracking-tight text-card-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/80 bg-card/50 px-5 py-4 backdrop-blur-xs">
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-card-foreground">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Confidence({
  value,
  breakdown,
}: {
  value: number;
  breakdown?: {
    requiredFieldSupport?: number;
    evidenceDirectness?: number;
    sourceQuality?: number;
    sourceAgreement?: number;
    freshness?: number;
    entityConsistency?: number;
    conflictPenalty?: number;
  };
}) {
  let label: string;
  let colorClass: string;
  if (value >= 85) {
    label = "High Reliability";
    colorClass = "bg-success";
  } else if (value >= 65) {
    label = "Moderate";
    colorClass = "bg-primary";
  } else if (value >= 40) {
    label = "Partial Evidence";
    colorClass = "bg-warning";
  } else if (value > 0) {
    label = "Low Reliability";
    colorClass = "bg-orange-400";
  } else {
    label = "Unverified";
    colorClass = "bg-muted-foreground";
  }

  const tooltipText = breakdown
    ? `Evidence Reliability: ${value}%\n• Required Field Support: ${breakdown.requiredFieldSupport ?? "—"}%\n• Evidence Directness: ${breakdown.evidenceDirectness ?? "—"}%\n• Source Quality: ${breakdown.sourceQuality ?? "—"}%\n• Source Agreement: ${breakdown.sourceAgreement ?? "—"}%\n• Entity Consistency: ${breakdown.entityConsistency ?? "—"}%${breakdown.conflictPenalty ? `\n• Conflict Penalty: -${breakdown.conflictPenalty}%` : ""}`
    : `Evidence Reliability: ${value}% (multi-dimensional evidence verification score)`;

  return (
    <div className="flex flex-col gap-0.5" title={tooltipText}>
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", colorClass)}
            style={{ width: `${Math.max(value, 2)}%` }}
          />
        </div>
        <span className="text-xs font-semibold tabular-nums">{value}%</span>
      </div>
      <span
        className={cn(
          "text-[9px] font-medium",
          value >= 85
            ? "text-success"
            : value >= 65
              ? "text-primary"
              : value >= 40
                ? "text-warning"
                : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </div>
  );
}

export type TaskItem = {
  id: string;
  runId?: string | undefined;
  name: string;
  prompt?: string | undefined;
  status: "Running" | "Complete" | "Needs review" | "Queued" | string;
  progress: number;
  records: number;
  quality: number;
  updated: string;
};

export function TaskTable({
  compact = false,
  tasks: customTasks,
  destination = "workflow",
}: {
  compact?: boolean | undefined;
  tasks?: TaskItem[] | undefined;
  destination?: "workflow" | "datasets" | undefined;
}) {
  const list = customTasks ?? tasks;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-[10px] font-semibold uppercase text-muted-foreground">
            <th className="px-5 py-3">Request</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Progress</th>
            <th className="px-4 py-3">Records</th>
            <th className="px-4 py-3">Quality</th>
            <th className="px-4 py-3">Updated</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.slice(0, compact ? 4 : undefined).map((task) => {
            const taskRunId =
              "runId" in task && typeof task.runId === "string" ? task.runId : undefined;
            const targetRoute =
              destination === "workflow"
                ? "/workflow"
                : destination === "datasets"
                  ? "/datasets"
                  : task.status === "Running"
                    ? "/workflow"
                    : "/workflow";
            return (
              <tr key={task.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-5 py-3.5">
                  <Link
                    to={targetRoute}
                    search={taskRunId ? { runId: taskRunId } : {}}
                    className="font-medium text-foreground hover:text-primary transition"
                  >
                    {task.name}
                  </Link>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{taskRunId || task.id}</p>
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={task.status} />
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {task.progress}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-sm tabular-nums">{task.records}</td>
                <td className="px-4 py-3.5">
                  <Confidence value={task.quality} />
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">{task.updated}</td>
                <td className="px-4 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      to="/workflow"
                      search={taskRunId ? { runId: taskRunId } : {}}
                      className="inline-flex items-center rounded border border-border bg-background px-2 py-1 text-[11px] font-semibold text-primary transition hover:border-primary/50 hover:bg-primary-muted"
                    >
                      Workflow
                    </Link>
                    {taskRunId && (
                      <Link
                        to="/datasets"
                        search={{ runId: taskRunId }}
                        className="inline-flex items-center text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                      >
                        Dataset
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function QualityCallout({
  summary,
  headline,
  pill,
  outcomes,
}: {
  summary?: string | undefined;
  headline?: string | undefined;
  pill?: string | undefined;
  outcomes?: [string, string][] | undefined;
} = {}) {
  const displayOutcomes = outcomes && outcomes.length > 0 ? outcomes : adaptiveOutcomes;
  const displayHeadline = headline || "Adaptive collection and deterministic qualification";
  const displaySummary =
    summary ||
    "Automated qualification validates each candidate record against hard constraints, recovers missing facts, and flags cross-source conflicts.";

  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3.5">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
          <TrendingUp className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-card-foreground">{displayHeadline}</h3>
            {pill && (
              <span className="rounded-full border border-success/30 bg-success-muted px-2 py-0.5 text-[10px] font-semibold text-success">
                {pill}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{displaySummary}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {displayOutcomes.map(([v, l]) => (
              <div
                key={l}
                className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50"
              >
                <p className="font-display text-sm font-semibold tabular-nums text-foreground">
                  {v}
                </p>
                <p className="text-[10px] text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>
          <Link
            to="/history"
            className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition-colors hover:underline"
          >
            View adaptation history <ExternalLink className="size-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const iconForTone = (tone: string) =>
  tone === "success" ? CheckCircle2 : tone === "warning" ? CircleAlert : Clock3;
