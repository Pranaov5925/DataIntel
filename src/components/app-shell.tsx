import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  Bell,
  ChevronDown,
  CircleHelp,
  Clock3,
  Database,
  FileSearch,
  Gauge,
  Menu,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  Sparkles,
  Waypoints,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavigationItem = {
  to: "/" | "/requests" | "/workflow" | "/datasets" | "/evidence" | "/history";
  label: string;
  icon: typeof Gauge;
  badge?: string;
};

const navigation: NavigationItem[] = [
  { to: "/", label: "Overview", icon: Gauge },
  { to: "/requests", label: "New request", icon: Plus },
  { to: "/workflow", label: "Active workflow", icon: Waypoints, badge: "1" },
  { to: "/datasets", label: "Datasets", icon: Database },
  { to: "/evidence", label: "Sources & evidence", icon: FileSearch },
  { to: "/history", label: "Workflow history", icon: Clock3 },
];

const pageDetails: Record<string, { title: string; eyebrow: string }> = {
  "/": { title: "Overview", eyebrow: "Workspace" },
  "/requests": { title: "Create data request", eyebrow: "New collection" },
  "/workflow": { title: "Active workflow", eyebrow: "DR-1048" },
  "/datasets": { title: "Dataset explorer", eyebrow: "DR-1048" },
  "/evidence": { title: "Sources & evidence", eyebrow: "DR-1048" },
  "/history": { title: "Workflow history", eyebrow: "DR-1048" },
};

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const details = pageDetails[pathname] ?? { title: "Overview", eyebrow: "Workspace" };

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
        <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground">
          <CircleHelp className="size-4" />
          Help & documentation
        </button>
        <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground">
          <Settings className="size-4" />
          Workspace settings
        </button>
        <div className="mt-3 flex items-center gap-3 border-t border-sidebar-border px-3 pt-4">
          <span className="flex size-8 items-center justify-center rounded-full bg-avatar text-xs font-semibold text-avatar-foreground">
            PM
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-xs text-sidebar-foreground">Pravin M.</strong>
            <span className="block text-[10px] text-sidebar-muted">Admin workspace</span>
          </span>
          <ChevronDown className="size-4 text-sidebar-muted" />
        </div>
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
          <div className="relative mx-auto hidden w-full max-w-md lg:block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              aria-label="Search platform"
              placeholder="Search tasks, records, sources…"
              className="h-9 w-full rounded-md border border-border bg-muted/50 pl-9 pr-12 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
              ⌘ K
            </kbd>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Collapse sidebar"
              className="hidden md:inline-flex"
            >
              <PanelLeftClose className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
              <Bell className="size-4" />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-destructive" />
            </Button>
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
    </div>
  );
}
