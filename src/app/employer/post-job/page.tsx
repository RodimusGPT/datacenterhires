"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, DollarSign, MapPin } from "lucide-react";
import { JOB_CATEGORIES, CERTIFICATIONS } from "@/lib/utils";

export default function PostJobPage() {
  const [tier, setTier] = useState("basic");

  const tiers = [
    { id: "basic", name: "Basic Listing", price: "$100", desc: "Standard visibility for 30 days" },
    { id: "enhanced", name: "Enhanced Listing", price: "$300", desc: "Priority placement + badge" },
    { id: "featured", name: "Featured Listing", price: "$600", desc: "Top of results + map highlight + email blast" },
  ];

  return (
    <div className="bg-surface min-h-screen py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/employer" className="inline-flex items-center gap-1 text-muted hover:text-foreground mb-4 text-sm">
          <ArrowLeft className="h-4 w-4" /> Back to Employer Hub
        </Link>
        <h1 className="text-2xl font-bold text-foreground mb-2">Post a Data Center Job</h1>
        <p className="text-muted mb-8">Reach 12,000+ certified mission-critical professionals</p>

        {/* Tier Selection */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {tiers.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTier(t.id)}
              className={`card text-center transition-all ${
                tier === t.id ? "ring-2 ring-primary" : "hover:shadow-sm"
              }`}
            >
              <p className="font-semibold text-foreground">{t.name}</p>
              <p className="text-xl font-bold text-primary mt-1">{t.price}</p>
              <p className="text-xs text-muted mt-1">{t.desc}</p>
            </button>
          ))}
        </div>

        <form className="card space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Job Title</label>
            <input className="input" placeholder="e.g. Senior Electrical Foreman - Data Center" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Category / Trade</label>
              <select className="input">
                {JOB_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Job Type</label>
              <select className="input">
                <option value="full_time">Full Time</option>
                <option value="contract">Contract</option>
                <option value="temp">Temporary</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <input className="input pl-10" placeholder="e.g. Katy, TX (Energy Corridor)" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Salary Min</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input type="number" className="input pl-10" placeholder="45" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Salary Max</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input type="number" className="input pl-10" placeholder="65" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Period</label>
              <select className="input">
                <option value="hourly">Per Hour</option>
                <option value="annual">Annual</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Job Description</label>
            <textarea className="input min-h-[150px]" placeholder="Describe the role, responsibilities, and work environment..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Requirements</label>
            <textarea className="input min-h-[80px]" placeholder="Comma-separated: e.g. OSHA 30, NFPA 70E, 5+ years experience" />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Required Certifications</label>
            <div className="flex flex-wrap gap-2">
              {CERTIFICATIONS.map((cert) => (
                <label key={cert} className="badge bg-surface-dark text-muted cursor-pointer hover:bg-primary/10 hover:text-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary transition-colors">
                  <input type="checkbox" className="sr-only" name="certs" value={cert} />
                  {cert}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Crew Size (Optional)</label>
              <input type="number" className="input" placeholder="e.g. 45" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Project Start Date</label>
              <input type="date" className="input" />
            </div>
          </div>

          <button type="submit" className="btn-primary w-full text-lg">
            Post Job — {tiers.find((t) => t.id === tier)?.price}
          </button>
        </form>
      </div>
    </div>
  );
}
