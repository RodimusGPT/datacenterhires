import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { rankCandidates, type CandidateData, type PingTargetCriteria } from "@/lib/candidate-scorer";

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "houston":   { lat: 29.7604, lng: -95.3698 },
  "katy":      { lat: 29.7858, lng: -95.8245 },
  "atlanta":   { lat: 33.7490, lng: -84.3880 },
  "columbus":  { lat: 39.9612, lng: -82.9988 },
  "chicago":   { lat: 41.8781, lng: -87.6298 },
};

function lookupCoords(location: string | null): { lat: number | null; lng: number | null } {
  if (!location) return { lat: null, lng: null };
  const lower = location.toLowerCase();
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (lower.includes(city)) return { lat: coords.lat, lng: coords.lng };
  }
  return { lat: null, lng: null };
}

const COST_PER_PING = 3.0;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.user.role !== "employer") {
    return NextResponse.json({ error: "Employer access required" }, { status: 403 });
  }

  const employerProfile = session.user.employerProfile;
  if (!employerProfile) {
    return NextResponse.json({ error: "Employer profile required" }, { status: 400 });
  }

  const body = await req.json();
  const {
    campaignName,
    message,
    requiredCerts = [],
    location = null,
    radiusMiles = 100,
    minExperience = 0,
    dripSteps = 0,
  } = body;

  if (!campaignName || !message) {
    return NextResponse.json({ error: "Campaign name and message are required" }, { status: 400 });
  }

  // Score and rank candidates
  const coords = lookupCoords(location);
  const criteria: PingTargetCriteria = {
    requiredCerts,
    location,
    latitude: coords.lat,
    longitude: coords.lng,
    radiusMiles,
    minExperience,
  };

  const profiles = await prisma.jobSeekerProfile.findMany({
    include: {
      user: { select: { name: true, email: true, phone: true } },
      certifications: { select: { name: true } },
    },
  });

  const candidates: CandidateData[] = profiles.map((p) => {
    const profileCoords = lookupCoords(p.location);
    return {
      profileId: p.id,
      userId: p.userId,
      name: p.user.name,
      phone: p.user.phone,
      email: p.user.email,
      location: p.location,
      latitude: profileCoords.lat,
      longitude: profileCoords.lng,
      yearsExperience: p.yearsExperience,
      willingToTravel: p.willingToTravel,
      smsOptIn: p.smsOptIn,
      certifications: p.certifications.map((c) => c.name),
      lastActive: p.updatedAt,
    };
  });

  const ranked = rankCandidates(candidates, criteria);
  const eligible = ranked.filter((s) => s.eligible);

  // Create campaign
  const campaign = await prisma.pingCampaign.create({
    data: {
      employerProfileId: employerProfile.id,
      name: campaignName,
      message,
      targetCerts: requiredCerts.join(","),
      targetLocation: location,
      targetRadius: radiusMiles,
      status: "active",
      totalPings: eligible.length,
    },
  });

  // Create notifications for each eligible candidate
  const notifications = [];
  for (const scored of eligible) {
    const candidate = scored.candidate;
    // Personalize message
    const personalizedMsg = message
      .replace(/\{\{name\}\}/g, candidate.name.split(" ")[0])
      .replace(/\{\{link\}\}/g, `dcjobs.co/${campaign.id.slice(0, 8)}`);

    notifications.push({
      campaignId: campaign.id,
      recipientPhone: candidate.phone || "",
      recipientName: candidate.name,
      message: personalizedMsg,
      status: "queued" as const,
    });
  }

  if (notifications.length > 0) {
    await prisma.pingNotification.createMany({ data: notifications });
  }

  const totalCost = eligible.length * COST_PER_PING * (1 + dripSteps);

  return NextResponse.json({
    campaignId: campaign.id,
    recipients: eligible.length,
    costPerPing: COST_PER_PING,
    dripSteps,
    estimatedTotalCost: totalCost,
    topCandidates: eligible.slice(0, 5).map((s) => ({
      name: s.candidate.name,
      score: s.score,
      certifications: s.candidate.certifications,
      location: s.candidate.location,
    })),
  });
}
