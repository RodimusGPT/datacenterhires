import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  rankCandidates,
  estimateMatchCount,
  type CandidateData,
  type PingTargetCriteria,
} from "@/lib/candidate-scorer";

/** Known city coordinates for Phase 1 & 2 markets */
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "houston":   { lat: 29.7604, lng: -95.3698 },
  "katy":      { lat: 29.7858, lng: -95.8245 },
  "atlanta":   { lat: 33.7490, lng: -84.3880 },
  "columbus":  { lat: 39.9612, lng: -82.9988 },
  "new albany":{ lat: 40.0812, lng: -82.8088 },
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

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.user.role !== "employer") {
    return NextResponse.json({ error: "Employer access required" }, { status: 403 });
  }

  const body = await req.json();
  const {
    requiredCerts = [],
    location = null,
    radiusMiles = 100,
    minExperience = 0,
    mode = "estimate", // "estimate" | "full"
    limit = 50,
  } = body;

  // Build targeting criteria
  const coords = lookupCoords(location);
  const criteria: PingTargetCriteria = {
    requiredCerts,
    location,
    latitude: coords.lat,
    longitude: coords.lng,
    radiusMiles,
    minExperience,
  };

  // Fetch all candidates with their certifications
  const profiles = await prisma.jobSeekerProfile.findMany({
    include: {
      user: { select: { name: true, email: true, phone: true } },
      certifications: { select: { name: true } },
    },
  });

  // Transform to CandidateData format
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

  // Estimate mode — quick count for the UI preview
  if (mode === "estimate") {
    const counts = estimateMatchCount(candidates, criteria);
    return NextResponse.json(counts);
  }

  // Full mode — ranked list with scores
  const ranked = rankCandidates(candidates, criteria);
  const eligible = ranked.filter((s) => s.eligible).slice(0, limit);

  return NextResponse.json({
    total: ranked.length,
    eligible: ranked.filter((s) => s.eligible).length,
    candidates: eligible.map((s) => ({
      profileId: s.candidate.profileId,
      name: s.candidate.name,
      location: s.candidate.location,
      yearsExperience: s.candidate.yearsExperience,
      certifications: s.candidate.certifications,
      willingToTravel: s.candidate.willingToTravel,
      score: s.score,
      breakdown: s.breakdown,
    })),
  });
}
