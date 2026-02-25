import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  MapPin, Clock, DollarSign, Users, Briefcase, Shield,
  ArrowLeft, ExternalLink, CheckCircle2,
} from "lucide-react";
import { formatSalary, timeAgo } from "@/lib/utils";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });

  if (!job) notFound();

  const certs = job.certRequired?.split(",").filter(Boolean) || [];
  const requirements = job.requirements?.split(",").map((r) => r.trim()) || [];

  return (
    <div className="bg-surface min-h-screen">
      <div className="bg-primary py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/jobs" className="inline-flex items-center gap-1 text-blue-200 hover:text-white mb-4 text-sm">
            <ArrowLeft className="h-4 w-4" /> Back to Jobs
          </Link>
          <h1 className="text-3xl font-bold text-white">{job.title}</h1>
          <p className="text-blue-100 text-lg mt-1">{job.company}</p>
          <div className="flex flex-wrap items-center gap-4 mt-4 text-blue-200 text-sm">
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" /> {job.location}
            </span>
            <span className="flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              {formatSalary(job.salaryMin, job.salaryMax, job.salaryPeriod)}
            </span>
            <span className="flex items-center gap-1">
              <Briefcase className="h-4 w-4" /> {job.jobType.replace("_", " ")}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" /> Posted {timeAgo(new Date(job.createdAt))}
            </span>
            {job.crewSize && (
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" /> Crew Size: {job.crewSize}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="card">
              <h2 className="text-xl font-bold text-foreground mb-4">About This Role</h2>
              <p className="text-muted leading-relaxed whitespace-pre-line">{job.description}</p>
            </div>

            {requirements.length > 0 && (
              <div className="card">
                <h2 className="text-xl font-bold text-foreground mb-4">Requirements</h2>
                <ul className="space-y-2">
                  {requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-2 text-muted">
                      <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="card">
              <Link href="/auth/signup" className="btn-primary w-full block text-center mb-3">
                Apply Now
              </Link>
              <Link
                href="/dashboard/submit-all"
                className="btn-outline w-full block text-center text-sm"
              >
                Add to Submit All Batch
              </Link>
            </div>

            {certs.length > 0 && (
              <div className="card">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" /> Required Certifications
                </h3>
                <div className="flex flex-wrap gap-2">
                  {certs.map((cert) => (
                    <span key={cert} className="badge bg-primary/10 text-primary">
                      {cert.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="card">
              <h3 className="font-semibold text-foreground mb-3">Job Details</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Type</dt>
                  <dd className="font-medium capitalize">{job.jobType.replace("_", " ")}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Category</dt>
                  <dd className="font-medium capitalize">{job.category.replace("_", " ")}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Location Type</dt>
                  <dd className="font-medium capitalize">{job.locationType.replace("_", " ")}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Source</dt>
                  <dd className="font-medium capitalize">{job.source}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
