import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  HelpCircle,
  Link2,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";

export function HelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </span>
            <DialogTitle className="text-base font-semibold">
              DataIntel — Platform Guide & Documentation
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Reference guide for autonomous web collection, qualification rules, and evidence
            verification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2 text-xs">
          {/* What is DataIntel */}
          <section className="space-y-2 rounded-md border border-border bg-muted/30 p-4">
            <h3 className="font-semibold text-foreground">What is DataIntel (PS01)?</h3>
            <p className="leading-5 text-muted-foreground">
              DataIntel is an AI-powered data intelligence platform. It converts free-form natural
              language requirements into structured, deterministic collection workflows,
              automatically gathers multi-source web data, evaluates hard qualification rules, and
              preserves rigorous source provenance.
            </p>
          </section>

          {/* How it works */}
          <section className="space-y-3">
            <h3 className="font-semibold text-foreground">How the Pipeline Works</h3>
            <div className="grid gap-2 rounded-md border border-border p-3 text-[11px]">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">1</span>
                <span>Natural Language Request</span>
                <ArrowRight className="size-3 text-muted-foreground" />
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">2</span>
                <span>Requirement Understanding</span>
                <ArrowRight className="size-3 text-muted-foreground" />
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">3</span>
                <span>Collection Blueprint</span>
              </div>
              <div className="flex items-center gap-2 font-medium text-foreground">
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">4</span>
                <span>Source Discovery</span>
                <ArrowRight className="size-3 text-muted-foreground" />
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">5</span>
                <span>Content Extraction</span>
                <ArrowRight className="size-3 text-muted-foreground" />
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">6</span>
                <span>Deduplication &amp; Conflicts</span>
              </div>
              <div className="flex items-center gap-2 font-medium text-foreground">
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">7</span>
                <span>Deterministic Qualification</span>
                <ArrowRight className="size-3 text-muted-foreground" />
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">8</span>
                <span>Published Evidence Dataset</span>
              </div>
            </div>
          </section>

          {/* Qualification Statuses */}
          <section className="space-y-3">
            <h3 className="font-semibold text-foreground">Dataset Qualification Statuses</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2.5 rounded border border-success/30 bg-success-muted p-2.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                <div>
                  <strong className="block text-success font-semibold">Qualified</strong>
                  <p className="mt-0.5 text-muted-foreground">
                    All user constraints (e.g. price limit, range, size, location) are verified from
                    collected source evidence.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded border border-warning/30 bg-warning-muted p-2.5">
                <HelpCircle className="mt-0.5 size-4 shrink-0 text-warning" />
                <div>
                  <strong className="block text-warning font-semibold">Needs verification</strong>
                  <p className="mt-0.5 text-muted-foreground">
                    The record is relevant to the query, but at least one hard constraint value was
                    missing or not disclosed in collected sources.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded border border-destructive/30 bg-danger-muted p-2.5">
                <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div>
                  <strong className="block text-destructive font-semibold">Excluded</strong>
                  <p className="mt-0.5 text-muted-foreground">
                    Verified source evidence shows that the candidate violates a hard qualification
                    rule (e.g., price exceeds ₹50 lakh limit).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded border border-destructive/40 bg-danger-muted p-2.5">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div>
                  <strong className="block text-destructive font-semibold">Conflict</strong>
                  <p className="mt-0.5 text-muted-foreground">
                    Two or more credible sources provide conflicting values for an important
                    attribute, preserved for human inspection.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Evidence and History */}
          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded border border-border p-3">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Link2 className="size-3.5 text-primary" />
                <span>Source Provenance</span>
              </div>
              <p className="mt-1.5 text-muted-foreground leading-4">
                Every extracted attribute is linked to the original page URL and contextual snippet
                text from which it was extracted.
              </p>
            </div>
            <div className="rounded border border-border p-3">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Clock3 className="size-3.5 text-primary" />
                <span>Run Isolation</span>
              </div>
              <p className="mt-1.5 text-muted-foreground leading-4">
                Every workflow execution is an immutable research snapshot. Historical runs remain
                preserved and independently accessible.
              </p>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
