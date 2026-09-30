import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Database, ExternalLink, FileText, Globe, Loader2, Quote, AlertTriangle } from "lucide-react";
import { PageIntro, StatusBadge } from "@/components/dashboard-ui";
import { RecordDetail } from "@/components/record-detail";
import { datasetRows, sources as mockSources } from "@/lib/mock-data";
import type { DatasetRecord as MockDatasetRecord } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { usePipelineResult } from "@/lib/pipeline-store";
import { getActiveRunFn, getRunByIdFn } from "@/lib/storage-fns";
import type { PersistedRun } from "@/lib/storage-schema";

export type EvidenceSearch = {
  runId?: string | undefined;
};

export const Route = createFileRoute("/evidence")({
  validateSearch: (search: Record<string, unknown>): EvidenceSearch => ({
    runId: typeof search["runId"] === "string" ? (search["runId"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sources & Evidence — DataIntel" },
      {
        name: "description",
        content: "Trace every extracted value from source to evidence to dataset record.",
      },
      { property: "og:title", content: "Sources & Evidence — DataIntel" },
      {
        property: "og:description",
        content: "Trace every extracted value from source to evidence to dataset record.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EvidencePage,
});

function EvidencePage() {
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
        .catch((err) => console.error("Failed to load active run in evidence:", err))
        .finally(() => {
          if (mounted) setLoading(false);
        });
    }

    return () => {
      mounted = false;
    };
  }, [explicitRunId]);

  const activeRecords = useMemo(() => {
    if (explicitRunId) {
      return persistedRun ? (persistedRun.records ?? []) : [];
    }
    if (persistedRun) {
      return persistedRun.records ?? [];
    }
    if (pipelineResult) {
      return pipelineResult.records ?? [];
    }
    return datasetRows;
  }, [explicitRunId, persistedRun, pipelineResult]);

  const activeSources = useMemo(() => {
    if (explicitRunId) {
      return persistedRun ? (persistedRun.sources ?? []) : [];
    }
    if (persistedRun) {
      return persistedRun.sources ?? [];
    }
    if (pipelineResult) {
      return pipelineResult.sources ?? [];
    }
    return mockSources;
  }, [explicitRunId, persistedRun, pipelineResult]);

  const items = useMemo(
    () =>
      activeRecords.flatMap((r) =>
        r.evidence.map((e, idx) => ({
          ...e,
          id: `${r.id}-${e.field}-${idx}`,
          runId: persistedRun?.id || explicitRunId || "active-run",
          recordId: r.id,
          company: ("entityName" in r && r.entityName ? r.entityName : (r as any).company) || r.id,
        })),
      ),
    [activeRecords, persistedRun, explicitRunId],
  );

  const planId = persistedRun?.requestId || (explicitRunId ? explicitRunId : pipelineResult?.planId || "Selected collection");
  const runVersion = persistedRun ? `v${persistedRun.runNumber}` : "";
  const pageEyebrow = persistedRun?.id ? `Run · ${persistedRun.id}` : `Provenance · ${planId}`;

  const [src, setSrc] = useState<string>("All");
  const list = useMemo(
    () => items.filter((i) => src === "All" || i.source.toLowerCase().startsWith(src.split(" ")[0]?.toLowerCase() ?? "")),
    [src, items],
  );
  const [key, setKey] = useState("");
  const firstKey = items[0]?.id || "";
  const activeKey = key || firstKey;
  const item = items.find((i) => i.id === activeKey) ?? items[0];
  const record = item ? activeRecords.find((r) => r.id === item.recordId) : undefined;

  const coveragePercent =
    items.length > 0
      ? Math.round((items.filter((i) => i.verification !== "Needs verification").length / items.length) * 100)
      : 0;

  const openConflictsCount =
    persistedRun?.quality.conflicts ?? (pipelineResult ? pipelineResult.quality.conflicts : 0);

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Loading evidence for run {explicitRunId || "active"}…</p>
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
            The requested run <span className="font-mono text-foreground font-semibold">{explicitRunId}</span> does not exist in local storage.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              to="/history"
              className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Browse Workflow History
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
        title="Sources &amp; evidence"
        description="Follow any value back to the exact source text it was extracted from: Source → Evidence → Extracted value → Dataset record."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {[
          [
            `${coveragePercent}%`,
            "Evidence coverage",
            "Values linked to a snippet",
          ],
          [String(items.length), "Field-level citations", "In this dataset"],
          [String(openConflictsCount), "Open conflicts", "Awaiting review"],
          [String(activeSources.length), "Sources used", "Verified web sources"],
        ].map(([v, l, d]) => (
          <div key={l} className="border border-border bg-card p-5">
            <p className="text-2xl font-semibold">{v}</p>
            <p className="mt-1 text-xs font-medium">{l}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setSrc("All")}
          className={cn(
            "rounded-md border border-border px-3 py-1.5 text-xs transition",
            src === "All"
              ? "border-primary bg-primary-muted text-primary font-semibold"
              : "bg-card text-muted-foreground hover:bg-muted/40",
          )}
        >
          All sources
        </button>
        {activeSources.map((s) => (
          <button
            key={s.name}
            onClick={() => setSrc(s.name)}
            className={cn(
              "rounded-md border border-border px-3 py-1.5 text-xs transition",
              src === s.name
                ? "border-primary bg-primary-muted text-primary font-semibold"
                : "bg-card text-muted-foreground hover:bg-muted/40",
            )}
          >
            {s.name} <span className="ml-1 font-semibold">{s.reliability}%</span>
          </button>
        ))}
      </div>
      <div className="grid border border-border bg-card lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="min-w-0 lg:border-r border-border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-[10px] uppercase text-muted-foreground">
                  {["Source", "Field", "Extracted value", "Record", "Verification"].map((h) => (
                    <th key={h} className="px-4 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((i) => {
                  const k = i.id;
                  return (
                    <tr
                      key={k}
                      onClick={() => setKey(k)}
                      className={cn(
                        "cursor-pointer border-b border-border last:border-0 hover:bg-muted/30",
                        activeKey === k && "bg-primary-muted",
                      )}
                    >
                      <td className="px-4 py-3 text-xs font-medium">{i.source}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{i.field}</td>
                      <td className="px-4 py-3 text-xs">{i.value}</td>
                      <td className="px-4 py-3 text-xs">
                        <strong className="font-medium">{i.company}</strong>{" "}
                        <span className="text-muted-foreground">{i.recordId}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={i.verification} />
                      </td>
                    </tr>
                  );
                })}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-xs text-muted-foreground">
                      No evidence citations found for this source filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="border-t border-border lg:border-t-0">
          {item && record ? (
            <>
              <div className="border-b border-border p-5">
                <p className="text-[10px] font-semibold uppercase text-primary">Traceability chain</p>
                <ol className="mt-4 space-y-2">
                  {[
                    [Globe, "Source", `${item.source}`, item.url],
                    [Quote, "Evidence", item.snippet, `Retrieved ${item.retrieved}`],
                    [FileText, "Extracted value", `${item.field}: ${item.value}`, item.verification],
                    [Database, "Dataset record", `${item.company} · ${record.role}`, item.recordId],
                  ].map(([Icon, label, main, sub], idx) => {
                    const C = Icon as typeof Globe;
                    return (
                      <li key={String(label)}>
                        <div className="flex gap-3 border border-border p-3">
                          <C className="mt-0.5 size-4 shrink-0 text-primary" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] uppercase text-muted-foreground">
                              {String(label)}
                            </p>
                            <p
                              className={cn(
                                "mt-0.5 break-words text-xs font-medium",
                                label === "Evidence" && "italic font-normal",
                              )}
                            >
                              {String(main)}
                            </p>
                            {label === "Source" && item.url && item.url !== "—" ? (
                              <a
                                href={item.url.startsWith("http") ? item.url : `https://${item.url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-0.5 inline-flex items-center gap-1 truncate text-[10px] text-primary hover:underline"
                              >
                                {String(sub)} <ExternalLink className="size-2.5 shrink-0" />
                              </a>
                            ) : (
                              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                                {String(sub)}
                              </p>
                            )}
                          </div>
                        </div>
                        {idx < 3 && (
                          <ArrowRight className="mx-auto my-1 size-3 rotate-90 text-muted-foreground" />
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
              <RecordDetail record={record as MockDatasetRecord} />
            </>
          ) : (
            <div className="p-5 text-xs text-muted-foreground">Select an evidence item to trace it.</div>
          )}
        </aside>
      </div>
    </div>
  );
}
