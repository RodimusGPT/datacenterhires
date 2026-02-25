import { scoreCandidate, rankCandidates, estimateMatchCount, type CandidateData, type PingTargetCriteria } from "../candidate-scorer";

// --- Test fixtures ---

const baseCriteria: PingTargetCriteria = {
  requiredCerts: ["OSHA 30", "NFPA 70E"],
  location: "Houston, TX",
  latitude: 29.7604,
  longitude: -95.3698,
  radiusMiles: 100,
  minExperience: 5,
};

function makeCandidate(overrides: Partial<CandidateData> = {}): CandidateData {
  return {
    profileId: "test-1",
    userId: "user-1",
    name: "John Martinez",
    phone: "+18325551234",
    email: "john@example.com",
    location: "Houston, TX",
    latitude: 29.7604,
    longitude: -95.3698,
    yearsExperience: 8,
    willingToTravel: true,
    smsOptIn: true,
    certifications: ["OSHA 30", "NFPA 70E"],
    lastActive: new Date(),
    ...overrides,
  };
}

// --- Tests ---

describe("scoreCandidate", () => {
  test("perfect candidate scores high", () => {
    const result = scoreCandidate(makeCandidate(), baseCriteria);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.eligible).toBe(true);
    expect(result.breakdown.certScore).toBe(40); // full cert match
    expect(result.breakdown.proximityScore).toBe(25); // same city
  });

  test("missing certifications penalizes heavily", () => {
    const result = scoreCandidate(
      makeCandidate({ certifications: [] }),
      baseCriteria,
    );
    expect(result.breakdown.certScore).toBe(0);
    expect(result.score).toBeLessThan(60);
  });

  test("partial cert match gives proportional score", () => {
    const result = scoreCandidate(
      makeCandidate({ certifications: ["OSHA 30"] }),
      baseCriteria,
    );
    // 1 of 2 required certs = ~18 out of 40
    expect(result.breakdown.certScore).toBeGreaterThan(0);
    expect(result.breakdown.certScore).toBeLessThan(40);
  });

  test("distant candidate scores lower on proximity", () => {
    const result = scoreCandidate(
      makeCandidate({
        location: "Chicago, IL",
        latitude: 41.8781,
        longitude: -87.6298,
      }),
      baseCriteria,
    );
    expect(result.breakdown.proximityScore).toBe(0); // way outside radius
  });

  test("travel willingness compensates for distance", () => {
    const farNoTravel = scoreCandidate(
      makeCandidate({
        location: "Dallas, TX",
        latitude: 32.7767,
        longitude: -96.7970,
        willingToTravel: false,
      }),
      baseCriteria,
    );
    const farWithTravel = scoreCandidate(
      makeCandidate({
        location: "Dallas, TX",
        latitude: 32.7767,
        longitude: -96.7970,
        willingToTravel: true,
      }),
      baseCriteria,
    );
    expect(farWithTravel.breakdown.travelBonus).toBeGreaterThan(farNoTravel.breakdown.travelBonus);
    expect(farWithTravel.score).toBeGreaterThan(farNoTravel.score);
  });

  test("no SMS opt-in disqualifies candidate", () => {
    const result = scoreCandidate(
      makeCandidate({ smsOptIn: false }),
      baseCriteria,
    );
    expect(result.eligible).toBe(false);
    expect(result.disqualifyReasons).toContain("No SMS opt-in consent");
  });

  test("no phone number disqualifies candidate", () => {
    const result = scoreCandidate(
      makeCandidate({ phone: null }),
      baseCriteria,
    );
    expect(result.eligible).toBe(false);
    expect(result.disqualifyReasons).toContain("No phone number on file");
  });

  test("experience below minimum still gets partial credit", () => {
    const result = scoreCandidate(
      makeCandidate({ yearsExperience: 2 }),
      baseCriteria, // minExperience = 5
    );
    expect(result.breakdown.experienceScore).toBeGreaterThan(0);
    expect(result.breakdown.experienceScore).toBeLessThan(10);
  });

  test("stale profile scores lower on freshness", () => {
    const fresh = scoreCandidate(
      makeCandidate({ lastActive: new Date() }),
      baseCriteria,
    );
    const stale = scoreCandidate(
      makeCandidate({ lastActive: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000) }),
      baseCriteria,
    );
    expect(fresh.breakdown.freshnessScore).toBeGreaterThan(stale.breakdown.freshnessScore);
  });

  test("fuzzy cert matching handles variations", () => {
    // "OSHA-30" should match "OSHA 30"
    const result = scoreCandidate(
      makeCandidate({ certifications: ["OSHA-30", "NFPA-70E"] }),
      baseCriteria,
    );
    expect(result.breakdown.certScore).toBe(40);
  });
});

describe("rankCandidates", () => {
  test("returns candidates sorted by score descending", () => {
    const candidates = [
      makeCandidate({ profileId: "low", certifications: [], yearsExperience: 1 }),
      makeCandidate({ profileId: "high", certifications: ["OSHA 30", "NFPA 70E"], yearsExperience: 10 }),
      makeCandidate({ profileId: "mid", certifications: ["OSHA 30"], yearsExperience: 5 }),
    ];
    const ranked = rankCandidates(candidates, baseCriteria);
    expect(ranked[0].candidate.profileId).toBe("high");
    expect(ranked[ranked.length - 1].candidate.profileId).toBe("low");
  });

  test("ineligible candidates sort to the end", () => {
    const candidates = [
      makeCandidate({ profileId: "no-phone", phone: null, certifications: ["OSHA 30", "NFPA 70E"] }),
      makeCandidate({ profileId: "eligible", certifications: [] }),
    ];
    const ranked = rankCandidates(candidates, baseCriteria);
    // "eligible" (even with low score) should be before "no-phone"
    expect(ranked[0].candidate.profileId).toBe("eligible");
    expect(ranked[1].candidate.profileId).toBe("no-phone");
  });
});

describe("estimateMatchCount", () => {
  test("returns correct counts", () => {
    const candidates = [
      makeCandidate({ profileId: "a" }),  // eligible, high score
      makeCandidate({ profileId: "b", smsOptIn: false }), // ineligible
      makeCandidate({ profileId: "c", certifications: [], yearsExperience: 0 }), // low score
    ];
    const counts = estimateMatchCount(candidates, baseCriteria);
    expect(counts.total).toBe(3);
    expect(counts.eligible).toBe(2);  // a and c (c has smsOptIn=true, phone)
    expect(counts.topTier).toBe(1);    // only a is 70+
  });
});
