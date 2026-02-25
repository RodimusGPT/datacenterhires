import { generateApplicationDraft, computeMatchScore, type CandidateProfile } from "../ats-mapper";

const baseProfile: CandidateProfile = {
  name: "Maria Gonzalez",
  email: "maria@example.com",
  phone: "+18325559876",
  location: "Katy, TX",
  resumeText: "8 years experience in electrical installation for data center environments. Led crews of 30+ on hyperscale builds. Certified OSHA 30, NFPA 70E, Journeyman Electrician.",
  yearsExperience: 8,
  certifications: ["OSHA 30", "NFPA 70E", "CompTIA A+"],
  skills: ["medium voltage", "conduit installation", "BMS"],
  willingToTravel: true,
  headline: "Senior Electrician - Data Center Specialist",
  summary: "Mission-critical electrical professional with 8 years on hyperscale builds.",
};

const baseJob = {
  id: "job-1",
  title: "Senior Electrical Foreman - Data Center",
  company: "Rosendin Electric",
  description: "Lead electrical installation for a 200MW hyperscale data center campus. Oversee crew of 40+ electricians on medium/high voltage switchgear, UPS systems, and PDU installations.",
  requirements: "OSHA 30, NFPA 70E, Journeyman License, 10+ years data center experience",
  certRequired: "OSHA 30,NFPA 70E",
  atsType: "workday",
  category: "electrical",
};

describe("generateApplicationDraft", () => {
  test("generates a complete draft with all field types", () => {
    const draft = generateApplicationDraft(baseProfile, baseJob);

    expect(draft.jobId).toBe("job-1");
    expect(draft.jobTitle).toBe("Senior Electrical Foreman - Data Center");
    expect(draft.atsType).toBe("workday");
    expect(draft.fields.length).toBeGreaterThan(0);
    expect(draft.coverLetter).toBeTruthy();
    expect(draft.matchScore).toBeGreaterThan(0);
    expect(draft.generatedAt).toBeTruthy();
  });

  test("template fills standard fields correctly", () => {
    const draft = generateApplicationDraft(baseProfile, baseJob);

    const firstName = draft.fields.find((f) => f.fieldId === "first_name");
    expect(firstName?.value).toBe("Maria");
    expect(firstName?.source).toBe("template");

    const lastName = draft.fields.find((f) => f.fieldId === "last_name");
    expect(lastName?.value).toBe("Gonzalez");

    const email = draft.fields.find((f) => f.fieldId === "email");
    expect(email?.value).toBe("maria@example.com");

    const phone = draft.fields.find((f) => f.fieldId === "phone");
    expect(phone?.value).toBe("+18325559876");
  });

  test("LLM generates screening question answers", () => {
    const draft = generateApplicationDraft(baseProfile, baseJob);

    const whyQuestion = draft.fields.find((f) => f.fieldId === "q_why");
    expect(whyQuestion).toBeDefined();
    expect(whyQuestion?.source).toBe("llm");
    expect(whyQuestion?.value).toBeTruthy();
    expect(whyQuestion?.value.length).toBeGreaterThan(50);
    // Should reference their experience or certifications
    expect(whyQuestion?.value.toLowerCase()).toMatch(/year|cert|experience|mission/);
  });

  test("generates appropriate cover letter", () => {
    const draft = generateApplicationDraft(baseProfile, baseJob);

    expect(draft.coverLetter.length).toBeGreaterThan(100);
    expect(draft.coverLetter).toContain("Senior Electrical Foreman - Data Center");
    expect(draft.coverLetter).toMatch(/8 years/);
  });

  test("warns about missing certifications", () => {
    const weakProfile = { ...baseProfile, certifications: ["OSHA 10"] };
    const draft = generateApplicationDraft(weakProfile, baseJob);

    expect(draft.warnings.some((w) => w.toLowerCase().includes("missing cert"))).toBe(true);
  });

  test("warns about low match score", () => {
    const weakProfile = { ...baseProfile, certifications: [], yearsExperience: 0, resumeText: "" };
    const draft = generateApplicationDraft(weakProfile, baseJob);

    expect(draft.matchScore).toBeLessThan(40);
    expect(draft.warnings.some((w) => w.toLowerCase().includes("low match"))).toBe(true);
  });

  test("handles generic ATS type", () => {
    const draft = generateApplicationDraft(baseProfile, { ...baseJob, atsType: null });
    expect(draft.atsType).toBe("generic");
    expect(draft.fields.length).toBeGreaterThan(0);
  });

  test("handles different ATS platforms", () => {
    for (const atsType of ["workday", "greenhouse", "lever", "icims", "generic"] as const) {
      const draft = generateApplicationDraft(baseProfile, { ...baseJob, atsType });
      expect(draft.atsType).toBe(atsType);
      expect(draft.fields.length).toBeGreaterThan(0);

      // All should have basic contact fields
      const hasEmail = draft.fields.some((f) => f.fieldId === "email");
      expect(hasEmail).toBe(true);
    }
  });
});

describe("computeMatchScore", () => {
  test("perfect match scores high", () => {
    const score = computeMatchScore(
      baseProfile,
      ["OSHA 30", "NFPA 70E"],
      baseJob.description,
      "electrical",
    );
    expect(score).toBeGreaterThanOrEqual(70);
  });

  test("no certs required gives partial credit", () => {
    const score = computeMatchScore(baseProfile, [], baseJob.description, "electrical");
    expect(score).toBeGreaterThan(30);
    expect(score).toBeLessThan(80);
  });

  test("zero experience gives low score", () => {
    const noExpProfile = { ...baseProfile, yearsExperience: 0, certifications: [] };
    const score = computeMatchScore(noExpProfile, ["OSHA 30"], baseJob.description, "electrical");
    expect(score).toBeLessThanOrEqual(30);
  });

  test("travel willingness adds points", () => {
    const noTravel = computeMatchScore(
      { ...baseProfile, willingToTravel: false },
      ["OSHA 30", "NFPA 70E"],
      baseJob.description,
      "electrical",
    );
    const withTravel = computeMatchScore(
      { ...baseProfile, willingToTravel: true },
      ["OSHA 30", "NFPA 70E"],
      baseJob.description,
      "electrical",
    );
    expect(withTravel).toBeGreaterThan(noTravel);
  });

  test("keyword overlap from resume boosts score", () => {
    const noResume = computeMatchScore(
      { ...baseProfile, resumeText: "" },
      ["OSHA 30"],
      baseJob.description,
      "electrical",
    );
    const withResume = computeMatchScore(
      baseProfile, // has "medium voltage", "data center", etc. in resumeText
      ["OSHA 30"],
      baseJob.description,
      "electrical",
    );
    expect(withResume).toBeGreaterThanOrEqual(noResume);
  });
});
