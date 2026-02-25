import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  Send, Users, MapPin, FileText, MessageSquare,
  DollarSign, TrendingUp, ArrowRight, CheckCircle2,
} from "lucide-react";

export default async function EmployerPage() {
  const session = await getSession();
  const isEmployer = session?.user.role === "employer";
  const profile = session?.user.employerProfile;

  let jobCount = 0;
  let campaignCount = 0;
  if (profile) {
    jobCount = await prisma.job.count({ where: { employerProfileId: profile.id } });
    campaignCount = await prisma.pingCampaign.count({ where: { employerProfileId: profile.id } });
  }

  return (
    <div className="bg-surface min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-foreground to-gray-800 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-3xl md:text-5xl font-bold text-white">
              Find Mission-Critical Talent{" "}
              <span className="text-accent">Before Your Competitors</span>
            </h1>
            <p className="mt-4 text-lg text-gray-300">
              Access 12,000+ verified data center professionals. Post jobs, search the
              certified database, and ping candidates directly via SMS with 98% read rates.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              {isEmployer ? (
                <>
                  <Link href="/employer/post-job" className="btn-accent flex items-center justify-center gap-2">
                    <FileText className="h-5 w-5" /> Post a Job
                  </Link>
                  <Link href="/employer/candidates" className="btn-outline border-white text-white hover:bg-white hover:text-foreground flex items-center justify-center gap-2">
                    <Users className="h-5 w-5" /> Search Candidates
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/auth/signup" className="btn-accent flex items-center justify-center gap-2">
                    Get Started Free <ArrowRight className="h-5 w-5" />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard (if employer) */}
      {isEmployer && profile && (
        <section className="py-8 border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-bold text-foreground mb-4">Your Dashboard</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card">
                <p className="text-2xl font-bold text-primary">{jobCount}</p>
                <p className="text-sm text-muted">Active Jobs</p>
              </div>
              <div className="card">
                <p className="text-2xl font-bold text-success">{campaignCount}</p>
                <p className="text-sm text-muted">Ping Campaigns</p>
              </div>
              <div className="card">
                <p className="text-2xl font-bold text-accent">12,000+</p>
                <p className="text-sm text-muted">Searchable Candidates</p>
              </div>
              <div className="card">
                <p className="text-2xl font-bold text-foreground">98%</p>
                <p className="text-sm text-muted">SMS Read Rate</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Pricing */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-foreground text-center mb-4">Employer Solutions</h2>
          <p className="text-muted text-center mb-12 max-w-2xl mx-auto">
            From single job posts to enterprise-grade workforce planning
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: "Job Posting",
                price: "$100 - $600",
                period: "per post",
                features: [
                  "Native listing on DataCenterHires",
                  "Featured placement option ($600)",
                  "Map-based project site visibility",
                  "30-day active listing",
                  "Direct applicant notifications",
                ],
                cta: "Post a Job",
                href: "/employer/post-job",
                highlight: false,
              },
              {
                name: "Resume Database",
                price: "$1,000+",
                period: "per month",
                features: [
                  "Search 12,000+ certified professionals",
                  "Filter by certification & trade",
                  "View full profiles & resumes",
                  "Unlimited candidate views",
                  "Save & organize candidates",
                ],
                cta: "Browse Candidates",
                href: "/employer/candidates",
                highlight: true,
              },
              {
                name: "Candidate Ping (SMS)",
                price: "$2.00 - $5.00",
                period: "per ping",
                features: [
                  "SMS-first delivery (98% read rate)",
                  "Request-to-Apply notifications",
                  "Automated drip campaigns (5-7 touches)",
                  "TCPA-compliant opt-in/out",
                  "Reach on-site contractors instantly",
                ],
                cta: "Start Pinging",
                href: "/employer/ping",
                highlight: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`card ${plan.highlight ? "ring-2 ring-primary relative" : ""}`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 badge bg-primary text-white px-3 py-1">
                    Most Popular
                  </span>
                )}
                <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-primary">{plan.price}</span>
                  <span className="text-muted ml-1">{plan.period}</span>
                </div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted">
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`mt-6 block text-center ${plan.highlight ? "btn-primary" : "btn-outline"}`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
