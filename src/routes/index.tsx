import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Database, FileCheck2, FileQuestion, Link2, Plus, ShieldAlert, Waypoints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Metric, PageIntro, QualityCallout, SectionHeader, TaskTable } from "@/components/dashboard-ui";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Overview — DataIntel" }, { name: "description", content: "Monitor data collection workflows, quality, and source-backed datasets." }, { property: "og:title", content: "Overview — DataIntel" }, { property: "og:description", content: "Monitor data collection workflows, quality, and source-backed datasets." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Index,
});

const attention = [
  { icon: ShieldAlert, label: "Records needing verification", value: "5", detail: "Partially verified salary values", to: "/datasets" as const },
  { icon: AlertTriangle, label: "Source conflicts", value: "2", detail: "Company size disagreements", to: "/datasets" as const },
  { icon: FileQuestion, label: "Incomplete fields", value: "8", detail: "Salary not disclosed", to: "/datasets" as const },
  { icon: Link2, label: "Evidence coverage", value: "94%", detail: "Values linked to a source snippet", to: "/evidence" as const },
];

function Index() {
  return <div><PageIntro title="Good afternoon, Pravin" description="One workflow is running targeted verification. 31 validated Java backend job records are ready to inspect." actions={<Link to="/requests"><Button><Plus className="size-4" />Create request</Button></Link>} />
    <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Active workflows" value="1" detail="Targeted verification in progress" /><Metric label="Records collected" value="47" detail="36 unique after deduplication" /><Metric label="Average quality" value="88%" detail="Up from 71% before adaptation" trend="17 pts" /><Metric label="Source coverage" value="9" detail="Job boards and careers pages" /></section>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)]"><div className="space-y-6"><section className="border border-border bg-card"><SectionHeader title="Active and recent requests" subtitle="Latest data collection activity" action={<Link to="/history" className="text-xs font-semibold text-primary">View all</Link>} /><TaskTable compact /></section><QualityCallout /></div>
      <aside className="space-y-6"><section className="border border-border bg-card"><SectionHeader title="Active workflow" subtitle="Indian SaaS companies hiring Java backend developers" /><div className="p-5"><div className="flex items-end justify-between"><div><p className="text-3xl font-semibold">82%</p><p className="mt-1 text-xs text-muted-foreground">Step 7 of 8</p></div><span className="rounded-full bg-primary-muted px-2 py-1 text-[11px] font-semibold text-primary">Verifying</span></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full w-[82%] rounded-full bg-primary" /></div><div className="mt-5 space-y-3">{[[Waypoints,"Current step","Targeted verification"],[FileCheck2,"Quality score","88 / 100"],[Database,"Validated","31 of 36 records"]].map(([Icon,label,value]) => { const C = Icon as typeof Waypoints; return <div key={String(label)} className="flex items-center gap-3 text-xs"><C className="size-4 text-muted-foreground" /><span className="flex-1 text-muted-foreground">{String(label)}</span><strong>{String(value)}</strong></div> })}</div><Link to="/workflow" className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs font-semibold text-primary">Monitor workflow <ArrowRight className="size-4" /></Link></div></section>
        <section className="border border-border bg-card"><SectionHeader title="Needs attention" subtitle="Data quality items in DR-1048" /><div className="divide-y divide-border">{attention.map(({ icon: Icon, label, value, detail, to }) => <Link key={label} to={to} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30"><Icon className="size-4 text-muted-foreground" /><span className="flex-1"><span className="block text-xs font-medium">{label}</span><span className="block text-[11px] text-muted-foreground">{detail}</span></span><strong className="text-sm tabular-nums">{value}</strong></Link>)}</div></section></aside>
    </div>
  </div>;
}
