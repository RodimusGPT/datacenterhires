import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * POST /api/applications/[id]/review
 *
 * Allows a job seeker to approve or edit an AI-generated application draft
 * before it's actually submitted to the employer's ATS. This is the "bot
 * mitigation" guardrail — no application goes out without human review.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const application = await prisma.application.findUnique({
    where: { id },
    include: { job: true },
  });

  if (!application || application.userId !== session.user.id) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  if (application.status !== "pending") {
    return NextResponse.json({ error: "Application already processed" }, { status: 400 });
  }

  const body = await req.json();
  const { action, editedCoverLetter, editedFields } = body;

  if (action === "approve") {
    // Mark as submitted — in production, this triggers the ATS submission pipeline
    const updated = await prisma.application.update({
      where: { id },
      data: {
        status: "submitted",
        submittedAt: new Date(),
        coverLetter: editedCoverLetter || application.coverLetter,
        aiDraft: editedFields ? JSON.stringify(editedFields) : application.aiDraft,
      },
    });

    return NextResponse.json({
      status: "submitted",
      message: `Application for "${application.job.title}" at ${application.job.company} has been submitted.`,
      submittedAt: updated.submittedAt,
    });
  }

  if (action === "edit") {
    // Save edits without submitting
    await prisma.application.update({
      where: { id },
      data: {
        coverLetter: editedCoverLetter || application.coverLetter,
        aiDraft: editedFields ? JSON.stringify(editedFields) : application.aiDraft,
      },
    });

    return NextResponse.json({
      status: "edited",
      message: "Draft saved. Review and approve when ready.",
    });
  }

  if (action === "reject") {
    // User decided not to apply to this job
    await prisma.application.delete({ where: { id } });

    // Refund the daily apply count
    const profile = session.user.jobSeekerProfile;
    if (profile && profile.dailyApplies > 0) {
      await prisma.jobSeekerProfile.update({
        where: { id: profile.id },
        data: { dailyApplies: { decrement: 1 } },
      });
    }

    return NextResponse.json({
      status: "rejected",
      message: "Application draft discarded. Daily apply count refunded.",
    });
  }

  return NextResponse.json({ error: "Invalid action. Use: approve, edit, or reject" }, { status: 400 });
}
