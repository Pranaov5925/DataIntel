import { AlertTriangle, CheckCircle2, ExternalLink, HelpCircle, X, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/dashboard-ui";
import type { DatasetRecord as MockDatasetRecord } from "@/lib/mock-data";
import type { DatasetRecord as PipelineDatasetRecord } from "@/lib/pipeline-schema";

type AnyRecord = (MockDatasetRecord | PipelineDatasetRecord) & {
  entityName?: string;
  attributes?: Record<string, string | null>;
  qualificationStatus?: any;
  qualificationReason?: string;
  conflicts?: any[];
  verificationStatus?: any;
};

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
  const gridFields: [string, string][] = [];
  if (record.attributes && Object.keys(record.attributes).length > 0) {
    for (const [k, v] of Object.entries(record.attributes)) {
      gridFields.push([k, v || "—"]);
    }
  } else {
    gridFields.push(
      ["Location", record.location || "—"],
      ["Experience", record.experience || "—"],
      ["Salary", record.salary || "—"],
      ["Company size", record.size || "—"],
    );
  }

  const qualStatus = record.qualificationStatus || (record.status === "Verified" ? "Qualified" : record.status === "Conflict" ? "Conflict" : record.status === "Incomplete" ? "Excluded" : "Needs verification");
  const qualReason = record.qualificationReason;

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

      {/* Qualification Status & Reason Callout (Section 14 & 26) */}
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

      {/* Dynamic Field Attributes Grid */}
      <dl className="mt-4 grid grid-cols-2 gap-px border border-border bg-border">
        {gridFields.map(([k, v]) => (
          <div key={k} className="bg-card p-3">
            <dt className="text-[10px] uppercase text-muted-foreground truncate">{k}</dt>
            <dd className="mt-1 text-xs font-medium break-words">{v}</dd>
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
