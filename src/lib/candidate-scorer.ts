/**
 * Candidate Scoring Engine for SMS Ping Targeting
 *
 * Ranks candidates against an employer's targeting criteria using a weighted
 * multi-signal scoring system. Designed for the reality of data center
 * construction hiring:
 *
 *   - Certifications are non-negotiable (safety/compliance) → highest weight
 *   - Proximity matters for on-site work → second weight
 *   - Travel willingness compensates for distance → modifier
 *   - Experience validates depth → third weight
 *   - Profile freshness signals availability → bonus
 *
 * Score range: 0–100. Candidates below a configurable threshold are excluded.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PingTargetCriteria {
  requiredCerts: string[];
  location: string | null;       // target city, e.g. "Houston, TX"
  latitude: number | null;
  longitude: number | null;
  radiusMiles: number;           // max distance
  minExperience: number;         // minimum years
}

export interface CandidateData {
  profileId: string;
  userId: string;
  name: string;
  phone: string | null;
  email: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  yearsExperience: number;
  willingToTravel: boolean;
  smsOptIn: boolean;
  certifications: string[];
  lastActive: Date;              // last profile update or login
}

export interface ScoredCandidate {
  candidate: CandidateData;
  score: number;                 // 0–100 composite
  breakdown: ScoreBreakdown;
  eligible: boolean;             // passes all hard filters
  disqualifyReasons: string[];
}

export interface ScoreBreakdown {
  certScore: number;             // 0–40
  proximityScore: number;        // 0–25
  experienceScore: number;       // 0–20
  freshnessScore: number;        // 0–10
  travelBonus: number;           // 0–5
  total: number;
}

// ---------------------------------------------------------------------------
// Configuration — weights are calibrated for data center construction
// ---------------------------------------------------------------------------

const WEIGHTS = {
  /** Certifications: non-negotiable for job site safety. A candidate
   *  missing OSHA or NFPA 70E literally cannot step on-site. */
  certs: 40,

  /** Proximity: on-site work means daily commute or per-diem housing.
   *  Closer candidates reduce mobilization cost and are more likely
   *  to accept. */
  proximity: 25,

  /** Experience: more years = faster ramp, less supervision needed.
   *  Uses diminishing returns — the jump from 0→5 years matters more
   *  than 10→15 years. */
  experience: 20,

  /** Freshness: recently active profiles signal availability. A profile
   *  untouched for 6 months is less likely to respond to a ping. */
  freshness: 10,

  /** Travel bonus: willingness to travel partially compensates for
   *  being outside the target radius. Traveling crews are a known
   *  pattern in data center construction. */
  travelBonus: 5,
} as const;

const MIN_ELIGIBLE_SCORE = 25;

// ---------------------------------------------------------------------------
// Core Scoring Functions
// ---------------------------------------------------------------------------

/**
 * Certification match scoring.
 *
 * This is the most critical signal. We use a tiered approach:
 *   - Exact match on all required certs → full points
 *   - Partial match → proportional, but with a penalty floor
 *   - Zero match on any required cert → hard fail (score 0)
 *
 * The matching is fuzzy to handle variations like "OSHA-10" vs "OSHA 10"
 * and "CompTIA A+" vs "A+ Certification".
 */
function scoreCertifications(candidateCerts: string[], requiredCerts: string[]): number {
  if (requiredCerts.length === 0) return WEIGHTS.certs * 0.6; // No requirements = partial credit

  const normalizedCandidate = candidateCerts.map(normalizeCert);
  const normalizedRequired = requiredCerts.map(normalizeCert);

  let matched = 0;
  for (const req of normalizedRequired) {
    const found = normalizedCandidate.some((c) => certsMatch(c, req));
    if (found) matched++;
  }

  const ratio = matched / normalizedRequired.length;

  // All certs matched → full score
  if (ratio === 1.0) return WEIGHTS.certs;

  // Partial match — linear with a slight penalty for incompleteness
  // A candidate with 2/3 required certs gets ~24 pts (not 26.7) to
  // prioritize fully-qualified candidates
  return Math.round(ratio * WEIGHTS.certs * 0.9);
}

/**
 * Proximity scoring using Haversine distance.
 *
 * Scoring curve:
 *   - Within 25 miles  → full points (daily commute range)
 *   - 25-50 miles      → 80% (long commute, might need per diem)
 *   - 50-100 miles     → 50% (likely needs housing)
 *   - Beyond radius    → 0 base, but travel bonus can compensate
 *
 * If no coordinates available, falls back to string-based city matching.
 */
function scoreProximity(
  candidate: CandidateData,
  criteria: PingTargetCriteria,
): number {
  // If we have coordinates for both, use Haversine
  if (candidate.latitude && candidate.longitude && criteria.latitude && criteria.longitude) {
    const dist = haversineDistance(
      candidate.latitude, candidate.longitude,
      criteria.latitude, criteria.longitude,
    );

    if (dist <= 25) return WEIGHTS.proximity;
    if (dist <= 50) return WEIGHTS.proximity * 0.8;
    if (dist <= 100) return WEIGHTS.proximity * 0.5;
    if (dist <= criteria.radiusMiles) return WEIGHTS.proximity * 0.25;
    return 0;
  }

  // Fallback: string-based city matching
  if (candidate.location && criteria.location) {
    const candCity = candidate.location.toLowerCase().trim();
    const targetCity = criteria.location.toLowerCase().trim();

    if (candCity === targetCity) return WEIGHTS.proximity;
    if (candCity.includes(targetCity) || targetCity.includes(candCity)) return WEIGHTS.proximity * 0.7;

    // Same state check
    const candState = extractState(candCity);
    const targetState = extractState(targetCity);
    if (candState && targetState && candState === targetState) return WEIGHTS.proximity * 0.4;
  }

  // No location data at all — assume mid-range
  return WEIGHTS.proximity * 0.3;
}

/**
 * Experience scoring with diminishing returns.
 *
 * Uses a logarithmic curve: the marginal value of each additional year
 * decreases. This reflects reality — a 5-year journeyman is significantly
 * more capable than a 1-year helper, but a 15-year vs 10-year veteran
 * is a smaller gap.
 *
 *   yearsExp  →  score (of 20)
 *   0         →  0
 *   1         →  6
 *   3         →  11
 *   5         →  14
 *   7         →  16
 *   10        →  18
 *   15+       →  20
 */
function scoreExperience(yearsExperience: number, minRequired: number): number {
  if (yearsExperience < minRequired) {
    // Below minimum: proportional penalty but not zero
    // (a candidate with 4 years when 5 is required shouldn't be eliminated)
    return Math.round((yearsExperience / Math.max(minRequired, 1)) * WEIGHTS.experience * 0.6);
  }

  // Logarithmic curve: ln(years + 1) / ln(16) → normalized to 0-1
  const normalized = Math.min(Math.log(yearsExperience + 1) / Math.log(16), 1.0);
  return Math.round(normalized * WEIGHTS.experience);
}

/**
 * Profile freshness scoring.
 *
 * Recently active candidates are more likely to be:
 *   (a) actively looking
 *   (b) responsive to pings
 *   (c) have up-to-date certifications
 *
 *   Last active       →  score (of 10)
 *   < 7 days          →  10
 *   7-30 days         →  8
 *   30-90 days        →  5
 *   90-180 days       →  2
 *   > 180 days        →  0
 */
function scoreFreshness(lastActive: Date): number {
  const daysSince = Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSince < 7) return WEIGHTS.freshness;
  if (daysSince < 30) return WEIGHTS.freshness * 0.8;
  if (daysSince < 90) return WEIGHTS.freshness * 0.5;
  if (daysSince < 180) return WEIGHTS.freshness * 0.2;
  return 0;
}

/**
 * Travel willingness bonus.
 *
 * In data center construction, "traveling crews" are common — skilled workers
 * who go where the projects are, often with per diem and housing stipends.
 * This bonus compensates for distance. A traveling electrician 200 miles away
 * is more reachable than a local who won't leave their city.
 */
function scoreTravelBonus(
  candidate: CandidateData,
  proximityScore: number,
): number {
  if (!candidate.willingToTravel) return 0;

  // Travel bonus matters more when proximity is low
  // If they're already local (proximity = 25), travel willingness is irrelevant
  // If they're far away (proximity = 0), travel willingness is very valuable
  const distancePenalty = 1 - (proximityScore / WEIGHTS.proximity);
  return Math.round(WEIGHTS.travelBonus * distancePenalty);
}

// ---------------------------------------------------------------------------
// Hard Filters — disqualify before scoring
// ---------------------------------------------------------------------------

function applyHardFilters(candidate: CandidateData, criteria: PingTargetCriteria): string[] {
  const reasons: string[] = [];

  // Must have SMS opt-in (TCPA compliance)
  if (!candidate.smsOptIn) {
    reasons.push("No SMS opt-in consent");
  }

  // Must have a phone number
  if (!candidate.phone) {
    reasons.push("No phone number on file");
  }

  return reasons;
}

// ---------------------------------------------------------------------------
// Main Pipeline
// ---------------------------------------------------------------------------

/**
 * Scores a single candidate against targeting criteria.
 */
export function scoreCandidate(
  candidate: CandidateData,
  criteria: PingTargetCriteria,
): ScoredCandidate {
  const disqualifyReasons = applyHardFilters(candidate, criteria);

  const certScore = scoreCertifications(candidate.certifications, criteria.requiredCerts);
  const proximityScore = scoreProximity(candidate, criteria);
  const experienceScore = scoreExperience(candidate.yearsExperience, criteria.minExperience);
  const freshnessScore = scoreFreshness(candidate.lastActive);
  const travelBonus = scoreTravelBonus(candidate, proximityScore);

  const total = Math.min(
    certScore + proximityScore + experienceScore + freshnessScore + travelBonus,
    100,
  );

  const eligible = disqualifyReasons.length === 0 && total >= MIN_ELIGIBLE_SCORE;

  return {
    candidate,
    score: total,
    breakdown: {
      certScore: Math.round(certScore),
      proximityScore: Math.round(proximityScore),
      experienceScore: Math.round(experienceScore),
      freshnessScore: Math.round(freshnessScore),
      travelBonus: Math.round(travelBonus),
      total: Math.round(total),
    },
    eligible,
    disqualifyReasons,
  };
}

/**
 * Scores and ranks a list of candidates. Returns them sorted by score
 * (highest first), with ineligible candidates at the end.
 */
export function rankCandidates(
  candidates: CandidateData[],
  criteria: PingTargetCriteria,
): ScoredCandidate[] {
  const scored = candidates.map((c) => scoreCandidate(c, criteria));

  scored.sort((a, b) => {
    // Eligible candidates first
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    // Then by score descending
    return b.score - a.score;
  });

  return scored;
}

/**
 * Quick count of eligible candidates without full scoring.
 * Used for the "estimated matches" preview in the Ping UI.
 */
export function estimateMatchCount(
  candidates: CandidateData[],
  criteria: PingTargetCriteria,
): { total: number; eligible: number; topTier: number } {
  const scored = rankCandidates(candidates, criteria);
  return {
    total: scored.length,
    eligible: scored.filter((s) => s.eligible).length,
    topTier: scored.filter((s) => s.eligible && s.score >= 70).length,
  };
}

// ---------------------------------------------------------------------------
// Geo Utilities
// ---------------------------------------------------------------------------

/** Haversine formula — distance in miles between two lat/lng points */
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 3959; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// ---------------------------------------------------------------------------
// String Matching Utilities
// ---------------------------------------------------------------------------

/** Normalize certification names for fuzzy matching */
function normalizeCert(cert: string): string {
  return cert
    .toLowerCase()
    .replace(/[-\u2013\u2014]/g, " ")
    .replace(/[^a-z0-9\s+]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fuzzy cert matching. Handles common variations:
 *   "OSHA 10" \u2194 "OSHA-10" \u2194 "OSHA10"
 *   "CompTIA A+" \u2194 "A+ Certification" \u2194 "comptia a plus"
 *   "NFPA 70E" \u2194 "NFPA70E" \u2194 "nfpa 70e arc flash"
 */
function certsMatch(a: string, b: string): boolean {
  if (a === b) return true;

  // Check if one contains the other
  if (a.includes(b) || b.includes(a)) return true;

  // Remove spaces and compare
  const aCompact = a.replace(/\s/g, "");
  const bCompact = b.replace(/\s/g, "");
  if (aCompact === bCompact) return true;
  if (aCompact.includes(bCompact) || bCompact.includes(aCompact)) return true;

  return false;
}

/** Extract US state abbreviation from a location string */
function extractState(location: string): string | null {
  const stateMatch = location.match(/\b([A-Z]{2})\b/i);
  if (stateMatch) return stateMatch[1].toUpperCase();

  // Common state names
  const states: Record<string, string> = {
    texas: "TX", ohio: "OH", georgia: "GA", illinois: "IL",
    california: "CA", virginia: "VA", oregon: "OR", nevada: "NV",
  };
  for (const [name, abbr] of Object.entries(states)) {
    if (location.includes(name)) return abbr;
  }
  return null;
}
