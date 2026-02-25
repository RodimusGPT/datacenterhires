import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import {
  FileText, Upload, Send, Shield, Briefcase, Clock,
  CheckCircle2, ArrowRight, Zap,
} from "lucide-react";
import { TIER_LIMITS } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await requireAuth();
  const user = session.user;
  const profile = user.jobSeekerProfile;

  const applicationCount = await prisma.application.count({
    where: { userId: user.id },
  });

  const certCount = profile
    ? await prisma.certification.count({ where: { jobSeekerProfileId: profile.id } })
    : 0;

  const tier = (profile?.tier || "free") as keyof typeof TIER_LIMITS;
  const tierInfo = TIER_LIMITS[tier];
  const dailyUsed = profile?.dailyApplies || 0;

  return (
    <div className="bg-surface min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Welcome, {user.name}</h1>
            <p className="text-muted">Your Mission-Critical Dashboard</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge bg-primary/10 text-primary">{tierInfo.label}</span>
            <span className="text-sm text-muted">
              {dailyUsed}/{tierInfo.dailyApplies} applies today
            </span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Briefcase, label: "Applications", value: applicationCount, color: "text-primary" },
            { icon: Shield, label: "Certifications", value: certCount, color: "text-success" },
            { icon: Send, label: "Daily Applies Left", value: tierInfo.dailyApplies - dailyUsed, color: "text-accent" },
            { icon: Clock, label: "Profile Status", value: profile ? "Active" : "Incomplete", color: "text-muted" },
          ].map((stat) => (
            <div key={stat.label} className="card flex items-center gap-3">
              <stat.icon className={`h-8 w-8 ${stat.color}`} />
              <div>
                <p className="text-xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Link href="/dashboard/submit-all" className="card hover:shadow-md transition-shadow group">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-primary/10 rounded-lg p-2">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Submit All (AI Apply)</h3>
            </div>
            <p className="text-sm text-muted">
              Apply to multiple jobs with one click. AI fills forms and writes screening answers.
            </p>
            <span className="text-primary text-sm font-medium mt-2 flex items-center gap-1 group-hover:underline">
              Start Applying <ArrowRight className="h-3 w-3" />
            </span>
          </Link>

          <Link href="/dashboard/profile" className="card hover:shadow-md transition-shadow group">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-success/10 rounded-lg p-2">
                <Shield className="h-6 w-6 text-success" />
              </div>
              <h3 className="font-semibold text-foreground">Certification Vault</h3>
            </div>
            <p className="text-sm text-muted">
              Upload and manage your OSHA, NFPA 70E, CompTIA, and other certifications.
            </p>
            <span className="text-success text-sm font-medium mt-2 flex items-center gap-1 group-hover:underline">
              Manage Certs <ArrowRight className="h-3 w-3" />
            </span>
          </Link>

          <Link href="/dashboard/applications" className="card hover:shadow-md transition-shadow group">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-accent/10 rounded-lg p-2">
                <FileText className="h-6 w-6 text-accent" />
              </div>
              <h3 className="font-semibold text-foreground">My Applications</h3>
            </div>
            <p className="text-sm text-muted">
              Track the status of all your applications and view AI-generated drafts.
            </p>
            <span className="text-accent text-sm font-medium mt-2 flex items-center gap-1 group-hover:underline">
              View All <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        </div>

        {/* Profile Completion Banner */}
        {(!profile || certCount === 0) && (
          <div className="card bg-primary/5 border-primary/20">
            <div className="flex items-start gap-4">
              <Upload className="h-8 w-8 text-primary shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground">Complete Your Mission-Critical ID</h3>
                <p className="text-sm text-muted mt-1">
                  Upload your certifications and resume to unlock AI-powered bulk applications.
                  Employers actively search our verified database.
                </p>
                <div className="flex gap-3 mt-3">
                  <Link href="/dashboard/profile" className="btn-primary text-sm py-2 px-4">
                    Complete Profile
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
