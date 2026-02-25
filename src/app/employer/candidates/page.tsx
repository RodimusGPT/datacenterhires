import { prisma } from "@/lib/db";
import { Search, Shield, MapPin, Filter } from "lucide-react";
import { CERTIFICATIONS, JOB_CATEGORIES } from "@/lib/utils";

export default async function CandidatesPage() {
  const candidates = await prisma.jobSeekerProfile.findMany({
    include: {
      user: { select: { name: true } },
      certifications: true,
      skills: true,
    },
    take: 20,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="bg-surface min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">Candidate Database</h1>
        <p className="text-muted mb-8">Search 12,000+ certified data center professionals</p>

        {/* Filters */}
        <div className="card mb-8">
          <form className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
              <input
                placeholder="Search by name, skill, or location..."
                className="input pl-10"
              />
            </div>
            <select className="input md:w-48">
              <option value="">All Certifications</option>
              {CERTIFICATIONS.map((cert) => (
                <option key={cert} value={cert}>{cert}</option>
              ))}
            </select>
            <select className="input md:w-40">
              <option value="">Any Experience</option>
              <option value="1">1+ years</option>
              <option value="5">5+ years</option>
              <option value="10">10+ years</option>
            </select>
            <button type="submit" className="btn-primary flex items-center justify-center gap-2">
              <Filter className="h-4 w-4" /> Search
            </button>
          </form>
        </div>

        {candidates.length === 0 ? (
          <div className="card text-center py-16">
            <Shield className="h-12 w-12 text-muted mx-auto mb-3" />
            <p className="text-lg font-medium text-foreground">No candidates yet</p>
            <p className="text-muted mt-1">
              Candidates will appear here as job seekers create profiles and upload certifications.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {candidates.map((candidate) => (
              <div key={candidate.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-lg font-bold text-primary">
                        {candidate.user.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{candidate.user.name}</h3>
                      {candidate.headline && (
                        <p className="text-sm text-muted">{candidate.headline}</p>
                      )}
                    </div>
                  </div>
                  <button className="btn-accent text-sm py-1.5 px-3">
                    Ping
                  </button>
                </div>

                <div className="flex items-center gap-4 mt-3 text-sm text-muted">
                  {candidate.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {candidate.location}
                    </span>
                  )}
                  <span>{candidate.yearsExperience} years exp</span>
                  {candidate.willingToTravel && (
                    <span className="badge bg-success/10 text-success">Will Travel</span>
                  )}
                </div>

                {candidate.certifications.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {candidate.certifications.map((cert) => (
                      <span key={cert.id} className="badge bg-primary/10 text-primary text-xs">
                        {cert.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
