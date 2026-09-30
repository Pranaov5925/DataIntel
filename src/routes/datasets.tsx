import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  Download,
  FileCode,
  FileSpreadsheet,
  Filter,
  HelpCircle,
  Loader2,
  Search,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Confidence, PageIntro } from "@/components/dashboard-ui";
import { RecordDetail } from "@/components/record-detail";
import { datasetRows, type DatasetRecord as MockDatasetRecord } from "@/lib/mock-data";
import { usePipelineResult } from "@/lib/pipeline-store";
import type { DatasetRecord as PipelineDatasetRecord } from "@/lib/pipeline-schema";
import { getActiveRunFn, getRunByIdFn } from "@/lib/storage-fns";
import type { PersistedRun } from "@/lib/storage-schema";

export type DatasetSearch = {
  runId?: string | undefined;
};

export const Route = createFileRoute("/datasets")({
  validateSearch: (search: Record<string, unknown>): DatasetSearch => ({
    runId: typeof search["runId"] === "string" ? (search["runId"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Dataset Explorer — DataIntel" },
      {
        name: "description",
        content:
          "Explore evidence-backed entity records with qualification status, dynamic attributes, and provenance.",
      },
      { property: "og:title", content: "Dataset Explorer — DataIntel" },
      {
        property: "og:description",
        content:
          "Explore evidence-backed entity records with qualification status, dynamic attributes, and provenance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DatasetsPage,
});

const statuses = ["All", "Qualified", "Needs verification", "Excluded", "Conflict"] as const;

type AnyRecord = any;

function escapeCsv(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function QualificationBadge({ status }: { status?: string }) {
  const norm = status || "Needs verification";
  if (norm === "Qualified" || norm === "Verified") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success-muted px-2 py-0.5 text-[10px] font-semibold text-success">
        <CheckCircle2 className="size-3" />
        Qualified
      </span>
    );
  }
  if (norm === "Excluded") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-danger-muted px-2 py-0.5 text-[10px] font-semibold text-destructive">
        <XCircle className="size-3" />
        Excluded
      </span>
    );
  }
  if (norm === "Conflict") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-danger-muted px-2 py-0.5 text-[10px] font-semibold text-destructive">
        <AlertTriangle className="size-3" />
        Conflict
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning-muted px-2 py-0.5 text-[10px] font-semibold text-warning">
      <HelpCircle className="size-3" />
      Needs verification
    </span>
  );
}

function getRecordCellValue(record: AnyRecord, key: string, label: string): string {
  // Check record attributes first
  if (record.attributes) {
    if (record.attributes[label]) return record.attributes[label]!;
    const norm = label.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const [k, v] of Object.entries(record.attributes)) {
      if (k.toLowerCase().replace(/[^a-z0-9]/g, "") === norm && v !== undefined && v !== null) return String(v);
    }
  }

  // Check canonical record properties
  const rec = record as unknown as Record<string, unknown>;
  if (rec[key] !== undefined && rec[key] !== null) return String(rec[key]);

  const normLabel = label.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normLabel.includes("company") || normLabel.includes("brand"))
    return (record as any).company || (record as any).entityName || "—";
  if (normLabel.includes("role") || normLabel.includes("model") || normLabel.includes("property"))
    return (record as any).role || "—";
  if (normLabel.includes("location") || normLabel.includes("city"))
    return (record as any).location || "—";
  if (normLabel.includes("salary") || normLabel.includes("price") || normLabel.includes("cost"))
    return (record as any).salary || "—";
  if (normLabel.includes("experience") || normLabel.includes("range"))
    return (record as any).experience || "—";
  if (normLabel.includes("size") || normLabel.includes("battery") || normLabel.includes("area"))
    return (record as any).size || "—";

  return "—";
}

function DatasetsPage() {
  const search = Route.useSearch();
  const explicitRunId = search?.runId;
  const pipelineResult = usePipelineResult();
  const [persistedRun, setPersistedRun] = useState<PersistedRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setNotFound(false);

    if (explicitRunId) {
      getRunByIdFn({ data: { runId: explicitRunId } })
        .then((run) => {
          if (mounted) {
            if (run) {
              setPersistedRun(run);
            } else {
              setNotFound(true);
            }
          }
        })
        .catch((err) => {
          console.error("Failed to load run by id:", err);
          if (mounted) setNotFound(true);
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    } else {
      getActiveRunFn()
        .then((run) => {
          if (mounted && run) setPersistedRun(run);
        })
        .catch((err) => console.error("Failed to load active run:", err))
        .finally(() => {
          if (mounted) setLoading(false);
        });
    }

    return () => {
      mounted = false;
    };
  }, [explicitRunId]);

  // Determine active dataset: strictly priority driven
  const rows_source: AnyRecord[] = useMemo(() => {
    if (explicitRunId) {
      return (persistedRun?.records as AnyRecord[]) ?? [];
    }
    if (persistedRun) {
      return (persistedRun.records as AnyRecord[]) ?? [];
    }
    if (pipelineResult) {
      return pipelineResult.records ?? [];
    }
    return datasetRows;
  }, [explicitRunId, persistedRun, pipelineResult]);

  // Compute dynamic columns based on run's required fields (Requirement #13)
  const dynamicCols = useMemo(() => {
    const fields = persistedRun?.understanding?.requiredFields || [];
    if (fields.length > 0) {
      const list = fields.map((f) => ({
        key: f.toLowerCase().replace(/[^a-z0-9]/g, "_"),
        label: f,
        isAttribute: true,
      }));
      if (!list.some((c) => c.key === "source")) {
        list.push({ key: "source", label: "Source", isAttribute: false });
      }
      if (!list.some((c) => c.key === "confidence")) {
        list.push({ key: "confidence", label: "Confidence", isAttribute: false });
      }
      if (!list.some((c) => c.key === "qualificationstatus" || c.key === "qualification_status" || c.key === "qualification")) {
        list.push({ key: "qualificationStatus", label: "Qualification", isAttribute: false });
      }
      return list;
    }

    // Default canonical columns for legacy demo
    return [
      { key: "company", label: "Company", isAttribute: false },
      { key: "role", label: "Job Role", isAttribute: false },
      { key: "location", label: "Location", isAttribute: false },
      { key: "experience", label: "Experience", isAttribute: false },
      { key: "salary", label: "Salary", isAttribute: false },
      { key: "size", label: "Company Size", isAttribute: false },
      { key: "source", label: "Source", isAttribute: false },
      { key: "confidence", label: "Confidence", isAttribute: false },
      { key: "qualificationStatus", label: "Qualification", isAttribute: false },
    ];
  }, [persistedRun]);

  // Compute live quality & qualification metrics
  const q = useMemo(() => {
    const qualified = rows_source.filter(
      (r) => r.qualificationStatus === "Qualified" || (!r.qualificationStatus && r.status === "Verified"),
    ).length;
    const needsVerification = rows_source.filter(
      (r) =>
        r.qualificationStatus === "Needs verification" ||
        (!r.qualificationStatus && r.status === "Review"),
    ).length;
    const excluded = rows_source.filter(
      (r) =>
        r.qualificationStatus === "Excluded" ||
        (!r.qualificationStatus && r.status === "Incomplete"),
    ).length;
    const conflicts = rows_source.filter(
      (r) =>
        r.qualificationStatus === "Conflict" ||
        r.conflict != null ||
        r.status === "Conflict",
    ).length;

    const baseCollected =
      persistedRun?.quality.collected ?? pipelineResult?.quality.collected ?? rows_source.length;
    const baseDuplicates =
      persistedRun?.quality.duplicates ?? pipelineResult?.quality.duplicates ?? 0;

    return {
      collected: baseCollected,
      unique: rows_source.length,
      validated: qualified,
      duplicates: baseDuplicates,
      incomplete: needsVerification,
      conflicts,
      qualified,
      excluded,
      needsVerification,
    };
  }, [rows_source, persistedRun, pipelineResult]);

  const activePlanId = persistedRun?.requestId || (explicitRunId ? explicitRunId : pipelineResult?.planId || "Selected collection");
  const pageTitle = persistedRun?.requestName || (explicitRunId ? explicitRunId : pipelineResult?.title || "Dataset Records");
  const pageEyebrow = persistedRun?.id ? `Run · ${persistedRun.id}` : `Dataset · ${activePlanId}`;
  const pageDescription =
    "Records are deterministically qualified against your hard constraints with verified primary evidence.";

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof statuses)[number]>("All");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({
    key: "confidence",
    dir: -1,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Reset page when filter or search changes
  useEffect(() => {
    setPage(1);
  }, [query, status]);

function parseCellNumeric(text: string): number | null {
  if (!text || text === "—" || text.toLowerCase().includes("not disclosed")) return null;
  const clean = text.trim();

  // Lakhs detection: e.g. "₹50 lakh", "₹ 1.5 Lakh", "50L", "1.5 Lakhs"
  const lakhMatch = clean.match(/(?:₹|INR|Rs\.?)?\s*(\d+(?:\.\d+)?)\s*(?:lakhs?|l)\b/i);
  if (lakhMatch) return parseFloat(lakhMatch[1]!) * 100000;

  // Crores detection: e.g. "₹5 Cr", "5 Crore"
  const crMatch = clean.match(/(?:₹|INR|Rs\.?)?\s*(\d+(?:\.\d+)?)\s*(?:crores?|cr)\b/i);
  if (crMatch) return parseFloat(crMatch[1]!) * 10000000;

  // Numbers or Indian commas, or ranges: e.g. "50-500", "120 km", "₹1,50,000"
  const numMatch = clean.match(/(\d{1,3}(?:,\d{2,3})*(?:\.\d+)?|\d+(?:\.\d+)?)/);
  if (numMatch) {
    const parsed = parseFloat(numMatch[1]!.replace(/,/g, ""));
    if (!isNaN(parsed)) return parsed;
  }

  return null;
}

  const filteredRows = useMemo(
    () =>
      rows_source
        .filter((r) => {
          const qual = r.qualificationStatus || (r.status === "Verified" ? "Qualified" : r.status === "Conflict" ? "Conflict" : r.status === "Incomplete" ? "Excluded" : "Needs verification");
          const statusMatch = status === "All" || qual === status;

          const searchTarget = [
            r.entityName,
            r.company,
            r.role,
            r.location,
            r.source,
            ...(r.attributes ? Object.values(r.attributes).filter(Boolean) : []),
          ]
            .join(" ")
            .toLowerCase();

          return statusMatch && searchTarget.includes(query.toLowerCase());
        })
        .sort((a, b) => {
          const sortCol = dynamicCols.find((c) => c.key === sort.key);
          const colLabel = sortCol?.label || sort.key;

          let aRaw = "";
          let bRaw = "";

          if (sort.key === "confidence") {
            return (a.confidence - b.confidence) * sort.dir;
          } else if (sort.key === "qualificationStatus") {
            aRaw = a.qualificationStatus || a.status;
            bRaw = b.qualificationStatus || b.status;
          } else {
            aRaw = getRecordCellValue(a, sort.key, colLabel);
            bRaw = getRecordCellValue(b, sort.key, colLabel);
          }

          const aEmpty = !aRaw || aRaw === "—" || aRaw === "Not disclosed";
          const bEmpty = !bRaw || bRaw === "—" || bRaw === "Not disclosed";

          if (aEmpty && bEmpty) return 0;
          if (aEmpty) return 1;
          if (bEmpty) return -1;

          const aNum = parseCellNumeric(aRaw);
          const bNum = parseCellNumeric(bRaw);

          if (aNum !== null && bNum !== null) {
            return (aNum - bNum) * sort.dir;
          }

          return aRaw.localeCompare(bRaw, undefined, { numeric: true, sensitivity: "base" }) * sort.dir;
        }),
    [query, status, sort, rows_source, dynamicCols],
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(
    () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
    [filteredRows, page],
  );

  const record = rows_source.find((r) => r.id === selected);

  // ─── Dynamic Export handlers ────────────────────────────────────────────────
  function handleExportCSV() {
    const headers = dynamicCols.map((c) => c.label);
    const csvRows = filteredRows.map((r) =>
      dynamicCols.map((c) => {
        if (c.key === "confidence") return escapeCsv(`${r.confidence}%`);
        if (c.key === "qualificationStatus") return escapeCsv(r.qualificationStatus || r.status);
        return escapeCsv(getRecordCellValue(r, c.key, c.label));
      }),
    );

    const csvContent = [headers.join(","), ...csvRows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dataintel_${activePlanId}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportJSON() {
    const exportPayload = {
      metadata: {
        requestId: activePlanId,
        runId: persistedRun?.id,
        runNumber: persistedRun?.runNumber,
        title: pageTitle,
        originalPrompt: persistedRun?.originalPrompt,
        requestedFields: persistedRun?.understanding?.requiredFields || [],
        constraints: persistedRun?.understanding?.constraints || [],
        structuredConstraints: persistedRun?.understanding?.structuredConstraints || [],
        exportedAt: new Date().toISOString(),
        totalRecords: filteredRows.length,
        qualitySummary: q,
      },
      records: filteredRows.map((r) => ({
        id: r.id,
        entityName: r.entityName || r.company,
        attributes: r.attributes || {},
        source: r.source,
        confidence: r.confidence,
        verificationStatus: r.verificationStatus,
        qualificationStatus: r.qualificationStatus,
        qualificationReason: r.qualificationReason,
        evidence: r.evidence,
        conflict: r.conflict,
        conflicts: r.conflicts,
      })),
    };

    const jsonContent = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dataintel_${activePlanId}_snapshot_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Loading dataset for run {explicitRunId || "active"}…</p>
      </div>
    );
  }

  if (notFound && explicitRunId) {
    return (
      <div className="p-8">
        <div className="mx-auto max-w-lg border border-destructive/30 bg-card p-6 text-center">
          <AlertTriangle className="mx-auto size-8 text-destructive" />
          <h2 className="mt-3 text-lg font-semibold">Workflow Run Not Found</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            The requested run <span className="font-mono text-foreground font-semibold">{explicitRunId}</span> could not be loaded from local storage.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              to="/history"
              className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Back to Workflow History
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageIntro
        eyebrow={pageEyebrow}
        title={pageTitle}
        description={pageDescription}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="size-4" />
                Export
                <ChevronDown className="size-3 ml-1 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV}>
                <FileSpreadsheet className="size-4 mr-2 text-primary" />
                Export as CSV (.csv)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportJSON}>
                <FileCode className="size-4 mr-2 text-primary" />
                Export as JSON Snapshot (.json)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {/* Quality & Qualification summary bar */}
      <section className="mb-4 grid gap-px border border-border bg-border sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="flex items-center gap-2 bg-card px-5 py-4 text-sm">
          <span>
            <strong className="text-lg">{q.collected}</strong>{" "}
            <span className="text-xs text-muted-foreground">collected</span>
          </span>
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <span>
            <strong className="text-lg">{q.unique}</strong>{" "}
            <span className="text-xs text-muted-foreground">unique</span>
          </span>
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <span>
            <strong className="text-lg text-success">{q.validated}</strong>{" "}
            <span className="text-xs text-muted-foreground font-semibold text-success">qualified</span>
          </span>
        </div>
        {[
          ["Duplicates removed", q.duplicates, ""],
          ["Needs verification", q.needsVerification ?? q.incomplete, "text-warning"],
          ["Excluded / Conflicts", (q.excluded ?? 0) + q.conflicts, "text-destructive"],
        ].map(([l, v, c]) => (
          <div key={l} className="bg-card px-5 py-4">
            <p className={`text-lg font-semibold ${c}`}>{v}</p>
            <p className="text-[11px] text-muted-foreground">{l}</p>
          </div>
        ))}
      </section>

      {/* Filter and Search controls */}
      <div className="mb-4 flex flex-col justify-between gap-3 border-y border-border py-3 lg:flex-row lg:items-center">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search records by entity, attributes, or source…"
            className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-ring"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="size-3.5 text-muted-foreground" />
          {statuses.map((s) => (
            <Button
              key={s}
              variant={status === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatus(s)}
            >
              {s}
              {s === "Qualified" && (
                <span className="ml-1.5 rounded-full bg-success/20 px-1.5 py-0.2 text-[10px] font-bold text-success">
                  {q.validated}
                </span>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Main Data Table */}
      <div
        className="grid border border-border bg-card lg:grid-cols-[minmax(0,1fr)_0px] data-[open=true]:lg:grid-cols-[minmax(0,1fr)_420px]"
        data-open={Boolean(record)}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-[10px] uppercase text-muted-foreground">
                {dynamicCols.map((col) => (
                  <th key={col.key} className="px-4 py-3 font-semibold">
                    <button
                      className="inline-flex items-center gap-1 uppercase"
                      onClick={() =>
                        setSort((s) => ({
                          key: col.key,
                          dir: s.key === col.key ? (s.dir === 1 ? -1 : 1) : 1,
                        }))
                      }
                    >
                      {col.label}
                      {sort.key === col.key ? (
                        sort.dir === 1 ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )
                      ) : (
                        <ChevronDown className="size-3 opacity-30" />
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelected(row.id)}
                  className={`cursor-pointer border-b border-border last:border-0 hover:bg-muted/30 ${selected === row.id ? "bg-primary-muted" : ""}`}
                >
                  {dynamicCols.map((col, idx) => {
                    if (col.key === "confidence") {
                      return (
                        <td key={col.key} className="px-4 py-3.5">
                          <Confidence value={row.confidence} />
                        </td>
                      );
                    }
                    if (col.key === "qualificationStatus") {
                      return (
                        <td key={col.key} className="px-4 py-3.5">
                          <QualificationBadge status={row.qualificationStatus || row.status} />
                        </td>
                      );
                    }
                    if (col.key === "source") {
                      return (
                        <td key={col.key} className="px-4 py-3.5 text-xs text-muted-foreground">
                          {row.source}
                        </td>
                      );
                    }

                    const val = getRecordCellValue(row, col.key, col.label);

                    // First column gets prominent entity styling
                    if (idx === 0) {
                      return (
                        <td key={col.key} className="px-4 py-3.5">
                          <strong className="text-sm font-medium">{val}</strong>
                          <p className="text-[10px] text-muted-foreground">Record · {row.id}</p>
                        </td>
                      );
                    }

                    const isConflict =
                      row.conflict &&
                      row.conflict.field.toLowerCase().includes(col.label.toLowerCase());

                    return (
                      <td
                        key={col.key}
                        className={`px-4 py-3.5 text-xs tabular-nums ${isConflict ? "font-semibold text-destructive" : ""}`}
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {paginatedRows.length === 0 && (
                <tr>
                  <td
                    colSpan={dynamicCols.length}
                    className="px-4 py-10 text-center text-xs text-muted-foreground"
                  >
                    No records match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {record && (
          <aside className="max-h-[80vh] overflow-y-auto border-l border-border">
            <RecordDetail
              record={record}
              onClose={() => setSelected(null)}
              requestedFields={persistedRun?.understanding?.requiredFields}
            />
          </aside>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between border-x border-b border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        <span>
          Showing {filteredRows.length > 0 ? (page - 1) * pageSize + 1 : 0}–
          {Math.min(page * pageSize, filteredRows.length)} of {filteredRows.length} filtered (
          {q.unique} total) records
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
