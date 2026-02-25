import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { TIER_LIMITS } from "@/lib/utils";
import { generateApplicationDraft, type CandidateProfile } from "@/lib/ats-mapper";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobIds } = await req.json();
  if (!Array.isArray(jobIds) || jobIds.length === 0) {
    return NextResponse.json({ error: "No jobs selected" }, { status: 400 });
  }

  const profile = session.user.jobSeekerProfile;
  if (!profile) {
    return NextResponse.json({ error: "Job seeker profile required" }, { status: 400 });
  }

  // Check daily limit
  const tier = profile.tier as keyof typeof TIER_LIMITS;
  const limit = TIER_LIMITS[tier]?.dailyApplies ?? 5;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (new Date(profile.lastApplyReset) < today) {
    await prisma.jobSeekerProfile.update({
      where: { id: profile.id },
      data: { dailyApplies: 0, lastApplyReset: today },
    });
  }

  const remaining = limit - profile.dailyApplies;
  const toApply = jobIds.slice(0, remaining);

  if (toApply.length === 0) {
    return NextResponse.json(
      { error: `Daily limit reached (${limit}/day on ${tier} tier). Upgrade for more.` },
      { status: 429 }
    );
  }

  // Fetch candidate certifications and skills for the ATS mapper
  const certs = await prisma.certification.findMany({
    where: { jobSeekerProfileId: profile.id },
    select: { name: true },
  });
  const skills = await prisma.skill.findMany({
    where: { jobSeekerProfileId: profile.id },
    select: { name: true },
  });

  const candidateProfile: CandidateProfile = {
    name: session.user.name,
    email: session.user.email,
    phone: session.user.phone,
    location: profile.location,
    resumeText: profile.resumeText,
    yearsExperience: profile.yearsExperience,
    certifications: certs.map((c) => c.name),
    skills: skills.map((s) => s.name),
    willingToTravel: profile.willingToTravel,
    headline: profile.headline,
    summary: profile.summary,
  };

  // Fetch all target jobs in one query
  const jobs = await prisma.job.findMany({
    where: { id: { in: toApply }, status: "active" },
  });

  const batchId = `batch_${Date.now()}`;
  const results = [];
  const drafts = [];

  for (const job of jobs) {
    // Generate AI application draft via the hybrid ATS mapper
    const draft = generateApplicationDraft(candidateProfile, {
      id: job.id,
      title: job.title,
      company: job.company,
      description: job.description,
      requirements: job.requirements,
      certRequired: job.certRequired,
      atsType: job.atsType,
      category: job.category,
    });

    try {
      const app = await prisma.application.create({
        data: {
          userId: session.user.id,
          jobId: job.id,
          status: "pending",
          batchId,
          coverLetter: draft.coverLetter,
          aiDraft: JSON.stringify({
            matchScore: draft.matchScore,
            fields: draft.fields,
            warnings: draft.warnings,
            atsType: draft.atsType,
            generatedAt: draft.generatedAt,
          }),
        },
      });
      results.push({ jobId: job.id, status: "created", id: app.id });
      drafts.push({
        applicationId: app.id,
        jobTitle: draft.jobTitle,
        company: draft.company,
        matchScore: draft.matchScore,
        warningCount: draft.warnings.length,
        atsType: draft.atsType,
      });
    } catch {
      results.push({ jobId: job.id, status: "duplicate" });
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  await prisma.jobSeekerProfile.update({
    where: { id: profile.id },
    data: { dailyApplies: { increment: created } },
  });

  return NextResponse.json({
    batchId,
    applied: created,
    duplicates: results.filter((r) => r.status === "duplicate").length,
    remaining: remaining - created,
    drafts,
  });
}
