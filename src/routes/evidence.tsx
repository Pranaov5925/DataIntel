import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Database, FileText, Globe, Quote } from "lucide-react";
import { PageIntro, StatusBadge } from "@/components/dashboard-ui";
import { RecordDetail } from "@/components/record-detail";
import { datasetRows, sources } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

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

const items = datasetRows.flatMap((r) =>
  r.evidence.map((e) => ({ ...e, recordId: r.id, company: r.company })),
);

function EvidencePage() {
  const [src, setSrc] = useState<string>("All");
  const list = useMemo(
    () => items.filter((i) => src === "All" || i.source.startsWith(src.split(" ")[0] ?? "")),
    [src],
  );
  const [key, setKey] = useState("R-001-Role");
  const item = items.find((i) => `${i.recordId}-${i.field}` === key) ?? items[0]!;
  const record = datasetRows.find((r) => r.id === item.recordId)!;
  return (
    <div>
      <PageIntro
        eyebrow="Provenance · DR-1048"
        title="Sources & evidence"
        description="Follow any value back to the exact source text it was extracted from: Source → Evidence → Extracted value → Dataset record."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {[
          ["94%", "Evidence coverage", "Values linked to a snippet"],
          [String(items.length), "Field-level citations", "In the sample shown"],
          ["2", "Open conflicts", "Awaiting review"],
          ["9", "Sources used", "Careers pages & job boards"],
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
            "rounded-md border border-border px-3 py-1.5 text-xs",
            src === "All"
              ? "border-primary bg-primary-muted text-primary"
              : "bg-card text-muted-foreground",
          )}
        >
          All sources
        </button>
        {sources.map((s) => (
          <button
            key={s.name}
            onClick={() => setSrc(s.name)}
            className={cn(
              "rounded-md border border-border px-3 py-1.5 text-xs",
              src === s.name
                ? "border-primary bg-primary-muted text-primary"
                : "bg-card text-muted-foreground",
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
              </tbody>
            </table>
          </div>
        </section>
        <aside className="border-t border-border lg:border-t-0">
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
                      <div className="min-w-0">
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
                        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                          {String(sub)}
                        </p>
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
          <RecordDetail record={record} />
        </aside>
      </div>
    </div>
  );
}
