import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Database, Search, Waypoints, X } from "lucide-react";
import { getHistoryDataFn, type HistoryData } from "@/lib/storage-fns";
import type { PersistedRun } from "@/lib/storage-schema";

type SearchResultItem = {
  type: "workflow" | "record";
  title: string;
  subtitle: string;
  runId: string;
  to: "/workflow" | "/datasets";
};

export function TopSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<HistoryData | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Lazy load history data for search index
  useEffect(() => {
    getHistoryDataFn()
      .then((res) => setData(res))
      .catch((err) => console.error("Search data load error:", err));
  }, []);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter matching items
  const results: SearchResultItem[] = [];
  const q = query.trim().toLowerCase();

  if (q.length > 0 && data?.allRuns) {
    // 1. Match Workflows and Requests
    for (const run of data.allRuns) {
      const matchName = run.requestName.toLowerCase().includes(q);
      const matchId = run.id.toLowerCase().includes(q) || run.requestId.toLowerCase().includes(q);
      const matchPrompt = run.originalPrompt.toLowerCase().includes(q);

      if (matchName || matchId || matchPrompt) {
        results.push({
          type: "workflow",
          title: run.requestName,
          subtitle: `${run.requestId} · Run v${run.runNumber} · ${run.quality.validated} qualified records`,
          runId: run.id,
          to: "/workflow",
        });
      }
    }

    // 2. Match Records / Entities across runs
    for (const run of data.allRuns) {
      for (const record of run.records) {
        const entity = (record.entityName || record.company || "").toLowerCase();
        const role = (record.role || "").toLowerCase();
        let matchAttr = false;
        if (record.attributes) {
          matchAttr = Object.values(record.attributes).some(
            (v) => typeof v === "string" && v.toLowerCase().includes(q),
          );
        }

        if (entity.includes(q) || role.includes(q) || matchAttr) {
          results.push({
            type: "record",
            title: record.entityName || record.company || "Record",
            subtitle: `${record.role !== "—" ? `${record.role} · ` : ""}${record.source} · Run ${run.id}`,
            runId: run.id,
            to: "/datasets",
          });
          if (results.filter((r) => r.type === "record").length >= 8) break;
        }
      }
    }
  }

  async function handleSelect(item: SearchResultItem) {
    setOpen(false);
    setQuery("");
    await navigate({ to: item.to, search: { runId: item.runId } });
  }

  return (
    <div ref={containerRef} className="relative mx-auto hidden w-full max-w-md lg:block">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (query.trim().length > 0) setOpen(true);
        }}
        aria-label="Search platform"
        placeholder="Search tasks, records, sources…"
        className="h-9 w-full rounded-md border border-border bg-muted/50 pl-9 pr-12 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
      />
      {query.length > 0 ? (
        <button
          onClick={() => {
            setQuery("");
            setOpen(false);
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : (
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground pointer-events-none">
          ⌘ K
        </kbd>
      )}

      {open && q.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg">
          {results.length === 0 ? (
            <p className="p-3 text-center text-xs text-muted-foreground">
              No matching workflows or records found.
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {results.map((item, idx) => (
                <button
                  key={`${item.type}-${item.runId}-${idx}`}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="flex w-full items-center gap-3 rounded px-3 py-2 text-left text-xs transition hover:bg-accent hover:text-accent-foreground"
                >
                  {item.type === "workflow" ? (
                    <Waypoints className="size-4 shrink-0 text-primary" />
                  ) : (
                    <Database className="size-4 shrink-0 text-success" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{item.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{item.subtitle}</p>
                  </div>
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                    {item.type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
