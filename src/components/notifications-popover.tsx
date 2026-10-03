import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Bell, CheckCircle2, Clock3, HelpCircle } from "lucide-react";
import { getHistoryDataFn, type HistoryData } from "@/lib/storage-fns";

export type NotificationItem = {
  id: string;
  runId: string;
  title: string;
  detail: string;
  type: "success" | "warning" | "conflict";
  timestamp: string;
  to: "/workflow" | "/datasets";
};

const READ_STORAGE_KEY = "dataintel_read_notifications";

function getReadIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function NotificationsPopover() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>(getReadIds);

  useEffect(() => {
    let mounted = true;
    getHistoryDataFn()
      .then((data: HistoryData) => {
        if (!mounted || !data.allRuns) return;

        const notifs: NotificationItem[] = [];

        // Build notifications from real persisted runs
        for (const run of data.allRuns.slice(0, 8)) {
          const runLabel = `v${run.runNumber}`;

          // Notification 1: Run Completion
          notifs.push({
            id: `run-comp-${run.id}`,
            runId: run.id,
            title: `Run ${runLabel} completed`,
            detail: `${run.quality.validated} qualified records ready for "${run.requestName}".`,
            type: "success",
            timestamp: run.completedAt || run.createdAt,
            to: "/datasets",
          });

          // Notification 2: Conflicts if any
          if (run.quality.conflicts > 0) {
            notifs.push({
              id: `run-conf-${run.id}`,
              runId: run.id,
              title: `${run.quality.conflicts} source conflicts in ${run.requestId}`,
              detail: `Competing values detected across web sources in Run ${runLabel}.`,
              type: "conflict",
              timestamp: run.completedAt || run.createdAt,
              to: "/datasets",
            });
          }

          // Notification 3: Incomplete/needs verification if any
          if (run.quality.incomplete > 0) {
            notifs.push({
              id: `run-gap-${run.id}`,
              runId: run.id,
              title: `${run.quality.incomplete} records need verification`,
              detail: `Required constraint data was unverified in ${run.requestId} (${runLabel}).`,
              type: "warning",
              timestamp: run.completedAt || run.createdAt,
              to: "/datasets",
            });
          }
        }

        setNotifications(notifs);
      })
      .catch((err) => console.error("Failed to load notifications:", err));

    return () => {
      mounted = false;
    };
  }, []);

  const unreadCount = notifications.filter((n) => !readIds.includes(n.id)).length;

  function markAllAsRead() {
    const allIds = notifications.map((n) => n.id);
    setReadIds(allIds);
    try {
      localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(allIds));
    } catch {
      // ignore
    }
  }

  function markOneRead(id: string) {
    if (readIds.includes(id)) return;
    const updated = [...readIds, id];
    setReadIds(updated);
    try {
      localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notifications (${unreadCount} unread)`}
          className="relative"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-lg" sideOffset={8}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary-muted px-1.5 py-0.2 text-[10px] font-bold text-primary">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-[11px] font-medium text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-72 divide-y divide-border overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              <Clock3 className="mx-auto size-6 mb-2 text-muted-foreground/60" />
              No notifications yet.
            </div>
          ) : (
            notifications.map((n) => {
              const isUnread = !readIds.includes(n.id);
              return (
                <Link
                  key={n.id}
                  to={n.to}
                  search={{ runId: n.runId }}
                  onClick={() => {
                    markOneRead(n.id);
                    setOpen(false);
                  }}
                  className={`flex items-start gap-3 p-3 text-left transition hover:bg-muted/40 ${
                    isUnread ? "bg-muted/20" : ""
                  }`}
                >
                  {n.type === "success" && (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  )}
                  {n.type === "warning" && (
                    <HelpCircle className="mt-0.5 size-4 shrink-0 text-warning" />
                  )}
                  {n.type === "conflict" && (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs ${isUnread ? "font-semibold text-foreground" : "font-medium text-muted-foreground"}`}
                    >
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2 leading-4">
                      {n.detail}
                    </p>
                    <span className="mt-1 block text-[10px] text-muted-foreground/80">
                      {n.timestamp}
                    </span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
