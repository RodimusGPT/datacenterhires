/**
 * AI Resume-to-ATS Mapping Engine (Hybrid Approach)
 *
 * Strategy:
 *   1. TEMPLATE LAYER — Deterministic mapping of structured profile data
 *      (name, email, phone, work history, certs) into known ATS field schemas.
 *      Covers ~80% of typical application form fields with zero LLM cost.
 *
 *   2. LLM LAYER — Generative answers for free-text screening questions
 *      that can't be answered by template extraction alone. Uses the job
 *      description + resume context to produce human-sounding, role-specific
 *      answers. This is the only part that incurs per-apply cost.
 *
 * Supported ATS platforms: Workday, Greenhouse, Lever, iCIMS, generic.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ATSPlatform = "workday" | "greenhouse" | "lever" | "icims" | "generic";

/** Structured data we extract/hold for a candidate */
export interface CandidateProfile {
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  resumeText: string | null;
  yearsExperience: number;
  certifications: string[];
  skills: string[];
  willingToTravel: boolean;
  headline: string | null;
  summary: string | null;
}

/** A single field an ATS expects us to fill */
export interface ATSField {
  fieldId: string;
  label: string;
  type: "text" | "textarea" | "select" | "checkbox" | "date" | "number" | "file";
  required: boolean;
  options?: string[];       // for select/checkbox
  maxLength?: number;
}

/** Our filled-in answer for one ATS field */
export interface FieldAnswer {
  fieldId: string;
  value: string;
  source: "template" | "llm";
  confidence: number;       // 0-1, how certain we are this is correct
}

/** The full draft returned for one application */
export interface ApplicationDraft {
  jobId: string;
  jobTitle: string;
  company: string;
  atsType: ATSPlatform;
  fields: FieldAnswer[];
  coverLetter: string;
  matchScore: number;       // 0-100, how well the candidate fits
  warnings: string[];       // things the user should review
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// ATS Field Schemas — known field layouts per platform
// ---------------------------------------------------------------------------

/**
 * Each ATS has a predictable set of "standard" fields. We map profile data
 * directly into these without needing an LLM. The fieldId patterns come from
 * reverse-engineering common ATS form structures.
 */
const STANDARD_FIELD_PATTERNS: Record<string, (profile: CandidateProfile) => string> = {
  // Name variants
  "full_name":       (p) => p.name,
  "first_name":      (p) => p.name.split(" ")[0] || "",
  "last_name":       (p) => p.name.split(" ").slice(1).join(" ") || "",
  "name":            (p) => p.name,

  // Contact
  "email":           (p) => p.email,
  "email_address":   (p) => p.email,
  "phone":           (p) => p.phone || "",
  "phone_number":    (p) => p.phone || "",
  "mobile":          (p) => p.phone || "",

  // Location
  "location":        (p) => p.location || "",
  "city":            (p) => p.location?.split(",")[0]?.trim() || "",
  "state":           (p) => p.location?.split(",")[1]?.trim() || "",
  "address":         (p) => p.location || "",
  "zip":             (_) => "",
  "zip_code":        (_) => "",

  // Experience
  "years_experience":(p) => String(p.yearsExperience),
  "experience":      (p) => String(p.yearsExperience),
  "total_experience":(p) => `${p.yearsExperience} years`,

  // Professional
  "headline":        (p) => p.headline || "",
  "title":           (p) => p.headline || "",
  "current_title":   (p) => p.headline || "",
  "summary":         (p) => p.summary || "",
  "linkedin":        (_) => "",
  "website":         (_) => "",
  "portfolio":       (_) => "",

  // Certifications (common in data center ATS forms)
  "certifications":  (p) => p.certifications.join(", "),
  "licenses":        (p) => p.certifications.join(", "),
  "credentials":     (p) => p.certifications.join(", "),

  // Travel / relocation
  "willing_to_travel":    (p) => p.willingToTravel ? "Yes" : "No",
  "willing_to_relocate":  (p) => p.willingToTravel ? "Yes" : "No",
  "relocation":           (p) => p.willingToTravel ? "Yes" : "No",

  // Authorization (common checkbox/select)
  "authorized_to_work":   (_) => "Yes",
  "work_authorization":   (_) => "Yes",
  "us_citizen":           (_) => "",  // leave blank — user must confirm
  "requires_sponsorship": (_) => "",  // leave blank — user must confirm
};

// ---------------------------------------------------------------------------
// Template Layer — deterministic field filling
// ---------------------------------------------------------------------------

function normalizeFieldId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function tryTemplateMatch(field: ATSField, profile: CandidateProfile): FieldAnswer | null {
  const normalized = normalizeFieldId(field.label);

  // Direct match
  const directMapper = STANDARD_FIELD_PATTERNS[normalized];
  if (directMapper) {
    const value = directMapper(profile);
    return {
      fieldId: field.fieldId,
      value,
      source: "template",
      confidence: value ? 1.0 : 0.3,
    };
  }

  // Fuzzy match — check if any pattern key is contained in the label
  for (const [pattern, mapper] of Object.entries(STANDARD_FIELD_PATTERNS)) {
    if (normalized.includes(pattern) || pattern.includes(normalized)) {
      const value = mapper(profile);
      return {
        fieldId: field.fieldId,
        value,
        source: "template",
        confidence: value ? 0.8 : 0.2,
      };
    }
  }

  // Select fields — try to match options
  if (field.type === "select" && field.options) {
    const answer = matchSelectOption(field, profile);
    if (answer) return answer;
  }

  return null;
}

function matchSelectOption(field: ATSField, profile: CandidateProfile): FieldAnswer | null {
  const label = field.label.toLowerCase();
  const options = field.options || [];

  // Experience range selects (e.g., "1-3 years", "5-10 years")
  if (label.includes("experience") || label.includes("years")) {
    const best = options.find((opt) => {
      const match = opt.match(/(\d+)\s*[-\u2013]\s*(\d+)/);
      if (match) {
        const lo = parseInt(match[1]);
        const hi = parseInt(match[2]);
        return profile.yearsExperience >= lo && profile.yearsExperience <= hi;
      }
      const single = opt.match(/(\d+)\+/);
      if (single) return profile.yearsExperience >= parseInt(single[1]);
      return false;
    });
    if (best) {
      return { fieldId: field.fieldId, value: best, source: "template", confidence: 0.9 };
    }
  }

  // Yes/No selects for travel/relocation
  if (label.includes("travel") || label.includes("relocat")) {
    const val = profile.willingToTravel ? "Yes" : "No";
    const match = options.find((o) => o.toLowerCase() === val.toLowerCase());
    if (match) {
      return { fieldId: field.fieldId, value: match, source: "template", confidence: 1.0 };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// LLM Layer — generative answers for screening questions
// ---------------------------------------------------------------------------

/**
 * Detects whether a field is a "screening question" that needs an LLM answer
 * rather than a simple template fill. These are open-ended questions that
 * require synthesizing the resume with the job context.
 */
function isScreeningQuestion(field: ATSField): boolean {
  if (field.type !== "textarea" && field.type !== "text") return false;

  const label = field.label.toLowerCase();
  const questionIndicators = [
    "why", "how", "describe", "explain", "tell us", "what makes",
    "experience with", "familiar with", "worked with",
    "cover letter", "additional information", "anything else",
    "salary expectation", "available start", "start date",
  ];

  return questionIndicators.some((q) => label.includes(q));
}

/**
 * Generates an LLM-powered answer for a screening question.
 *
 * In production, this calls the Claude API. For now, it uses structured
 * prompt templates that generate contextual answers from the resume +
 * job description. The answers are intentionally concise and professional
 * (not overly enthusiastic AI-speak).
 */
function generateScreeningAnswer(
  field: ATSField,
  profile: CandidateProfile,
  jobTitle: string,
  jobDescription: string,
  jobRequirements: string | null,
): FieldAnswer {
  const label = field.label.toLowerCase();
  const maxLen = field.maxLength || 500;
  let answer: string;

  // --- Motivation / "Why" questions ---
  if (label.includes("why") && (label.includes("role") || label.includes("position") || label.includes("company") || label.includes("job"))) {
    const certsList = profile.certifications.slice(0, 3).join(", ");
    answer = truncate(
      `With ${profile.yearsExperience} years in mission-critical infrastructure and active certifications in ${certsList || "relevant trades"}, ` +
      `I'm looking to apply my field experience to this ${jobTitle} role. ` +
      `My background in data center construction \u2014 from commissioning to turnover \u2014 aligns well with the scope described. ` +
      `I'm drawn to projects that push the envelope on uptime and reliability.`,
      maxLen,
    );
  }

  // --- "Describe your experience with X" ---
  else if (label.includes("describe") || label.includes("experience with") || label.includes("tell us")) {
    const relevantKeywords = extractKeywords(jobDescription + " " + (jobRequirements || ""));
    const resumeExcerpt = findRelevantExcerpt(profile.resumeText || "", relevantKeywords);
    answer = truncate(
      resumeExcerpt ||
      `I have ${profile.yearsExperience} years of hands-on experience in data center environments, ` +
      `holding ${profile.certifications.join(", ") || "relevant industry certifications"}. ` +
      `My work has spanned hyperscale new-builds and retrofit projects, with a focus on safety, ` +
      `code compliance, and meeting aggressive commissioning timelines.`,
      maxLen,
    );
  }

  // --- Salary expectations ---
  else if (label.includes("salary") || label.includes("compensation") || label.includes("pay")) {
    answer = "Open to discussing compensation based on the full scope of the role and project timeline.";
  }

  // --- Start date / availability ---
  else if (label.includes("start") || label.includes("available") || label.includes("availability")) {
    answer = "Available to start within 2 weeks of offer acceptance, or sooner if needed for project mobilization.";
  }

  // --- Cover letter ---
  else if (label.includes("cover letter") || label.includes("additional")) {
    const certs = profile.certifications.slice(0, 4).join(", ");
    answer = truncate(
      `I'm writing to express my interest in the ${jobTitle} position. ` +
      `With ${profile.yearsExperience} years in mission-critical construction and certifications including ${certs || "OSHA and trade-specific credentials"}, ` +
      `I've developed deep expertise in the kind of work this role demands.\n\n` +
      `${profile.summary || "My career has been focused on delivering data center projects safely, on-time, and to spec."}\n\n` +
      `I'm ${profile.willingToTravel ? "available for travel assignments and" : ""} ready to bring my skills to your team. ` +
      `I'd welcome the opportunity to discuss how my background fits your project needs.`,
      maxLen,
    );
  }

  // --- Generic fallback ---
  else {
    answer = truncate(
      `${profile.yearsExperience} years of data center construction experience ` +
      `with certifications in ${profile.certifications.slice(0, 3).join(", ") || "relevant trades"}. ` +
      `${profile.summary || "Experienced in mission-critical infrastructure from ground-up builds to commissioning."}`,
      maxLen,
    );
  }

  return {
    fieldId: field.fieldId,
    value: answer,
    source: "llm",
    confidence: 0.7,
  };
}

// ---------------------------------------------------------------------------
// Match Scoring — how well does this candidate fit this job?
// ---------------------------------------------------------------------------

export function computeMatchScore(
  profile: CandidateProfile,
  jobCertsRequired: string[],
  jobDescription: string,
  jobCategory: string,
): number {
  let score = 0;
  const weights = { certs: 40, experience: 25, keywords: 20, travel: 15 };

  // Certification match (0-40 pts)
  if (jobCertsRequired.length > 0) {
    const profileCertsLower = profile.certifications.map((c) => c.toLowerCase().trim());
    const matched = jobCertsRequired.filter((req) =>
      profileCertsLower.some((pc) => pc.includes(req.toLowerCase().trim()) || req.toLowerCase().trim().includes(pc))
    );
    score += (matched.length / jobCertsRequired.length) * weights.certs;
  } else {
    score += weights.certs * 0.5; // No certs required = partial credit
  }

  // Experience match (0-25 pts) — diminishing returns above 10 years
  const expScore = Math.min(profile.yearsExperience / 10, 1.0);
  score += expScore * weights.experience;

  // Keyword overlap (0-20 pts)
  const descKeywords = extractKeywords(jobDescription);
  const profileKeywords = extractKeywords(
    (profile.resumeText || "") + " " + profile.certifications.join(" ") + " " + profile.skills.join(" ")
  );
  if (descKeywords.length > 0) {
    const overlap = descKeywords.filter((k) => profileKeywords.includes(k)).length;
    score += (Math.min(overlap / Math.max(descKeywords.length * 0.5, 1), 1.0)) * weights.keywords;
  }

  // Travel willingness (0-15 pts)
  if (profile.willingToTravel) {
    score += weights.travel;
  } else {
    score += weights.travel * 0.4; // Partial credit — they might still be local
  }

  return Math.round(Math.min(score, 100));
}

// ---------------------------------------------------------------------------
// Main Pipeline — generates a full application draft for one job
// ---------------------------------------------------------------------------

export function generateApplicationDraft(
  profile: CandidateProfile,
  job: {
    id: string;
    title: string;
    company: string;
    description: string;
    requirements: string | null;
    certRequired: string | null;
    atsType: string | null;
    category: string;
  },
  atsFields?: ATSField[],
): ApplicationDraft {
  const atsType = (job.atsType || "generic") as ATSPlatform;
  const jobCerts = (job.certRequired || "").split(",").filter(Boolean).map((c) => c.trim());
  const matchScore = computeMatchScore(profile, jobCerts, job.description, job.category);

  const fields: FieldAnswer[] = [];
  const warnings: string[] = [];

  // If we have explicit ATS fields, fill them
  const fieldsToFill = atsFields || getDefaultATSFields(atsType);

  for (const field of fieldsToFill) {
    // Try template first
    const templateAnswer = tryTemplateMatch(field, profile);
    if (templateAnswer && templateAnswer.confidence >= 0.7) {
      fields.push(templateAnswer);
      continue;
    }

    // Use LLM for screening questions
    if (isScreeningQuestion(field)) {
      fields.push(generateScreeningAnswer(field, profile, job.title, job.description, job.requirements));
      continue;
    }

    // Template with low confidence or no match
    if (templateAnswer) {
      fields.push(templateAnswer);
      if (templateAnswer.confidence < 0.5) {
        warnings.push(`"${field.label}" may need manual review \u2014 low confidence match.`);
      }
    } else if (field.required) {
      fields.push({
        fieldId: field.fieldId,
        value: "",
        source: "template",
        confidence: 0,
      });
      warnings.push(`"${field.label}" could not be auto-filled \u2014 please complete manually.`);
    }
  }

  // Generate cover letter
  const coverLetter = generateScreeningAnswer(
    { fieldId: "cover_letter", label: "Cover letter", type: "textarea", required: false, maxLength: 800 },
    profile,
    job.title,
    job.description,
    job.requirements,
  ).value;

  // Match score warnings
  if (matchScore < 40) {
    warnings.push("Low match score \u2014 this role may require certifications or experience you haven't listed.");
  }
  if (jobCerts.length > 0) {
    const missing = jobCerts.filter(
      (req) => !profile.certifications.some((pc) =>
        pc.toLowerCase().includes(req.toLowerCase()) || req.toLowerCase().includes(pc.toLowerCase())
      )
    );
    if (missing.length > 0) {
      warnings.push(`Missing certifications: ${missing.join(", ")}`);
    }
  }

  return {
    jobId: job.id,
    jobTitle: job.title,
    company: job.company,
    atsType,
    fields,
    coverLetter,
    matchScore,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Default ATS field sets per platform
// ---------------------------------------------------------------------------

function getDefaultATSFields(platform: ATSPlatform): ATSField[] {
  const common: ATSField[] = [
    { fieldId: "first_name", label: "First Name", type: "text", required: true },
    { fieldId: "last_name", label: "Last Name", type: "text", required: true },
    { fieldId: "email", label: "Email Address", type: "text", required: true },
    { fieldId: "phone", label: "Phone Number", type: "text", required: true },
    { fieldId: "location", label: "Location", type: "text", required: false },
  ];

  const platformSpecific: Record<ATSPlatform, ATSField[]> = {
    workday: [
      ...common,
      { fieldId: "years_experience", label: "Total Years of Experience", type: "number", required: true },
      { fieldId: "certifications", label: "Licenses & Certifications", type: "textarea", required: false },
      { fieldId: "authorized_to_work", label: "Are you authorized to work in the US?", type: "select", required: true, options: ["Yes", "No"] },
      { fieldId: "willing_to_relocate", label: "Willing to relocate?", type: "select", required: false, options: ["Yes", "No"] },
      { fieldId: "q_why", label: "Why are you interested in this role?", type: "textarea", required: false, maxLength: 500 },
    ],
    greenhouse: [
      ...common,
      { fieldId: "resume", label: "Resume", type: "file", required: true },
      { fieldId: "cover_letter_field", label: "Cover Letter", type: "textarea", required: false, maxLength: 1000 },
      { fieldId: "linkedin", label: "LinkedIn URL", type: "text", required: false },
      { fieldId: "q_experience", label: "Describe your relevant experience", type: "textarea", required: false, maxLength: 500 },
    ],
    lever: [
      ...common,
      { fieldId: "current_title", label: "Current Title", type: "text", required: false },
      { fieldId: "resume", label: "Resume", type: "file", required: true },
      { fieldId: "q_why", label: "Why do you want to work here?", type: "textarea", required: false, maxLength: 400 },
      { fieldId: "q_salary", label: "Salary Expectations", type: "text", required: false },
      { fieldId: "q_start", label: "Available Start Date", type: "text", required: false },
    ],
    icims: [
      ...common,
      { fieldId: "years_experience", label: "Years of Experience", type: "select", required: true, options: ["0-1 years", "2-4 years", "5-7 years", "8-10 years", "10+ years"] },
      { fieldId: "certifications", label: "Certifications", type: "textarea", required: false },
      { fieldId: "q_experience", label: "Tell us about your experience in this field", type: "textarea", required: false, maxLength: 600 },
    ],
    generic: [
      ...common,
      { fieldId: "years_experience", label: "Years of Experience", type: "number", required: false },
      { fieldId: "certifications", label: "Certifications", type: "textarea", required: false },
      { fieldId: "q_why", label: "Why are you interested in this role?", type: "textarea", required: false, maxLength: 500 },
      { fieldId: "q_experience", label: "Describe your relevant experience", type: "textarea", required: false, maxLength: 500 },
    ],
  };

  return platformSpecific[platform] || platformSpecific.generic;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3).replace(/\s+\S*$/, "") + "...";
}

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "shall", "can", "this", "that",
  "these", "those", "it", "its", "we", "our", "you", "your", "they",
  "their", "all", "each", "every", "both", "few", "more", "most",
  "other", "some", "such", "no", "not", "only", "own", "same", "so",
  "than", "too", "very", "just", "also",
]);

function extractKeywords(text: string): string[] {
  return [...new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  )];
}

function findRelevantExcerpt(resumeText: string, keywords: string[]): string {
  if (!resumeText || keywords.length === 0) return "";

  const sentences = resumeText.split(/[.!?\n]+/).filter((s) => s.trim().length > 20);
  const scored = sentences.map((sentence) => {
    const lower = sentence.toLowerCase();
    const hits = keywords.filter((k) => lower.includes(k)).length;
    return { sentence: sentence.trim(), hits };
  });

  scored.sort((a, b) => b.hits - a.hits);
  const top = scored.slice(0, 3).filter((s) => s.hits > 0);

  if (top.length === 0) return "";
  return top.map((s) => s.sentence).join(". ") + ".";
}
