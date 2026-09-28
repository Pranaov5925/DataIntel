import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Database, ExternalLink, FileText, Globe, Quote } from "lucide-react";
import { PageIntro, StatusBadge } from "@/components/dashboard-ui";
import { RecordDetail } from "@/components/record-detail";
import { datasetRows, sources as mockSources } from "@/lib/mock-data";
import type { DatasetRecord as MockDatasetRecord } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { usePipelineResult } from "@/lib/pipeline-store";
import { getActiveRunFn } from "@/lib/storage-fns";
import type { PersistedRun } from "@/lib/storage-schema";

export const Route = createFileRoute("/evidence")({
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
  const pipelineResult = usePipelineResult();
  const [persistedRun, setPersistedRun] = useState<PersistedRun | null>(null);

  useEffect(() => {
    let mounted = true;
    getActiveRunFn()
      .then((run) => {
        if (mounted && run) setPersistedRun(run);
      })
      .catch((err) => console.error("Failed to load active run in evidence:", err));
    return () => {
      mounted = false;
    };
  }, []);

  const activeRecords = useMemo(() => {
    if (pipelineResult?.records && pipelineResult.records.length > 0) {
      return pipelineResult.records;
    }
    if (persistedRun?.records && persistedRun.records.length > 0) {
      return persistedRun.records;
    }
    return datasetRows;
  }, [pipelineResult, persistedRun]);

  const activeSources = useMemo(() => {
    if (pipelineResult?.sources && pipelineResult.sources.length > 0) {
      return pipelineResult.sources;
    }
    if (persistedRun?.sources && persistedRun.sources.length > 0) {
      return persistedRun.sources;
    }
    return mockSources;
  }, [pipelineResult, persistedRun]);

  const items = useMemo(
    () =>
      activeRecords.flatMap((r) =>
        r.evidence.map((e) => ({ ...e, recordId: r.id, company: r.company })),
      ),
    [activeRecords],
  );

  const planId = persistedRun?.requestId || pipelineResult?.planId || "DR-1048";
  const runVersion = persistedRun ? `v${persistedRun.runNumber}` : "v2";
  const pageEyebrow = `Provenance · ${planId} (${runVersion})`;

  const [src, setSrc] = useState<string>("All");
  const list = useMemo(
    () => items.filter((i) => src === "All" || i.source.toLowerCase().startsWith(src.split(" ")[0]?.toLowerCase() ?? "")),
    [src, items],
  );
  const [key, setKey] = useState("");
  const firstKey = items[0] ? `${items[0].recordId}-${items[0].field}` : "";
  const activeKey = key || firstKey;
  const item = items.find((i) => `${i.recordId}-${i.field}` === activeKey) ?? items[0];
  const record = item ? activeRecords.find((r) => r.id === item.recordId) : undefined;

  const coveragePercent =
    items.length > 0
      ? Math.round((items.filter((i) => i.verification !== "Needs verification").length / items.length) * 100)
      : 78;

  const openConflictsCount =
    persistedRun?.quality.conflicts ?? (pipelineResult ? pipelineResult.quality.conflicts : 2);

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
          [String(activeSources.length), "Sources used", "Careers pages & job boards"],
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
                  const k = `${i.recordId}-${i.field}`;
                  return (
                    <tr
                      key={k}
                      onClick={() => setKey(k)}
                      className={cn(
                        "cursor-pointer border-b border-border last:border-0 hover:bg-muted/30",
                        key === k && "bg-primary-muted",
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
