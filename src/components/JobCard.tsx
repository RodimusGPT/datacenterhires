import Link from "next/link";
import { MapPin, Clock, DollarSign, Users, Star, Briefcase } from "lucide-react";
import { formatSalary, timeAgo } from "@/lib/utils";

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: string | null;
  jobType: string;
  category: string;
  certRequired: string | null;
  featured: boolean;
  crewSize: number | null;
  createdAt: Date;
};

const CATEGORY_COLORS: Record<string, string> = {
  electrical: "bg-yellow-100 text-yellow-800",
  mechanical: "bg-blue-100 text-blue-800",
  networking: "bg-purple-100 text-purple-800",
  security: "bg-red-100 text-red-800",
  project_management: "bg-green-100 text-green-800",
  commissioning: "bg-orange-100 text-orange-800",
  general: "bg-gray-100 text-gray-800",
};

const CATEGORY_LABELS: Record<string, string> = {
  electrical: "Electrical",
  mechanical: "Mechanical / HVAC",
  networking: "Networking / Cabling",
  security: "Physical Security",
  project_management: "Project Mgmt",
  commissioning: "Commissioning",
  general: "General",
};

export default function JobCard({ job }: { job: Job }) {
  const certs = job.certRequired?.split(",").filter(Boolean) || [];

  return (
    <Link href={`/jobs/${job.id}`} className="block">
      <div className={`card hover:shadow-md transition-shadow relative ${job.featured ? "ring-2 ring-accent" : ""}`}>
        {job.featured && (
          <div className="absolute -top-2 right-4 badge bg-accent text-foreground gap-1">
            <Star className="h-3 w-3" /> Featured
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-foreground truncate">{job.title}</h3>
            <p className="text-muted font-medium">{job.company}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold text-primary">
              {formatSalary(job.salaryMin, job.salaryMax, job.salaryPeriod)}
            </p>
            <p className="text-xs text-muted capitalize">
              {job.jobType.replace("_", " ")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-muted">
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> {job.location}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {timeAgo(new Date(job.createdAt))}
          </span>
          {job.crewSize && (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Crew: {job.crewSize}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          <span className={`badge ${CATEGORY_COLORS[job.category] || CATEGORY_COLORS.general}`}>
            {CATEGORY_LABELS[job.category] || job.category}
          </span>
          {certs.slice(0, 3).map((cert) => (
            <span key={cert} className="badge bg-surface-dark text-muted">
              {cert.trim()}
            </span>
          ))}
          {certs.length > 3 && (
            <span className="badge bg-surface-dark text-muted">+{certs.length - 3} more</span>
          )}
        </div>
      </div>
    </Link>
  );
}
