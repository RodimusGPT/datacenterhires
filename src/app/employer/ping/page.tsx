"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, MessageSquare, Send, Users,
  AlertCircle, CheckCircle2, TrendingUp,
  Shield, MapPin, Clock, Star,
} from "lucide-react";
import { CERTIFICATIONS } from "@/lib/utils";

type ScoreBreakdown = {
  certScore: number;
  proximityScore: number;
  experienceScore: number;
  freshnessScore: number;
  travelBonus: number;
  total: number;
};

type ScoredCandidate = {
  profileId: string;
  name: string;
  location: string | null;
  yearsExperience: number;
  certifications: string[];
  willingToTravel: boolean;
  score: number;
  breakdown: ScoreBreakdown;
};

type CampaignResult = {
  campaignId: string;
  recipients: number;
  costPerPing: number;
  dripSteps: number;
  estimatedTotalCost: number;
  topCandidates: { name: string; score: number; certifications: string[]; location: string | null }[];
};

const COST_PER_PING = 3.0;

export default function PingPage() {
  const [step, setStep] = useState(1);

  // Targeting state
  const [selectedCerts, setSelectedCerts] = useState<Set<string>>(new Set());
  const [location, setLocation] = useState("Houston, TX");
  const [radius, setRadius] = useState(100);
  const [minExperience, setMinExperience] = useState(0);

  // Scoring state
  const [estimating, setEstimating] = useState(false);
  const [matchCount, setMatchCount] = useState<{ total: number; eligible: number; topTier: number } | null>(null);
  const [rankedCandidates, setRankedCandidates] = useState<ScoredCandidate[]>([]);

  // Compose state
  const [campaignName, setCampaignName] = useState("");
  const [message, setMessage] = useState("");
  const [dripSteps, setDripSteps] = useState(0);

  // Result state
  const [launching, setLaunching] = useState(false);
  const [campaignResult, setCampaignResult] = useState<CampaignResult | null>(null);
  const [error, setError] = useState("");

  function toggleCert(cert: string) {
    setSelectedCerts((prev) => {
      const next = new Set(prev);
      if (next.has(cert)) next.delete(cert);
      else next.add(cert);
      return next;
    });
  }

  const estimateMatches = useCallback(async () => {
    setEstimating(true);
    try {
      const res = await fetch("/api/candidates/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requiredCerts: Array.from(selectedCerts),
          location,
          radiusMiles: radius,
          minExperience,
          mode: "estimate",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMatchCount(data);
      }
    } finally {
      setEstimating(false);
    }
  }, [selectedCerts, location, radius, minExperience]);

  async function fetchRankedCandidates() {
    const res = await fetch("/api/candidates/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requiredCerts: Array.from(selectedCerts),
        location,
        radiusMiles: radius,
        minExperience,
        mode: "full",
        limit: 10,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setRankedCandidates(data.candidates || []);
    }
  }

  async function handleAdvanceToCompose() {
    await fetchRankedCandidates();
    setStep(2);
  }

  async function handleLaunchCampaign() {
    if (!campaignName || !message) {
      setError("Campaign name and message are required");
      return;
    }
    setLaunching(true);
    setError("");

    const res = await fetch("/api/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignName,
        message,
        requiredCerts: Array.from(selectedCerts),
        location,
        radiusMiles: radius,
        minExperience,
        dripSteps,
      }),
    });

    const data = await res.json();
    setLaunching(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    setCampaignResult(data);
    setStep(4); // Success state
  }

  function scoreColor(score: number): string {
    if (score >= 70) return "text-success";
    if (score >= 40) return "text-accent";
    return "text-danger";
  }

  const eligibleCount = matchCount?.eligible ?? 0;
  const estimatedCost = eligibleCount * COST_PER_PING * (1 + dripSteps);

  return (
    <div className="bg-surface min-h-screen py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/employer" className="inline-flex items-center gap-1 text-muted hover:text-foreground mb-4 text-sm">
          <ArrowLeft className="h-4 w-4" /> Back to Employer Hub
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="bg-accent rounded-lg p-2">
            <MessageSquare className="h-6 w-6 text-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Candidate Ping</h1>
            <p className="text-muted text-sm">
              AI-scored targeting + SMS delivery (98% read rate)
            </p>
          </div>
        </div>

        {/* TCPA Notice */}
        <div className="card bg-primary/5 border-primary/20 mb-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-muted">
            <span className="font-semibold text-foreground">TCPA Compliance:</span> All candidates
            have provided written consent for SMS communications. Every message includes a mandatory
            opt-out mechanism. Only SMS-opted-in candidates with phone numbers are eligible.
          </div>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-4 mb-8">
          {[
            { n: 1, label: "Target & Score" },
            { n: 2, label: "Compose Message" },
            { n: 3, label: "Review & Send" },
          ].map((s) => (
            <button
              key={s.n}
              onClick={() => s.n < step && setStep(s.n)}
              className={`flex items-center gap-2 text-sm font-medium ${
                step >= s.n ? "text-primary" : "text-muted"
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step >= s.n ? "bg-primary text-white" : "bg-surface-dark text-muted"
              }`}>
                {step > s.n ? <CheckCircle2 className="h-4 w-4" /> : s.n}
              </div>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="card bg-danger/5 border-danger/20 mb-6 text-danger text-sm">{error}</div>
        )}

        {/* === STEP 1: Target & Score === */}
        {step === 1 && (
          <div className="card space-y-6">
            <h2 className="text-lg font-bold text-foreground">Define your target audience</h2>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Required Certifications
              </label>
              <div className="flex flex-wrap gap-2">
                {CERTIFICATIONS.map((cert) => (
                  <button
                    key={cert}
                    type="button"
                    onClick={() => toggleCert(cert)}
                    className={`badge cursor-pointer transition-colors ${
                      selectedCerts.has(cert)
                        ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                        : "bg-surface-dark text-muted hover:bg-primary/5"
                    }`}
                  >
                    {selectedCerts.has(cert) ? "\u2713 " : "+ "}{cert}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                  <input
                    className="input pl-10"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Houston, TX"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Radius (miles)</label>
                <input
                  type="number"
                  className="input"
                  value={radius}
                  onChange={(e) => setRadius(parseInt(e.target.value) || 50)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Minimum Experience (years)
              </label>
              <input
                type="number"
                className="input"
                value={minExperience}
                onChange={(e) => setMinExperience(parseInt(e.target.value) || 0)}
                placeholder="0"
              />
            </div>

            <button
              onClick={estimateMatches}
              disabled={estimating}
              className="btn-outline w-full flex items-center justify-center gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              {estimating ? "Scoring candidates..." : "Run Candidate Scoring"}
            </button>

            {matchCount && (
              <div className="bg-surface rounded-lg p-4 space-y-3">
                <p className="text-xs font-semibold text-muted uppercase">Scoring Results</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{matchCount.total}</p>
                    <p className="text-xs text-muted">Total Candidates</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary">{matchCount.eligible}</p>
                    <p className="text-xs text-muted">Eligible (SMS opted-in)</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-success">{matchCount.topTier}</p>
                    <p className="text-xs text-muted">Top Tier (score 70+)</p>
                  </div>
                </div>

                <div className="text-xs text-muted pt-2 border-t border-border">
                  <p className="font-medium text-foreground mb-1">Scoring Weights:</p>
                  <div className="grid grid-cols-2 gap-1">
                    <span>Certifications: <strong>40%</strong></span>
                    <span>Proximity: <strong>25%</strong></span>
                    <span>Experience: <strong>20%</strong></span>
                    <span>Freshness: <strong>10%</strong> + Travel: <strong>5%</strong></span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleAdvanceToCompose}
              disabled={!matchCount || matchCount.eligible === 0}
              className="btn-primary w-full disabled:opacity-50"
            >
              Continue to Compose ({matchCount?.eligible || 0} recipients)
            </button>
          </div>
        )}

        {/* === STEP 2: Compose === */}
        {step === 2 && (
          <div className="card space-y-6">
            <h2 className="text-lg font-bold text-foreground">Compose your message</h2>

            {/* Top candidates preview */}
            {rankedCandidates.length > 0 && (
              <div className="bg-surface rounded-lg p-4">
                <p className="text-xs font-semibold text-muted mb-3 uppercase">
                  Top Scored Candidates (preview)
                </p>
                <div className="space-y-2">
                  {rankedCandidates.slice(0, 5).map((c, i) => (
                    <div key={c.profileId} className="flex items-center gap-3 text-sm">
                      <span className="w-5 text-muted font-mono">#{i + 1}</span>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                        c.score >= 70 ? "bg-success/10 text-success" : c.score >= 40 ? "bg-accent/10 text-accent" : "bg-danger/10 text-danger"
                      }`}>
                        {c.score}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-foreground">{c.name}</span>
                        <span className="text-muted ml-2">{c.location || "Unknown"}</span>
                      </div>
                      <div className="flex gap-1">
                        {c.certifications.slice(0, 2).map((cert) => (
                          <span key={cert} className="badge bg-primary/10 text-primary text-xs">{cert}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Score breakdown for #1 candidate */}
                {rankedCandidates[0] && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted mb-2">Score breakdown for top candidate:</p>
                    <div className="flex gap-2 text-xs">
                      <span className="badge bg-surface-dark">Certs: {rankedCandidates[0].breakdown.certScore}/40</span>
                      <span className="badge bg-surface-dark">Proximity: {rankedCandidates[0].breakdown.proximityScore}/25</span>
                      <span className="badge bg-surface-dark">Exp: {rankedCandidates[0].breakdown.experienceScore}/20</span>
                      <span className="badge bg-surface-dark">Fresh: {rankedCandidates[0].breakdown.freshnessScore}/10</span>
                      <span className="badge bg-surface-dark">Travel: {rankedCandidates[0].breakdown.travelBonus}/5</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Campaign Name</label>
              <input
                className="input"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g. Katy Hyperscale - Electricians Q2 2026"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                SMS Message (160 chars recommended)
              </label>
              <textarea
                className="input min-h-[100px]"
                maxLength={320}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Hi {{name}}, we're hiring ${selectedCerts.size > 0 ? Array.from(selectedCerts)[0] : "certified"} techs for a new data center in ${location || "Houston"}. Competitive pay + per diem. Interested? Reply YES or apply at {{link}}`}
              />
              <div className="flex justify-between mt-1">
                <p className="text-xs text-muted">
                  Variables: {"{{name}}"}, {"{{link}}"}, {"{{company}}"}. Opt-out auto-appended.
                </p>
                <p className={`text-xs ${message.length > 160 ? "text-accent" : "text-muted"}`}>
                  {message.length}/320
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Drip Campaign (Optional)
              </label>
              <div className="space-y-2 text-sm text-muted">
                {[
                  { label: "Send follow-up after 3 days if no response", days: 3 },
                  { label: "Send project details after 7 days", days: 7 },
                  { label: "Final reach-out after 14 days", days: 14 },
                ].map((drip, i) => (
                  <label key={i} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={dripSteps > i}
                      onChange={(e) => setDripSteps(e.target.checked ? i + 1 : i)}
                    />
                    <span>{drip.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="btn-outline flex-1">Back</button>
              <button onClick={() => setStep(3)} className="btn-primary flex-1">Preview & Send</button>
            </div>
          </div>
        )}

        {/* === STEP 3: Review & Send === */}
        {step === 3 && (
          <div className="card space-y-6">
            <h2 className="text-lg font-bold text-foreground">Review & Send</h2>

            <div className="bg-surface rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Recipients (scored & eligible)</span>
                <span className="font-medium">{eligibleCount} candidates</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Required Certifications</span>
                <span className="font-medium">{selectedCerts.size > 0 ? Array.from(selectedCerts).join(", ") : "Any"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Target Area</span>
                <span className="font-medium">{location || "Any"} ({radius} mi)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Cost per ping</span>
                <span className="font-medium">${COST_PER_PING.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Drip messages</span>
                <span className="font-medium">{dripSteps > 0 ? `${dripSteps} follow-up(s)` : "None"}</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between">
                <span className="font-semibold text-foreground">Estimated Total</span>
                <span className="text-xl font-bold text-primary">
                  ${estimatedCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="bg-foreground rounded-lg p-4 text-white">
              <p className="text-xs text-gray-400 mb-2">SMS PREVIEW</p>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-sm">
                  {message
                    ? message
                        .replace(/\{\{name\}\}/g, "John")
                        .replace(/\{\{link\}\}/g, "dcjobs.co/abc123")
                        .replace(/\{\{company\}\}/g, "Your Company")
                    : "Hi John, we're hiring certified techs for a new data center. Interested? Reply YES."
                  }
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Reply STOP to opt out. DataCenterHires.com
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="btn-outline flex-1">Back</button>
              <button
                onClick={handleLaunchCampaign}
                disabled={launching}
                className="btn-accent flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {launching ? (
                  "Launching..."
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Launch Campaign
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* === STEP 4: Success === */}
        {step === 4 && campaignResult && (
          <div className="card space-y-6 text-center">
            <div className="bg-success/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Campaign Launched!</h2>
            <p className="text-muted">
              {campaignResult.recipients} SMS notifications queued for delivery.
            </p>

            <div className="bg-surface rounded-lg p-4 space-y-3 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Campaign ID</span>
                <span className="font-mono text-xs">{campaignResult.campaignId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Recipients</span>
                <span className="font-medium">{campaignResult.recipients}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Total Cost</span>
                <span className="font-medium text-primary">
                  ${campaignResult.estimatedTotalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {campaignResult.topCandidates.length > 0 && (
              <div className="text-left">
                <p className="text-sm font-semibold text-muted mb-2">Top recipients by score:</p>
                <div className="space-y-2">
                  {campaignResult.topCandidates.map((c, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <Star className="h-3.5 w-3.5 text-accent" />
                      <span className="font-medium">{c.name}</span>
                      <span className={`font-bold ${scoreColor(c.score)}`}>{c.score}</span>
                      <span className="text-muted">{c.location}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Link href="/employer" className="btn-primary inline-block">
              Back to Employer Hub
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
