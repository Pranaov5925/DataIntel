import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Download,
  FileCode,
  FileSpreadsheet,
  Filter,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Confidence, PageIntro, StatusBadge } from "@/components/dashboard-ui";
import { RecordDetail } from "@/components/record-detail";
import { datasetRows, qualitySummary as mockQ, type DatasetRecord as MockDatasetRecord } from "@/lib/mock-data";
import { usePipelineResult } from "@/lib/pipeline-store";
import type { DatasetRecord as PipelineDatasetRecord } from "@/lib/pipeline-schema";
import { getActiveRunFn } from "@/lib/storage-fns";
import type { PersistedRun } from "@/lib/storage-schema";

export const Route = createFileRoute("/datasets")({
  head: () => ({
    meta: [
      { title: "Dataset Explorer — DataIntel" },
      {
        name: "description",
        content:
          "Explore evidence-backed Java backend job records with confidence and verification status.",
      },
      { property: "og:title", content: "Dataset Explorer — DataIntel" },
      {
        property: "og:description",
        content:
          "Explore evidence-backed Java backend job records with confidence and verification status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DatasetsPage,
});

const statuses = ["All", "Verified", "Review", "Conflict", "Incomplete"] as const;
const cols: [string, string][] = [
  ["company", "Company"],
  ["role", "Job Role"],
  ["location", "Location"],
  ["experience", "Experience"],
  ["salary", "Salary"],
  ["size", "Company Size"],
  ["source", "Source"],
  ["confidence", "Confidence"],
  ["status", "Status"],
];

type AnyRecord = MockDatasetRecord | PipelineDatasetRecord;

function escapeCsv(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function DatasetsPage() {
  const pipelineResult = usePipelineResult();
  const [persistedRun, setPersistedRun] = useState<PersistedRun | null>(null);

  useEffect(() => {
    let mounted = true;
    getActiveRunFn()
      .then((run) => {
        if (mounted && run) {
          setPersistedRun(run);
        }
      })
      .catch((err) => console.error("Failed to load active run:", err));
    return () => {
      mounted = false;
    };
  }, []);

  // Determine active dataset: prefer live pipelineResult, then persisted run, then initial demo state
  const rows_source: AnyRecord[] = useMemo(() => {
    if (pipelineResult) {
      return pipelineResult.records ?? [];
    }
    if (persistedRun) {
      return (persistedRun.records as AnyRecord[]) ?? [];
    }
    return datasetRows;
  }, [pipelineResult, persistedRun]);

  // Compute live quality metrics dynamically from real dataset
  const q = useMemo(() => {
    const verified = rows_source.filter((r) => r.status === "Verified").length;
    const incomplete = rows_source.filter(
      (r) => r.status === "Incomplete" || r.salary === "Not disclosed",
    ).length;
    const conflicts = rows_source.filter((r) => r.conflict != null || r.status === "Conflict").length;

    const baseCollected =
      persistedRun?.quality.collected ?? pipelineResult?.quality.collected ?? rows_source.length;
    const baseDuplicates =
      persistedRun?.quality.duplicates ?? pipelineResult?.quality.duplicates ?? 0;

    return {
      collected: baseCollected,
      unique: rows_source.length,
      validated: verified,
      duplicates: baseDuplicates,
      incomplete,
      conflicts,
    };
  }, [rows_source, persistedRun, pipelineResult]);

  const activePlanId = persistedRun?.requestId || pipelineResult?.planId || "DR-1048";
  const runVersion = persistedRun ? `v${persistedRun.runNumber}` : "v2";
  const pageTitle = persistedRun?.requestName || pipelineResult?.title || "Indian SaaS companies hiring Java backend developers";
  const pageEyebrow = `Live dataset · ${activePlanId} (${runVersion})`;
  const pageDescription =
    "Every value remains traceable to source evidence. Conflicts are flagged, never silently resolved.";

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

  const filteredRows = useMemo(
    () =>
      rows_source
        .filter(
          (r) =>
            (status === "All" || r.status === status) &&
            `${r.company} ${r.role} ${r.location} ${r.source}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) => {
          const aVal = (a as Record<string, unknown>)[sort.key] ?? "";
          const bVal = (b as Record<string, unknown>)[sort.key] ?? "";
          return (aVal > bVal ? 1 : -1) * sort.dir;
        }),
    [query, status, sort, rows_source],
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(
    () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
    [filteredRows, page],
  );

  const record = rows_source.find((r) => r.id === selected);

  // ─── Export handlers ────────────────────────────────────────────────────────
  function handleExportCSV() {
    const headers = [
      "Company",
      "Role",
      "Location",
      "Experience",
      "Salary",
      "Company Size",
      "Source",
      "Confidence",
      "Status",
    ];
    const csvRows = filteredRows.map((r) => [
      escapeCsv(r.company),
      escapeCsv(r.role),
      escapeCsv(r.location),
      escapeCsv(r.experience),
      escapeCsv(r.salary),
      escapeCsv(r.size),
      escapeCsv(r.source),
      escapeCsv(`${r.confidence}%`),
      escapeCsv(r.status),
    ]);

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
        version: runVersion,
        title: pageTitle,
        exportedAt: new Date().toISOString(),
        totalRecords: filteredRows.length,
        qualitySummary: q,
      },
      records: filteredRows.map((r) => ({
        id: r.id,
        company: r.company,
        role: r.role,
        location: r.location,
        experience: r.experience,
        salary: r.salary,
        size: r.size,
        source: r.source,
        confidence: r.confidence,
        status: r.status,
        evidence: r.evidence.map((e) => ({
          field: e.field,
          value: e.value,
          source: e.source,
          url: e.url,
          retrieved: e.retrieved,
          snippet: e.snippet,
          verification: e.verification,
        })),
        conflict: r.conflict
          ? {
              field: r.conflict.field,
              values: r.conflict.values,
            }
          : undefined,
      })),
    };

    const jsonContent = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dataintel_${activePlanId}_with_evidence_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
                Export as JSON with Evidence (.json)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
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
            <span className="text-xs text-muted-foreground">validated</span>
          </span>
        </div>
        {[
          ["Duplicates removed", q.duplicates, ""],
          ["Incomplete records", q.incomplete, "text-warning"],
          ["Conflicts detected", q.conflicts, "text-destructive"],
        ].map(([l, v, c]) => (
          <div key={l} className="bg-card px-5 py-4">
            <p className={`text-lg font-semibold ${c}`}>{v}</p>
            <p className="text-[11px] text-muted-foreground">{l}</p>
          </div>
        ))}
      </section>

      <div className="mb-4 flex flex-col justify-between gap-3 border-y border-border py-3 lg:flex-row lg:items-center">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search company, role, location…"
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
            </Button>
          ))}
        </div>
      </div>

      <div
        className="grid border border-border bg-card lg:grid-cols-[minmax(0,1fr)_0px] data-[open=true]:lg:grid-cols-[minmax(0,1fr)_380px]"
        data-open={Boolean(record)}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-[10px] uppercase text-muted-foreground">
                {cols.map(([k, h]) => (
                  <th key={h} className="px-4 py-3 font-semibold">
                    <button
                      className="inline-flex items-center gap-1 uppercase"
                      onClick={() =>
                        setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : 1 }))
                      }
                    >
                      {h}
                      {sort.key === k ? (
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
                  <td className="px-4 py-3.5">
                    <strong className="text-sm font-medium">{row.company}</strong>
                    <p className="text-[10px] text-muted-foreground">SaaS · {row.id}</p>
                  </td>
                  <td className="px-4 py-3.5 text-xs">{row.role}</td>
                  <td className="px-4 py-3.5 text-xs">{row.location}</td>
                  <td className="px-4 py-3.5 text-xs tabular-nums">{row.experience}</td>
                  <td
                    className={`px-4 py-3.5 text-xs tabular-nums ${row.salary === "Not disclosed" ? "text-muted-foreground italic" : ""}`}
                  >
                    {row.salary}
                  </td>
                  <td
                    className={`px-4 py-3.5 text-xs tabular-nums ${row.conflict ? "font-semibold text-destructive" : ""}`}
                  >
                    {row.size}
                  </td>
                  <td className="px-4 py-3.5 text-xs">{row.source}</td>
                  <td className="px-4 py-3.5">
                    <Confidence value={row.confidence} />
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
              {paginatedRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-xs text-muted-foreground">
                    No records match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {record && (
          <aside className="max-h-[80vh] overflow-y-auto border-l border-border">
            <RecordDetail record={record as MockDatasetRecord} onClose={() => setSelected(null)} />
          </aside>
        )}
      </div>

      <div className="flex items-center justify-between border-x border-b border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        <span>
          Showing {filteredRows.length > 0 ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filteredRows.length)} of {filteredRows.length} filtered ({q.unique} total) records
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
