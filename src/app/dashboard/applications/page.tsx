import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import {
  FileText, Clock, CheckCircle2, XCircle, Eye,
  ArrowLeft, Zap, AlertTriangle, Shield,
} from "lucide-react";
import { timeAgo } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; bgColor: string; label: string }> = {
  pending:    { icon: Clock,        color: "text-accent",     bgColor: "bg-accent/10",    label: "Awaiting Review" },
  submitted:  { icon: CheckCircle2, color: "text-primary",    bgColor: "bg-primary/10",   label: "Submitted" },
  reviewed:   { icon: Eye,          color: "text-purple-600", bgColor: "bg-purple-100",    label: "Reviewed" },
  interview:  { icon: CheckCircle2, color: "text-success",    bgColor: "bg-success/10",   label: "Interview" },
  rejected:   { icon: XCircle,      color: "text-danger",     bgColor: "bg-danger/10",    label: "Not Selected" },
  hired:      { icon: CheckCircle2, color: "text-success",    bgColor: "bg-success/10",   label: "Hired!" },
};

type AIDraftData = {
  matchScore?: number;
  warnings?: string[];
  atsType?: string;
  fields?: { fieldId: string; value: string; source: string; confidence: number }[];
};

function parseAIDraft(aiDraft: string | null): AIDraftData | null {
  if (!aiDraft) return null;
  try {
    return JSON.parse(aiDraft);
  } catch {
    return null;
  }
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-success";
  if (score >= 40) return "text-accent";
  return "text-danger";
}

export default async function ApplicationsPage() {
  const session = await requireAuth();

  const applications = await prisma.application.findMany({
    where: { userId: session.user.id },
    include: { job: true },
    orderBy: { createdAt: "desc" },
  });

  const pendingCount = applications.filter((a) => a.status === "pending").length;
  const submittedCount = applications.filter((a) => a.status === "submitted").length;

  return (
    <div className="bg-surface min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-muted hover:text-foreground mb-4 text-sm">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-foreground mb-2">My Applications</h1>

        {/* Summary Stats */}
        <div className="flex flex-wrap gap-4 mb-8 text-sm">
          <span className="badge bg-surface-dark text-muted px-3 py-1">
            {applications.length} total
          </span>
          {pendingCount > 0 && (
            <span className="badge bg-accent/10 text-accent px-3 py-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {pendingCount} awaiting your review
            </span>
          )}
          <span className="badge bg-primary/10 text-primary px-3 py-1">
            {submittedCount} submitted
          </span>
        </div>

        {applications.length === 0 ? (
          <div className="card text-center py-16">
            <FileText className="h-12 w-12 text-muted mx-auto mb-3" />
            <p className="text-lg font-medium text-foreground">No applications yet</p>
            <p className="text-muted mt-1">Use Submit All to apply to multiple jobs at once.</p>
            <Link href="/dashboard/submit-all" className="btn-primary mt-4 inline-block">
              Start Applying
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => {
              const status = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending;
              const StatusIcon = status.icon;
              const draft = parseAIDraft(app.aiDraft);
              const templateFields = draft?.fields?.filter((f) => f.source === "template").length || 0;
              const llmFields = draft?.fields?.filter((f) => f.source === "llm").length || 0;

              return (
                <div key={app.id} className="card">
                  <div className="flex items-start gap-4">
                    {/* Match score badge */}
                    {draft?.matchScore != null ? (
                      <div className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center shrink-0 ${
                        draft.matchScore >= 70 ? "bg-success/10" : draft.matchScore >= 40 ? "bg-accent/10" : "bg-danger/10"
                      }`}>
                        <span className={`text-lg font-bold ${scoreColor(draft.matchScore)}`}>
                          {draft.matchScore}
                        </span>
                        <span className="text-[10px] text-muted">match</span>
                      </div>
                    ) : (
                      <StatusIcon className={`h-6 w-6 ${status.color} shrink-0 mt-1`} />
                    )}

                    <div className="flex-1 min-w-0">
                      <Link href={`/jobs/${app.jobId}`} className="font-semibold text-foreground hover:text-primary truncate block">
                        {app.job.title}
                      </Link>
                      <p className="text-sm text-muted">{app.job.company} — {app.job.location}</p>

                      {/* AI Draft details */}
                      {draft && (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {draft.atsType && (
                            <span className="badge bg-surface-dark text-muted text-xs uppercase">
                              {draft.atsType}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-muted">
                            <Shield className="h-3 w-3 text-success" /> {templateFields} template
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted">
                            <Zap className="h-3 w-3 text-primary" /> {llmFields} AI-generated
                          </span>
                          {draft.warnings && draft.warnings.length > 0 && (
                            <span className="flex items-center gap-1 text-xs text-accent">
                              <AlertTriangle className="h-3 w-3" /> {draft.warnings.length} warning(s)
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`badge ${status.bgColor} ${status.color}`}>
                        {status.label}
                      </span>
                      <p className="text-xs text-muted mt-1">
                        {timeAgo(new Date(app.createdAt))}
                      </p>
                      {app.status === "pending" && (
                        <span className="text-xs text-primary font-medium mt-1 block">
                          Review needed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Batch info */}
                  {app.batchId && (
                    <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-xs text-muted">
                      <Zap className="h-3 w-3 text-primary" />
                      Batch: {app.batchId}
                      {app.submittedAt && (
                        <span className="ml-auto">Submitted {timeAgo(new Date(app.submittedAt))}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
