import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  Info,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { StatusBadge } from "@/components/dashboard-ui";
import type { DatasetRecord as MockDatasetRecord } from "@/lib/mock-data";
import type {
  DatasetRecord as PipelineDatasetRecord,
  ConstraintEvaluation,
  EvidenceBreakdown,
} from "@/lib/pipeline-schema";

type AnyRecord = PipelineDatasetRecord;

function ConstraintResultBadge({ result }: { result: string }) {
  if (result === "PASS") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success-muted px-1.5 py-0.5 text-[9px] font-semibold text-success">
        <CheckCircle2 className="size-2.5" />
        PASS
      </span>
    );
  }
  if (result === "FAIL") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-danger-muted px-1.5 py-0.5 text-[9px] font-semibold text-destructive">
        <XCircle className="size-2.5" />
        FAIL
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning-muted px-1.5 py-0.5 text-[9px] font-semibold text-warning">
      <HelpCircle className="size-2.5" />
      UNKNOWN
    </span>
  );
}

function DirectnessIndicator({
  level,
}: {
  level?: "DIRECT" | "INDIRECT" | "WEAK" | "MISSING" | undefined;
}) {
  if (!level) return null;
  if (level === "DIRECT") {
    return (
      <span className="rounded bg-success/15 px-1 py-0.5 text-[8px] font-semibold uppercase text-success">
        DIRECT
      </span>
    );
  }
  if (level === "INDIRECT") {
    return (
      <span className="rounded bg-primary/15 px-1 py-0.5 text-[8px] font-medium uppercase text-primary">
        INDIRECT
      </span>
    );
  }
  if (level === "WEAK") {
    return (
      <span className="rounded bg-warning/15 px-1 py-0.5 text-[8px] font-medium uppercase text-warning">
        WEAK
      </span>
    );
  }
  return (
    <span className="rounded bg-muted px-1 py-0.5 text-[8px] font-medium uppercase text-muted-foreground">
      MISSING
    </span>
  );
}

function FieldStatusIndicator({ value }: { value: string | null | undefined }) {
  if (value === null || value === undefined) {
    return <span className="text-[9px] font-medium text-warning">NOT_FOUND</span>;
  }
  const v = String(value);
  if (!v || v === "—" || v.toLowerCase() === "not disclosed" || v.toLowerCase() === "unknown") {
    return <span className="text-[9px] font-medium text-warning">NOT_FOUND</span>;
  }
  return <span className="text-[9px] font-medium text-success">FOUND</span>;
}

export function RecordDetail({
  record,
  onClose,
  requestedFields,
}: {
  record: AnyRecord;
  onClose?: () => void;
  requestedFields?: string[] | undefined;
}) {
  const entityTitle = record.entityName || record.company || "Record Detail";
  const entitySubtitle =
    record.entityName && record.entityName !== record.company && record.company
      ? record.company
      : record.role !== "—"
        ? record.role
        : record.source;

  // Determine dynamic fields to display
  const gridFields: [string, string | null][] = [];
  if (record.attributes && Object.keys(record.attributes).length > 0) {
    for (const [k, v] of Object.entries(record.attributes)) {
      gridFields.push([k, v]);
    }
  } else {
    gridFields.push(
      ["Location", record.location || null],
      ["Experience", record.experience || null],
      ["Salary", record.salary || null],
      ["Company size", record.size || null],
    );
  }

  const qualStatus =
    record.qualificationStatus ||
    (record.status === "Verified"
      ? "Qualified"
      : record.status === "Conflict"
        ? "Conflict"
        : record.status === "Incomplete"
          ? "Excluded"
          : "Needs verification");
  const qualReason = record.qualificationReason;
  const qualDetails = record.qualificationDetails;

  return (
    <div className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase text-primary">
          Record detail · {record.id}
        </p>
        {onClose && (
          <button
            aria-label="Close record"
            className="text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <h3 className="mt-3 text-xl font-semibold">{entityTitle}</h3>
      {entitySubtitle && <p className="mt-1 text-xs text-muted-foreground">{entitySubtitle}</p>}

      {/* Qualification Status & Reason Callout */}
      <div
        className={`mt-4 rounded-md border p-3.5 text-xs ${
          qualStatus === "Qualified"
            ? "border-success/30 bg-success-muted text-success"
            : qualStatus === "Excluded"
              ? "border-destructive/30 bg-danger-muted text-destructive"
              : qualStatus === "Conflict"
                ? "border-destructive/40 bg-danger-muted text-destructive"
                : "border-warning/30 bg-warning-muted text-warning"
        }`}
      >
        <div className="flex items-center gap-2 font-semibold">
          {qualStatus === "Qualified" ? (
            <CheckCircle2 className="size-4" />
          ) : qualStatus === "Excluded" ? (
            <XCircle className="size-4" />
          ) : qualStatus === "Conflict" ? (
            <AlertTriangle className="size-4" />
          ) : (
            <HelpCircle className="size-4" />
          )}
          <span>Qualification: {qualStatus}</span>
        </div>
        {qualReason && (
          <p className="mt-1.5 text-[11px] leading-relaxed text-foreground/90 font-normal">
            <span className="font-semibold text-muted-foreground">Reason:</span> {qualReason}
          </p>
        )}
      </div>

      {/* Evidence Reliability Breakdown */}
      <div className="mt-4 rounded-md border border-border bg-card p-3.5 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <ShieldCheck className="size-4 text-primary" />
            <span>Evidence Reliability · {record.confidence}%</span>
          </div>
          <span className="text-[10px] font-medium text-muted-foreground">
            {record.confidence >= 85
              ? "High Reliability"
              : record.confidence >= 65
                ? "Moderate Reliability"
                : record.confidence >= 40
                  ? "Partial Evidence"
                  : "Low Reliability"}
          </span>
        </div>

        {record.evidenceBreakdown ? (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded border border-border/60 bg-muted/20 p-2">
                <span className="text-[10px] text-muted-foreground block">
                  Required Field Support
                </span>
                <span className="font-semibold text-foreground">
                  {record.evidenceBreakdown.requiredFieldSupport}%
                </span>
              </div>
              <div className="rounded border border-border/60 bg-muted/20 p-2">
                <span className="text-[10px] text-muted-foreground block">Evidence Directness</span>
                <span className="font-semibold text-foreground">
                  {record.evidenceBreakdown.evidenceDirectness}%
                </span>
              </div>
              <div className="rounded border border-border/60 bg-muted/20 p-2">
                <span className="text-[10px] text-muted-foreground block">Source Quality</span>
                <span className="font-semibold text-foreground">
                  {record.evidenceBreakdown.sourceQuality}%
                </span>
              </div>
              <div className="rounded border border-border/60 bg-muted/20 p-2">
                <span className="text-[10px] text-muted-foreground block">Source Agreement</span>
                <span className="font-semibold text-foreground">
                  {record.evidenceBreakdown.sourceAgreement}%
                </span>
              </div>
              <div className="rounded border border-border/60 bg-muted/20 p-2">
                <span className="text-[10px] text-muted-foreground block">Entity Consistency</span>
                <span className="font-semibold text-foreground">
                  {record.evidenceBreakdown.entityConsistency}%
                </span>
              </div>
              <div className="rounded border border-border/60 bg-muted/20 p-2">
                <span className="text-[10px] text-muted-foreground block">Freshness</span>
                <span className="font-semibold text-foreground">
                  {record.evidenceBreakdown.freshness}%
                  <span className="text-[9px] text-muted-foreground ml-1">
                    ({record.evidenceBreakdown.freshnessStatus.toLowerCase()})
                  </span>
                </span>
              </div>
            </div>

            {record.evidenceBreakdown.conflictPenalty > 0 && (
              <p className="text-[10px] text-destructive font-medium">
                Conflict Penalty: -{record.evidenceBreakdown.conflictPenalty}% applied due to
                conflicting sources
              </p>
            )}

            {record.evidenceBreakdown.summary && (
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground border-t border-border/60 pt-2">
                {record.evidenceBreakdown.summary}
              </p>
            )}

            {record.evidenceBreakdown.scoreFormula && (
              <p
                className="text-[9px] font-mono text-muted-foreground/75 truncate mt-1"
                title={record.evidenceBreakdown.scoreFormula}
              >
                Formula: {record.evidenceBreakdown.scoreFormula}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Evidence reliability score calculated from verified citations and source backing.
          </p>
        )}
      </div>

      {/* Constraint Evaluation Breakdown */}
      {qualDetails && qualDetails.constraints && qualDetails.constraints.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2">
            <Info className="size-3.5 text-muted-foreground" />
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
              Constraint evaluation
            </p>
          </div>
          <div className="mt-2 space-y-1.5">
            {qualDetails.constraints.map((c, idx) => (
              <div
                key={`${c.field}-${idx}`}
                className="flex items-start justify-between gap-2 rounded-md border border-border bg-card p-2.5"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                    {c.field.replace(/_/g, " ")}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                    <span>
                      <span className="text-muted-foreground">Required: </span>
                      <span className="font-medium">{c.expected}</span>
                    </span>
                    <span>
                      <span className="text-muted-foreground">Actual: </span>
                      <span className="font-medium">{c.actual ?? "—"}</span>
                    </span>
                    {c.normalizedValue !== null && c.normalizedValue !== undefined && (
                      <span>
                        <span className="text-muted-foreground">Normalized: </span>
                        <span className="font-medium">{c.normalizedValue}</span>
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">{c.reason}</p>
                </div>
                <ConstraintResultBadge result={c.result} />
              </div>
            ))}
          </div>
          {qualDetails.completenessScore !== undefined && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Data completeness:{" "}
              <span className="font-semibold">{qualDetails.completenessScore}%</span>
              {qualDetails.missingFields && qualDetails.missingFields.length > 0 && (
                <span> · Missing: {qualDetails.missingFields.join(", ")}</span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Dynamic Field Attributes Grid */}
      <dl className="mt-4 grid grid-cols-2 gap-px border border-border bg-border">
        {gridFields.map(([k, v]) => (
          <div key={k} className="bg-card p-3">
            <div className="flex items-center justify-between">
              <dt className="text-[10px] uppercase text-muted-foreground truncate">{k}</dt>
              <div className="flex items-center gap-1.5">
                <DirectnessIndicator level={record.evidenceBreakdown?.directnessMap?.[k]} />
                <FieldStatusIndicator value={v} />
              </div>
            </div>
            <dd className="mt-1 text-xs font-medium break-words">
              {v || <span className="italic text-muted-foreground">Not found</span>}
            </dd>
          </div>
        ))}
      </dl>
      {record.conflict && (
        <div className="mt-5 border border-destructive/30 bg-danger-muted p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-destructive">
            <AlertTriangle className="size-4" />
            Conflict detected · {record.conflict.field}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Sources disagree. No value has been chosen — review the evidence below.
          </p>
          <div className="mt-3 space-y-2">
            {record.conflict.values.map((c, i) => (
              <div key={c.source} className="border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Source {String.fromCharCode(65 + i)} · {c.source}
                  </span>
                  <strong className="text-xs">{c.value}</strong>
                </div>
                <p className="mt-2 border-l-2 border-border pl-2 text-[11px] italic leading-5 text-muted-foreground">
                  {c.snippet}
                </p>
                {c.url && c.url !== "—" ? (
                  <a
                    href={c.url.startsWith("http") ? c.url : `https://${c.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-1 truncate text-[10px] text-primary hover:underline"
                  >
                    <ExternalLink className="size-3 shrink-0" />
                    {c.url} · {c.retrieved}
                  </a>
                ) : (
                  <p className="mt-2 flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                    {c.url} · {c.retrieved}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="mt-6 text-xs font-semibold">Evidence</p>
      <p className="text-[11px] text-muted-foreground">
        Each value is linked to the source text it was extracted from.
      </p>
      <div className="mt-3 space-y-3">
        {record.evidence.map((e, idx) => (
          <div key={`${e.field}-${e.url}-${idx}`} className="border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">{e.field}</p>
                <p className="mt-0.5 text-xs font-semibold">{e.value}</p>
              </div>
              <StatusBadge status={e.verification} />
            </div>
            <p className="mt-2 border-l-2 border-primary/40 pl-2 text-[11px] italic leading-5 text-muted-foreground">
              {e.snippet}
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[10px] text-muted-foreground">
              <span className="font-medium text-foreground">{e.source}</span>
              <span>Retrieved {e.retrieved}</span>
            </div>
            {e.url !== "—" && (
              <a
                href={e.url.startsWith("http") ? e.url : `https://${e.url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 flex items-center gap-1 truncate text-[10px] text-primary hover:underline"
              >
                <ExternalLink className="size-3 shrink-0" />
                {e.url}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
