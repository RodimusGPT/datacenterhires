"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Zap, CheckCircle2, AlertCircle, Send, AlertTriangle,
  Eye, ChevronDown, ChevronUp, Shield, FileText,
} from "lucide-react";
import { formatSalary } from "@/lib/utils";

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: string | null;
  category: string;
};

type DraftSummary = {
  applicationId: string;
  jobTitle: string;
  company: string;
  matchScore: number;
  warningCount: number;
  atsType: string;
};

type SubmitResult = {
  batchId: string;
  applied: number;
  duplicates: number;
  remaining: number;
  drafts: DraftSummary[];
};

export default function SubmitAllPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState("");
  const [reviewMode, setReviewMode] = useState(false);
  const [expandedDraft, setExpandedDraft] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((data) => {
        setJobs(data.jobs || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === jobs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(jobs.map((j) => j.id)));
    }
  }

  async function handleSubmitAll() {
    if (selected.size === 0) return;
    setSubmitting(true);
    setError("");
    setResult(null);

    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobIds: Array.from(selected) }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    setResult(data);
    setSelected(new Set());
    setReviewMode(true);
  }

  function scoreColor(score: number): string {
    if (score >= 70) return "text-success";
    if (score >= 40) return "text-accent";
    return "text-danger";
  }

  function scoreBg(score: number): string {
    if (score >= 70) return "bg-success/10";
    if (score >= 40) return "bg-accent/10";
    return "bg-danger/10";
  }

  return (
    <div className="bg-surface min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-primary rounded-lg p-2">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Submit All — AI Auto-Apply</h1>
            <p className="text-muted text-sm">
              Select jobs, generate AI drafts, review, then submit.
            </p>
          </div>
        </div>

        {/* Pipeline explainer */}
        <div className="card bg-surface-dark my-6">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">1</div>
              <span className="text-muted">Select Jobs</span>
            </div>
            <div className="h-px flex-1 bg-border" />
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${reviewMode ? "bg-primary text-white" : "bg-border text-muted"}`}>2</div>
              <span className="text-muted">AI Maps Resume → ATS</span>
            </div>
            <div className="h-px flex-1 bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-border text-muted flex items-center justify-center text-xs font-bold">3</div>
              <span className="text-muted">Review & Confirm</span>
            </div>
          </div>
        </div>

        {/* Bot Mitigation Notice */}
        <div className="card bg-accent/5 border-accent/20 mb-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          <div className="text-sm text-muted">
            <span className="font-semibold text-foreground">Quality Guardrail:</span> The AI generates
            application drafts using a hybrid approach — template mapping for standard fields (name,
            email, certs) and contextual generation for screening questions. You must review each
            draft before final submission.
          </div>
        </div>

        {/* === REVIEW MODE: Show AI Drafts === */}
        {reviewMode && result && result.drafts.length > 0 && (
          <div className="mb-8">
            <div className="card bg-success/5 border-success/20 mb-6 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">
                  {result.applied} AI drafts generated — review before confirming
                </p>
                <p className="text-sm text-muted">
                  {result.duplicates > 0 && `${result.duplicates} duplicate(s) skipped. `}
                  {result.remaining} applies remaining today. Batch: {result.batchId}
                </p>
              </div>
            </div>

            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" /> Review AI Application Drafts
            </h2>

            <div className="space-y-3">
              {result.drafts.map((draft) => (
                <div key={draft.applicationId} className="card">
                  <button
                    onClick={() => setExpandedDraft(
                      expandedDraft === draft.applicationId ? null : draft.applicationId
                    )}
                    className="w-full flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${scoreBg(draft.matchScore)} ${scoreColor(draft.matchScore)}`}>
                        {draft.matchScore}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-foreground">{draft.jobTitle}</p>
                        <p className="text-sm text-muted">{draft.company}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="badge bg-surface-dark text-muted text-xs uppercase">
                        {draft.atsType}
                      </span>
                      {draft.warningCount > 0 && (
                        <span className="badge bg-accent/10 text-accent flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> {draft.warningCount}
                        </span>
                      )}
                      {expandedDraft === draft.applicationId ? (
                        <ChevronUp className="h-4 w-4 text-muted" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted" />
                      )}
                    </div>
                  </button>

                  {expandedDraft === draft.applicationId && (
                    <div className="mt-4 pt-4 border-t border-border space-y-3">
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="bg-surface rounded-lg p-3 text-center">
                          <p className={`text-xl font-bold ${scoreColor(draft.matchScore)}`}>
                            {draft.matchScore}%
                          </p>
                          <p className="text-xs text-muted">Match Score</p>
                        </div>
                        <div className="bg-surface rounded-lg p-3 text-center">
                          <p className="text-xl font-bold text-primary">
                            {draft.atsType.toUpperCase()}
                          </p>
                          <p className="text-xs text-muted">ATS Platform</p>
                        </div>
                        <div className="bg-surface rounded-lg p-3 text-center">
                          <p className="text-xl font-bold text-foreground">Hybrid</p>
                          <p className="text-xs text-muted">Fill Strategy</p>
                        </div>
                      </div>

                      <div className="bg-surface rounded-lg p-3">
                        <p className="text-xs font-semibold text-muted mb-2">FIELD MAPPING SUMMARY</p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1 text-success">
                            <Shield className="h-3.5 w-3.5" /> Template-filled: standard fields
                          </span>
                          <span className="flex items-center gap-1 text-primary">
                            <Zap className="h-3.5 w-3.5" /> AI-generated: screening answers
                          </span>
                        </div>
                      </div>

                      {draft.warningCount > 0 && (
                        <div className="bg-accent/5 rounded-lg p-3 flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                          <p className="text-sm text-muted">
                            {draft.warningCount} field(s) need your attention — may be missing
                            certifications or require manual input.
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button className="btn-primary flex-1 text-sm py-2">
                          <CheckCircle2 className="h-4 w-4 inline mr-1" /> Approve & Submit
                        </button>
                        <button className="btn-outline flex-1 text-sm py-2">
                          <FileText className="h-4 w-4 inline mr-1" /> Edit Draft
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => { setReviewMode(false); setResult(null); }}
              className="btn-outline w-full mt-4"
            >
              Apply to More Jobs
            </button>
          </div>
        )}

        {/* === SELECTION MODE === */}
        {!reviewMode && (
          <>
            {error && (
              <div className="card bg-danger/5 border-danger/20 mb-6 text-danger text-sm">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <button onClick={selectAll} className="text-sm text-primary font-medium hover:underline">
                {selected.size === jobs.length ? "Deselect All" : "Select All"}
              </button>
              <span className="text-sm text-muted">{selected.size} selected</span>
            </div>

            {loading ? (
              <div className="text-center py-16 text-muted">Loading jobs...</div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <label
                    key={job.id}
                    className={`card flex items-center gap-4 cursor-pointer transition-all ${
                      selected.has(job.id) ? "ring-2 ring-primary bg-primary/5" : "hover:shadow-sm"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(job.id)}
                      onChange={() => toggle(job.id)}
                      className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{job.title}</p>
                      <p className="text-sm text-muted">{job.company} — {job.location}</p>
                    </div>
                    <span className="text-sm font-medium text-primary shrink-0">
                      {formatSalary(job.salaryMin, job.salaryMax, job.salaryPeriod)}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {selected.size > 0 && (
              <div className="sticky bottom-4 mt-6">
                <button
                  onClick={handleSubmitAll}
                  disabled={submitting}
                  className="btn-primary w-full text-lg py-4 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Zap className="h-5 w-5 animate-pulse" />
                      Generating AI Drafts...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      Generate Drafts for {selected.size} Jobs
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
