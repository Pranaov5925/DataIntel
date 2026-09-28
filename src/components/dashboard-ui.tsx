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
        "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold",
        tone === "success" && "bg-success-muted text-success",
        tone === "active" && "bg-primary-muted text-primary",
        tone === "warning" && "bg-warning-muted text-warning-foreground",
        tone === "danger" && "bg-danger-muted text-destructive",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
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
    <div className="border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {trend && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-success">
            <TrendingUp className="size-3" />
            {trend}
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-3xl font-semibold text-card-foreground">{value}</p>
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
    <div className="flex items-center justify-between border-b border-border px-5 py-4">
      <div>
        <h3 className="text-sm font-semibold text-card-foreground">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Confidence({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            value >= 90 ? "bg-success" : value >= 85 ? "bg-primary" : "bg-warning",
          )}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums">{value}%</span>
    </div>
  );
}

export type TaskItem = {
  id: string;
  name: string;
  status: "Running" | "Complete" | "Needs review" | "Queued" | string;
  progress: number;
  records: number;
  quality: number;
  updated: string;
};

export function TaskTable({
  compact = false,
  tasks: customTasks,
}: {
  compact?: boolean | undefined;
  tasks?: TaskItem[] | undefined;
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
            <th className="w-12 px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {list.slice(0, compact ? 4 : undefined).map((task) => (
            <tr key={task.id} className="border-b border-border last:border-0 hover:bg-muted/30">
              <td className="px-5 py-3.5">
                <Link
                  to={task.status === "Running" ? "/workflow" : "/datasets"}
                  className="font-medium text-foreground hover:text-primary"
                >
                  {task.name}
                </Link>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{task.id}</p>
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
              <td className="px-4 py-3.5">
                <Button variant="ghost" size="icon" aria-label={`Actions for ${task.name}`}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function QualityCallout() {
  return (
    <div className="border border-primary/20 bg-primary-muted p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <TrendingUp className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">Adaptive collection improved this run</h3>
            <span className="rounded-full bg-success-muted px-2 py-0.5 text-[10px] font-semibold text-success">
              Salary evidence 42% → 78%
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Salary was missing or insufficient for 29 of 47 records. The workflow triggered targeted
            searches on salary-bearing sources and recovered coverage without manual intervention.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-px border border-primary/15 bg-primary/15 sm:grid-cols-4">
            {adaptiveOutcomes.map(([v, l]) => (
              <div key={l} className="bg-card px-3 py-2.5">
                <p className="text-sm font-semibold tabular-nums">{v}</p>
                <p className="text-[10px] text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>
          <Link
            to="/history"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary"
          >
            View adaptation history <ExternalLink className="size-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export const iconForTone = (tone: string) =>
  tone === "success" ? CheckCircle2 : tone === "warning" ? CircleAlert : Clock3;
