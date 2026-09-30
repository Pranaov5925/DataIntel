import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Settings } from "lucide-react";

export type WorkspacePreferences = {
  userName: string;
  defaultView: "Qualified" | "All";
  defaultPageSize: number;
  theme: "system" | "dark" | "light";
};

const STORAGE_KEY = "dataintel_preferences";

export function getStoredPreferences(): WorkspacePreferences {
  if (typeof window === "undefined") {
    return {
      userName: "Pravin M.",
      defaultView: "Qualified",
      defaultPageSize: 10,
      theme: "system",
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return {
    userName: "Pravin M.",
    defaultView: "Qualified",
    defaultPageSize: 10,
    theme: "system",
  };
}

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [prefs, setPrefs] = useState<WorkspacePreferences>(getStoredPreferences);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setPrefs(getStoredPreferences());
      setSaved(false);
    }
  }, [open]);

  function handleSave() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      setSaved(true);
      setTimeout(() => {
        onOpenChange(false);
      }, 700);
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-muted text-foreground">
              <Settings className="size-4" />
            </span>
            <DialogTitle className="text-base font-semibold">Workspace Settings</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure local prototype preferences for your workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Workspace user name */}
          <div>
            <label className="block font-medium text-foreground">Display Name</label>
            <input
              type="text"
              value={prefs.userName}
              onChange={(e) => setPrefs({ ...prefs, userName: e.target.value })}
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-xs outline-none focus:border-ring"
              placeholder="e.g. Pravin M."
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Used in the dashboard greeting and audit log attribution.
            </p>
          </div>

          {/* Default Dataset View */}
          <div>
            <label className="block font-medium text-foreground">Default Dataset View</label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {[
                { key: "Qualified", label: "Qualified Only", desc: "Show verified matches" },
                { key: "All", label: "All Candidates", desc: "Include unverified" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setPrefs({ ...prefs, defaultView: opt.key as "Qualified" | "All" })}
                  className={`rounded-md border p-2.5 text-left transition ${
                    prefs.defaultView === opt.key
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <p className="text-xs">{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Default Dataset Page Size */}
          <div>
            <label className="block font-medium text-foreground">Records Per Page</label>
            <div className="mt-1.5 flex gap-2">
              {[10, 25, 50].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPrefs({ ...prefs, defaultPageSize: size })}
                  className={`flex-1 rounded-md border py-1.5 text-center text-xs transition ${
                    prefs.defaultPageSize === size
                      ? "border-primary bg-primary text-primary-foreground font-semibold"
                      : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  {size} rows
                </button>
              ))}
            </div>
          </div>

          {/* Preferred Appearance */}
          <div>
            <label className="block font-medium text-foreground">Appearance</label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {[
                { key: "system", label: "System Default" },
                { key: "dark", label: "Dark" },
                { key: "light", label: "Light" },
              ].map((themeOpt) => (
                <button
                  key={themeOpt.key}
                  type="button"
                  onClick={() =>
                    setPrefs({ ...prefs, theme: themeOpt.key as "system" | "dark" | "light" })
                  }
                  className={`rounded-md border py-1.5 text-center text-xs transition ${
                    prefs.theme === themeOpt.key
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  {themeOpt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2 flex items-center justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saved}>
            {saved ? (
              <>
                <Check className="size-3.5 mr-1" />
                Saved
              </>
            ) : (
              "Save Preferences"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
