import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Shield, Upload, Plus, CheckCircle2, AlertCircle } from "lucide-react";
import { CERTIFICATIONS } from "@/lib/utils";

export default async function ProfilePage() {
  const session = await requireAuth();
  const user = session.user;
  const profile = user.jobSeekerProfile;

  const certifications = profile
    ? await prisma.certification.findMany({
        where: { jobSeekerProfileId: profile.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="bg-surface min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">Mission-Critical ID</h1>
        <p className="text-muted mb-8">Your verified profile and certification vault</p>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="md:col-span-1">
            <div className="card text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-primary">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <h2 className="font-semibold text-foreground text-lg">{user.name}</h2>
              <p className="text-sm text-muted">{user.email}</p>
              {profile?.headline && (
                <p className="text-sm text-muted mt-1">{profile.headline}</p>
              )}
              <div className="border-t border-border mt-4 pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Location</span>
                  <span className="font-medium">{profile?.location || "Not set"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Experience</span>
                  <span className="font-medium">{profile?.yearsExperience || 0} years</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Travel</span>
                  <span className="font-medium">{profile?.willingToTravel ? "Yes" : "No"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">SMS Opt-in</span>
                  <span className="font-medium">{profile?.smsOptIn ? "Yes" : "No"}</span>
                </div>
              </div>
            </div>

            {/* Resume */}
            <div className="card mt-4">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" /> Source-of-Truth Resume
              </h3>
              {profile?.resumeUrl ? (
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" /> Resume uploaded
                </div>
              ) : (
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 text-muted mx-auto mb-2" />
                  <p className="text-sm text-muted">
                    Upload your resume (PDF, DOC)
                  </p>
                  <p className="text-xs text-muted mt-1">
                    Used for AI-powered auto-apply
                  </p>
                  <button className="btn-primary text-sm py-2 px-4 mt-3">
                    Upload Resume
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Certifications */}
          <div className="md:col-span-2">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Shield className="h-5 w-5 text-success" /> Certification Vault
                </h2>
                <button className="btn-primary text-sm py-2 px-4 flex items-center gap-1">
                  <Plus className="h-4 w-4" /> Add Certification
                </button>
              </div>

              {certifications.length > 0 ? (
                <div className="space-y-3">
                  {certifications.map((cert) => (
                    <div key={cert.id} className="flex items-center justify-between p-3 bg-surface rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${cert.verified ? "bg-success" : "bg-accent"}`} />
                        <div>
                          <p className="font-medium text-foreground">{cert.name}</p>
                          {cert.issuer && <p className="text-xs text-muted">{cert.issuer}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {cert.verified ? (
                          <span className="badge bg-success/10 text-success">Verified</span>
                        ) : (
                          <span className="badge bg-accent/10 text-accent">Pending</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-muted mx-auto mb-3" />
                  <p className="text-muted font-medium">No certifications yet</p>
                  <p className="text-sm text-muted mt-1">
                    Add your OSHA, NFPA, CompTIA, and other certifications to stand out.
                  </p>
                </div>
              )}

              <div className="border-t border-border mt-6 pt-4">
                <h3 className="text-sm font-semibold text-muted mb-3">COMMON DATA CENTER CERTIFICATIONS</h3>
                <div className="flex flex-wrap gap-2">
                  {CERTIFICATIONS.map((cert) => (
                    <button
                      key={cert}
                      className="badge bg-surface-dark text-muted hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                    >
                      + {cert}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
