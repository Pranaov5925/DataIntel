import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  FileText,
  Globe2,
  Loader2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/dashboard-ui";
import { DEMO_REQUEST } from "@/lib/mock-data";
import { generateWorkflowFn } from "@/lib/generate-workflow";
import { setActiveWorkflowPlan } from "@/lib/workflow-store";

export const Route = createFileRoute("/requests")({
  head: () => ({
    meta: [
      { title: "Create Data Request — DataIntel" },
      {
        name: "description",
        content: "Describe and configure a source-backed data collection request.",
      },
      { property: "og:title", content: "Create Data Request — DataIntel" },
      {
        property: "og:description",
        content: "Describe and configure a source-backed data collection request.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RequestsPage,
});

const suggestions = [
  {
    label: "Find Java backend jobs in India",
    text: "Find Java backend developer job openings in India posted in the last 30 days. Include company, role, location, experience, salary if available, and source.",
  },
  {
    label: "Find Indian SaaS companies hiring software engineers",
    text: "Find Indian SaaS companies currently hiring software engineers. Include company name, open roles, location, company size, and source.",
  },
  {
    label: "Research EV models under ₹2 lakh",
    text: "Research electric two-wheeler models in India priced under ₹2 lakh. Include brand, model, price, range, battery capacity, and source.",
  },
  {
    label: "Find potential B2B software leads",
    text: "Find Indian B2B software companies with 50–500 employees. Include company name, headquarters, product category, company size, website, and source.",
  },
];

function RequestsPage() {
  const navigate = useNavigate({ from: "/requests" });
  const [request, setRequest] = useState(DEMO_REQUEST);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!request.trim() || creating) return;
    setCreating(true);
    setError(null);

    try {
      const res = await generateWorkflowFn({
        data: {
          request: request.trim(),
          preferences: {
            geography: "India",
            outputFormat: "Structured dataset",
            verification: "Source evidence for every value",
            qualityThreshold: "High · 85% confidence",
          },
        },
      });

      if (!res.success) {
        setError(res.error || "Failed to generate workflow with Gemini.");
        setCreating(false);
        return;
      }

      setActiveWorkflowPlan(res.data);
      navigate({ to: "/workflow" });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while communicating with Gemini.";
      setError(message);
      setCreating(false);
    }
  }

  return (
    <div>
      <PageIntro
        eyebrow="Start with an outcome"
        title="What data do you need?"
        description="Describe the entities, fields, geography, and quality requirements. The platform will turn them into a transparent collection workflow."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(330px,.7fr)]">
        <section className="border border-border bg-card">
          <div className="border-b border-border px-6 py-5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h3 className="text-sm font-semibold">Data requirement</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Plain language works best when goals and constraints are specific.
            </p>
          </div>
          <div className="p-6">
            <textarea
              value={request}
              onChange={(event) => setRequest(event.target.value)}
              disabled={creating}
              rows={7}
              aria-label="Data requirement prompt"
              className="min-h-52 w-full resize-none rounded-md border border-border bg-background p-4 text-sm leading-7 outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-60"
            />

            {error && (
              <div className="mt-4 rounded-md border border-destructive/40 bg-danger-muted p-4 text-xs text-destructive">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">Workflow Generation Error</p>
                    <p className="mt-1 text-muted-foreground leading-5">{error}</p>
                    {error.includes("GEMINI_API_KEY") && (
                      <p className="mt-2 text-[11px] font-medium text-foreground">
                        Tip: Open the{" "}
                        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                          .env
                        </code>{" "}
                        file in your project root, add your valid{" "}
                        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                          GEMINI_API_KEY
                        </code>
                        , and try again.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase text-muted-foreground">
                Try an example
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setRequest(item.text);
                      setError(null);
                    }}
                    disabled={creating}
                    className="rounded-md border border-border bg-background px-3 py-2 text-left text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:opacity-50"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-border bg-muted/30 px-6 py-4">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 text-success" />
                Collection uses permitted public sources only
              </div>
              <Button onClick={submit} disabled={!request.trim() || creating}>
                {creating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Generating with Gemini…
                  </>
                ) : (
                  <>
                    Generate workflow
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-sm font-semibold">Collection preferences</h3>
            </div>
            <div className="divide-y divide-border px-5">
              {[
                { icon: Globe2, label: "Geography", value: "India" },
                { icon: FileText, label: "Output format", value: "Structured dataset" },
                {
                  icon: ShieldCheck,
                  label: "Verification",
                  value: "Source evidence for every value",
                },
                {
                  icon: SlidersHorizontal,
                  label: "Quality threshold",
                  value: "High · 85% confidence",
                },
              ].map(({ icon: Icon, label, value }) => (
                <button
                  key={label}
                  type="button"
                  className="flex w-full items-center gap-3 py-4 text-left transition hover:opacity-80"
                >
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="flex-1">
                    <span className="block text-[11px] text-muted-foreground">{label}</span>
                    <strong className="mt-0.5 block text-xs font-medium">{value}</strong>
                  </span>
                  <ChevronDown className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </section>

          <section className="border border-border bg-card p-5">
            <p className="text-[10px] font-semibold uppercase text-primary">What happens next</p>
            <ol className="mt-4 space-y-4">
              {[
                "Understand target, geography, and required fields",
                "Generate a collection blueprint",
                "Collect, extract, and deduplicate records",
                "Adapt research when evidence is missing",
              ].map((item, index) => (
                <li key={item} className="flex gap-3 text-xs text-muted-foreground">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-semibold text-foreground">
                    {index + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
