import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  ChevronDown,
  CircleHelp,
  Clock3,
  Database,
  FileSearch,
  Gauge,
  Menu,
  Plus,
  Settings,
  Sparkles,
  Waypoints,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HelpDialog } from "@/components/help-dialog";
import { SettingsDialog } from "@/components/settings-dialog";
import { NotificationsPopover } from "@/components/notifications-popover";
import { TopSearch } from "@/components/top-search";

type NavigationItem = {
  to: "/" | "/requests" | "/workflow" | "/datasets" | "/evidence" | "/history";
  label: string;
  icon: typeof Gauge;
  badge?: string;
};

const navigation: NavigationItem[] = [
  { to: "/", label: "Overview", icon: Gauge },
  { to: "/requests", label: "New request", icon: Plus },
  { to: "/workflow", label: "Active workflow", icon: Waypoints },
  { to: "/datasets", label: "Datasets", icon: Database },
  { to: "/evidence", label: "Sources & evidence", icon: FileSearch },
  { to: "/history", label: "Workflow history", icon: Clock3 },
];

const pageDetails: Record<string, { title: string; eyebrow: string }> = {
  "/": { title: "Overview", eyebrow: "Workspace" },
  "/requests": { title: "Create data request", eyebrow: "New collection" },
  "/workflow": { title: "Active workflow", eyebrow: "Data pipeline" },
  "/datasets": { title: "Dataset explorer", eyebrow: "Dataset" },
  "/evidence": { title: "Sources & evidence", eyebrow: "Audit trail" },
  "/history": { title: "Workflow history", eyebrow: "Provenance" },
};

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const searchObj = useRouterState({ select: (state) => state.location.search }) as Record<string, unknown>;
  const activeRunId = typeof searchObj?.["runId"] === "string" ? (searchObj["runId"] as string) : undefined;

  const baseDetails = pageDetails[pathname] ?? { title: "Overview", eyebrow: "Workspace" };
  const details = {
    title: baseDetails.title,
    eyebrow: activeRunId || baseDetails.eyebrow,
  };

  const sidebar = (
    <>
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <span>
            <strong className="block text-sm leading-none text-sidebar-foreground">
              DataIntel
            </strong>
            <span className="mt-1 block text-[10px] font-medium uppercase text-sidebar-muted">
              AI intelligence platform
            </span>
          </span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        >
          <X className="size-4" />
        </Button>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Primary navigation">
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase text-sidebar-muted">Platform</p>
        {navigation.map(({ to, label, icon: Icon, badge }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/" }}
            onClick={() => setOpen(false)}
            className="flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground [&.active]:bg-sidebar-accent [&.active]:text-sidebar-foreground"
          >
            <Icon className="size-4" />
            <span>{label}</span>
            {badge && (
              <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">
                {badge}
              </span>
            )}
          </Link>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={() => setHelpOpen(true)}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-sidebar-muted transition hover:bg-sidebar-accent hover:text-sidebar-foreground cursor-pointer"
        >
          <CircleHelp className="size-4" />
          Help &amp; documentation
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-sidebar-muted transition hover:bg-sidebar-accent hover:text-sidebar-foreground cursor-pointer"
        >
          <Settings className="size-4" />
          Workspace settings
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="mt-3 flex w-full items-center gap-3 border-t border-sidebar-border px-3 pt-4 text-left transition hover:opacity-80 cursor-pointer"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-avatar text-xs font-semibold text-avatar-foreground">
            PM
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-xs text-sidebar-foreground">Pravin M.</strong>
            <span className="block text-[10px] text-sidebar-muted">Admin workspace</span>
          </span>
          <ChevronDown className="size-4 text-sidebar-muted" />
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        {sidebar}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 bg-overlay md:hidden" onClick={() => setOpen(false)}>
          <aside
            className="flex h-full w-72 flex-col bg-sidebar"
            onClick={(event) => event.stopPropagation()}
          >
            {sidebar}
          </aside>
        </div>
      )}
      <div className="md:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur md:px-7">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <div className="hidden min-w-0 md:block">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
              {details.eyebrow}
            </p>
            <h1 className="truncate text-sm font-semibold text-foreground">{details.title}</h1>
          </div>

          {/* Connected Top Search Bar */}
          <TopSearch />

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Workspace settings"
              onClick={() => setSettingsOpen(true)}
              className="hidden md:inline-flex"
            >
              <Settings className="size-4" />
            </Button>
            <NotificationsPopover />
            <Link
              to="/requests"
              className="ml-2 inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-4" />
              New request
            </Link>
          </div>
        </header>
        <main
          className={cn(
            "mx-auto max-w-[1500px] p-4 md:p-7",
            pathname === "/datasets" && "max-w-none",
          )}
        >
          {children}
        </main>
      </div>

      {/* Lightweight in-app modals */}
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
