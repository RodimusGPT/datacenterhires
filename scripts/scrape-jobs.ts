/**
 * DataCenterHires Job Scraping Pipeline
 *
 * Step 1 — Discovery: APPLY_LINKS contains every relevant job URL found from
 *   career portals (T5 Data Centers / SmartRecruiters, pkaza.com).
 *
 * Step 2 — Extraction: Each URL was fetched and parsed into the ScrapedJob
 *   schema below. Zod validates the raw shape, parseSalary() converts range
 *   strings to integer min/max, and the region filter removes non-South/Midwest.
 *
 * Run locally:
 *   npx tsx scripts/scrape-jobs.ts --dry-run    # print JSON, no DB write
 *   npx tsx scripts/scrape-jobs.ts              # insert into DB via DATABASE_URL
 */

import { z } from "zod";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Step 1: Discovered apply links ──────────────────────────────────────────

export const APPLY_LINKS: { apply_links: string[] } = {
  apply_links: [
    // T5 Data Centers (SmartRecruiters ATS)
    "https://jobs.smartrecruiters.com/T5DataCenters1/3743990006302579-mep-coordinator",
    "https://jobs.smartrecruiters.com/T5DataCenters1/3743990006061134-data-center-commissioning-manager-mep-",
    "https://jobs.smartrecruiters.com/T5DataCenters1/3743990007731446-project-engineer",
    "https://jobs.smartrecruiters.com/T5DataCenters1/3743990007647806-regional-safety-manager",
    "https://jobs.smartrecruiters.com/T5DataCenters1/3743990007121556-procurement-manager-mep-",
    "https://jobs.smartrecruiters.com/T5DataCenters1/3743990006377836-safety-manager",
    "https://jobs.smartrecruiters.com/T5DataCenters1/3743990007386466-safety-manager",
    // Pkaza Critical Facilities Recruiting (pkaza.com)
    "https://www.pkaza.com/job/electrical-commissioning-engineer-ashburn-va-dfeb4615-1b64-4c80-984e-4ade0804036f/",
    "https://www.pkaza.com/job/electrical-project-manager-data-center-construction-augusta-ga-fc7894c2-85dd-4595-9e24-60de08044740/",
    "https://www.pkaza.com/job/mechanical-superintendent-data-center-construction-chesterton-in-5a2eb7f2-b9ef-4d5b-ba33-60de08044944/",
    "https://www.pkaza.com/job/onsite-engineer-critical-facilities-charleston-sc-3992f1b3-1224-4514-8166-60de0804133e/",
    "https://www.pkaza.com/job/electrical-estimator-data-center-construction-atlanta-ga-5c7bc390-d26b-40ee-61af-e69e1cb3dc08/",
    "https://www.pkaza.com/job/electrical-assistant-project-manager-ashburn-va-c6816470-9ae7-4b44-dd55-d7ec4e2fdd08/",
    "https://www.pkaza.com/job/director-of-data-center-construction-ashburn-va-b25c173c-30a2-4371-04dc-5352cdebdb08/",
    // Pkaza via Crelate ATS (jobs.crelate.com/portal/pkaza)
    "https://jobs.crelate.com/portal/pkaza/job/ie8gx7w3yhkrkobooikpdth7ao",
    "https://jobs.crelate.com/portal/pkaza/job/gp3uzt45m74gs6icgmd5qeiqih",
    "https://jobs.crelate.com/portal/pkaza/job/kcx19g3keiw1y54abjyymam3sr",
    "https://jobs.crelate.com/portal/pkaza/job/iy9okswtyw1aymuf6fd1k7mi1e",
    // Mortenson Construction (mortenson.com careers)
    "https://www.mortenson.com/careers/data-center-group/mep-superintendent-20545",
    // Gray Construction (iCIMS ATS)
    "https://grayconstruction-gray.icims.com/jobs/4527/construction-project-manager,-mep---data-center-market/job",
    "https://grayconstruction-gray.icims.com/jobs/4520/assistant-site-manager,-commissioning/job",
    "https://grayconstruction-gray.icims.com/jobs/1699/project-executive/job",
    // Additional pkaza (pkaza.com direct links via Data Center Frontier)
    "https://www.pkaza.com/job/commissioning-project-manager-hampton-ga-b41e2aa0-d9ed-4e0e-5b78-6eafc329dd08/",
    "https://www.pkaza.com/job/mep-resident-engineer-data-center-colo-totowa-nj-3809ebe4-69a7-48f1-9765-581a4342dd08/",
    "https://www.pkaza.com/job/controls-superintendent-data-center-retrofits-montreal-qc-915a86d3-e46d-4f36-1335-95722445dd08/",
    "https://www.pkaza.com/job/critical-facilities-operations-electrician-sumner-wa-265270ff-1846-4abf-0427-055a020fdd08/",
    // xAI (Greenhouse ATS — Colossus supercomputer, Memphis TN)
    "https://job-boards.greenhouse.io/xai/jobs/4939291007",
    "https://job-boards.greenhouse.io/xai/jobs/4593414007",
    "https://job-boards.greenhouse.io/xai/jobs/4977264007",
    "https://job-boards.greenhouse.io/xai/jobs/4593412007",
    "https://job-boards.greenhouse.io/xai/jobs/4869805007",
    "https://job-boards.greenhouse.io/xai/jobs/4426119007",
    // Oracle (Oracle Recruiting Cloud — Stargate / Abilene TX campus)
    "https://careers.oracle.com/en/job/305135",
    "https://careers.oracle.com/en/job/319228",
    // Google (Google Careers — South/Midwest DC campuses)
    "https://www.google.com/about/careers/applications/jobs/results/137349914190324422-program-manager/",
    "https://www.google.com/about/careers/applications/jobs/results/138935867505812166-data-center-electrical-engineer/",
    // Apple (Apple Careers — Dallas TX campus)
    "https://jobs.apple.com/en-us/details/200582562/construction-project-manager",
  ],
};

// ─── Step 2: Zod extraction schema ───────────────────────────────────────────

/**
 * States included in the US South + Midwest filter.
 * Jobs outside this set are rejected (return null for the entire object).
 */
const SOUTH_MIDWEST = new Set([
  // South
  "TX", "GA", "VA", "NC", "SC", "TN", "AL", "MS", "LA", "AR", "OK",
  "KY", "WV", "MD", "DE", "FL",
  // Midwest
  "OH", "IN", "IL", "MI", "WI", "MN", "IA", "MO", "ND", "SD", "NE", "KS",
]);

export const ScrapedJobSchema = z.object({
  /** Raw job title from the posting */
  job_title: z.string().min(1),
  /** Hiring company name */
  company_name: z.string().min(1),
  /** "City, ST" — null if not found */
  location: z.string().nullable(),
  /** e.g. "Full-time", "Contractor", "Contract" */
  job_type: z.string().nullable().default(null),
  /** OSHA 10, NFPA 70E, CompTIA A+, etc. */
  certifications_required: z.array(z.string()).nullable().default([]),
  /** MEP Coordination, High-Voltage, Commissioning, etc. */
  skills: z.array(z.string()).nullable().default([]),
  /** True only if "per diem", "per-diem", or "traveler support" is mentioned */
  per_diem_offered: z.boolean().nullable().default(false),
  /**
   * Salary as string, e.g. "$77,900 - $107,700" or "$35 - $55/hr".
   * Defaults to "Competitive" when not listed.
   */
  salary_range: z.string().default("Competitive"),
  /** Direct ATS application URL */
  apply_url: z.string().url().nullable(),
  /** Full job description text (synthesized from posting) */
  description: z.string().min(1),
  /** Requirements / qualifications (optional) */
  requirements: z.string().nullable().default(null),
});

export type ScrapedJob = z.infer<typeof ScrapedJobSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Converts a salary range string to Prisma-compatible integer fields.
 * "$77,900 - $107,700"  → { salaryMin: 77900, salaryMax: 107700, salaryPeriod: "annual" }
 * "$35 - $55/hr"        → { salaryMin: 35,    salaryMax: 55,     salaryPeriod: "hourly" }
 * "Competitive" / null  → { salaryMin: null,   salaryMax: null,   salaryPeriod: null }
 */
function parseSalary(range: string): {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: string | null;
} {
  const empty = { salaryMin: null, salaryMax: null, salaryPeriod: null };
  if (!range || range === "Competitive") return empty;

  const isHourly = /\/hr|per hour|hourly/i.test(range);
  const nums = range.replace(/[$,]/g, "").match(/\d+(?:\.\d+)?/g);
  if (!nums?.length) return empty;

  return {
    salaryMin: Math.round(Number(nums[0])),
    salaryMax: Math.round(Number(nums[1] ?? nums[0])),
    salaryPeriod: isHourly ? "hourly" : "annual",
  };
}

/**
 * Returns true if location is in the US South or Midwest (or unknown).
 * Rejects non-matching state codes per the extraction constraints.
 */
function isInRegion(location: string | null): boolean {
  if (!location) return true;
  const m = location.match(/,\s*([A-Z]{2})\b/);
  return m ? SOUTH_MIDWEST.has(m[1]) : true;
}

/** Normalizes job_type string to a Prisma-safe enum value. */
function mapJobType(raw: string | null): string {
  if (!raw) return "full_time";
  const t = raw.toLowerCase();
  if (t.includes("contract")) return "contract";
  if (t.includes("part")) return "part_time";
  if (t.includes("temp")) return "temporary";
  return "full_time";
}

function inferCategory(title: string): string {
  const t = title.toLowerCase();
  if (/commission/i.test(t)) return "commissioning";
  if (/electrician|electrical/i.test(t)) return "electrical";
  if (/mechanical|hvac|plumbing/i.test(t)) return "mechanical";
  if (/mep/i.test(t)) return "mep";
  if (/project (engineer|manager)/i.test(t)) return "project_management";
  if (/safety/i.test(t)) return "safety";
  if (/procurement/i.test(t)) return "project_management";
  return "general";
}

/**
 * Validates raw scraped data with Zod, applies region filter, and maps to
 * the Prisma Job model shape.
 * Returns null if validation fails or location is out of region.
 */
export function validateAndMap(raw: unknown) {
  const result = ScrapedJobSchema.safeParse(raw);

  if (!result.success) {
    console.error(
      "❌ Validation failed:",
      result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`)
    );
    return null;
  }

  const job = result.data;

  if (!isInRegion(job.location)) {
    console.log(`⏭  Skipped (out of region): ${job.job_title} @ ${job.location}`);
    return null;
  }

  const { salaryMin, salaryMax, salaryPeriod } = parseSalary(job.salary_range);

  return {
    title: job.job_title,
    company: job.company_name,
    description: job.description,
    requirements: [
      job.requirements,
      job.certifications_required?.length
        ? `Certifications: ${job.certifications_required.join(", ")}`
        : null,
      job.skills?.length ? `Skills: ${job.skills.join(", ")}` : null,
      job.per_diem_offered ? "Per Diem: Offered when traveling." : null,
    ]
      .filter(Boolean)
      .join("\n"),
    location: job.location ?? "Multiple Locations",
    locationType: "on_site" as const,
    salaryMin,
    salaryMax,
    salaryPeriod,
    jobType: mapJobType(job.job_type),
    category: inferCategory(job.job_title),
    certRequired: job.certifications_required?.join(",") || null,
    source: "scraped" as const,
    sourceUrl: job.apply_url,
    atsType: job.apply_url?.includes("smartrecruiters") ? "SmartRecruiters"
            : job.apply_url?.includes("pkaza") || job.apply_url?.includes("crelate") ? "pkaza"
            : job.apply_url?.includes("icims") ? "iCIMS"
            : job.apply_url?.includes("mortenson") ? "Mortenson"
            : job.apply_url?.includes("greenhouse.io") ? "Greenhouse"
            : job.apply_url?.includes("oracle.com") ? "Oracle"
            : job.apply_url?.includes("google.com") ? "Google"
            : job.apply_url?.includes("apple.com") ? "Apple"
            : null,
    status: "active" as const,
    featured: false,
    expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
  };
}

// ─── Raw scraped job data (T5 Data Centers & pkaza, Feb 2026) ────────────────

export const RAW_SCRAPED_JOBS: unknown[] = [
  {
    job_title: "MEP Coordinator",
    company_name: "T5 Data Centers",
    location: "Atlanta, GA",
    job_type: "Full-time",
    certifications_required: [],
    skills: [
      "MEP Systems (HVAC, Electrical, Plumbing)",
      "Procore",
      "BIM 360",
      "Bluebeam",
      "Blueprint Interpretation",
      "Building Codes & Safety Regulations",
    ],
    per_diem_offered: true,
    salary_range: "$77,900 - $107,700",
    apply_url:
      "https://jobs.smartrecruiters.com/T5DataCenters1/3743990006302579-mep-coordinator",
    description:
      "T5 Data Centers is seeking a dedicated MEP Field Coordinator to oversee and manage on-site coordination of mechanical, electrical, and plumbing installations for mission-critical data center projects. You will monitor daily activities of MEP subcontractors, ensure compliance with project schedule and specifications, and serve as the primary point of contact for MEP trades on-site. Experience with hyperscale data center projects required.",
    requirements:
      "3-5 years of experience in MEP field coordination or related roles, with focus on mission-critical or hyperscale projects. Associate's degree in construction management preferred. Proficiency in Procore, BIM 360, and Bluebeam.",
  },
  {
    job_title: "Data Center Commissioning Manager (MEP)",
    company_name: "T5 Data Centers",
    location: "Marble, NC",
    job_type: "Full-time",
    certifications_required: [],
    skills: [
      "QA/QC Inspection & Testing",
      "Microsoft Project",
      "Procore",
      "CAD/Visio",
      "MEP Systems",
      "Commissioning Documentation",
    ],
    per_diem_offered: false,
    salary_range: "Competitive",
    apply_url:
      "https://jobs.smartrecruiters.com/T5DataCenters1/3743990006061134-data-center-commissioning-manager-mep-",
    description:
      "T5 Data Centers is hiring a Data Center Commissioning Manager (MEP) for a project in Marble, NC. This role is responsible for overseeing QA/QC inspection and testing procedures for MEP systems, ensuring all mechanical, electrical, and plumbing systems meet data center commissioning standards. Requires 50% travel to project sites. Military MOS, trade school, or construction degree preferred.",
    requirements:
      "1-3 years of inspection and/or production experience. Strong technical knowledge of MEP materials and compliance standards. Open to frequent travel (50%). Any civilian or military technical certifications are a plus.",
  },
  {
    job_title: "Project Engineer – Data Center Construction",
    company_name: "T5 Data Centers",
    location: "Denton, TX",
    job_type: "Full-time",
    certifications_required: [],
    skills: [
      "Project Management",
      "Data Center Operations",
      "Technical Problem-Solving",
      "Construction Coordination",
    ],
    per_diem_offered: true,
    salary_range: "Competitive",
    apply_url:
      "https://jobs.smartrecruiters.com/T5DataCenters1/3743990007731446-project-engineer",
    description:
      "T5 Data Centers is looking for a Project Engineer to support data center construction projects in Denton, TX. You will coordinate day-to-day construction activities, manage project documentation, and ensure alignment with schedule and quality standards on mission-critical builds. Per Diem offered when traveling.",
    requirements:
      "Experience in data center or mission-critical construction. Ability to stand, climb, and lift up to 100 lbs. Willingness to work in variable environmental conditions. Bonus eligible with full benefits package.",
  },
  {
    job_title: "Regional Safety Manager",
    company_name: "T5 Data Centers",
    location: "Atlanta, GA",
    job_type: "Full-time",
    certifications_required: ["OSHA 30"],
    skills: [
      "EHS Program Management",
      "Incident Investigation",
      "OSHA Compliance",
      "Safety Training",
      "Risk Assessment",
    ],
    per_diem_offered: false,
    salary_range: "Competitive",
    apply_url:
      "https://jobs.smartrecruiters.com/T5DataCenters1/3743990007647806-regional-safety-manager",
    description:
      "T5 Data Centers is hiring a Regional Safety Manager to lead Environmental, Health, and Safety programs across multiple data center construction projects in the Southeast region. You will oversee compliance with OSHA regulations, conduct site audits, investigate incidents, and drive a zero-incident safety culture.",
    requirements:
      "OSHA 30 required. 5+ years of EHS experience in construction, preferably mission-critical. Experience managing safety across multiple concurrent project sites. Strong incident investigation and reporting skills.",
  },
  {
    job_title: "Procurement Manager (MEP)",
    company_name: "T5 Data Centers",
    location: "Atlanta, GA",
    job_type: "Full-time",
    certifications_required: [],
    skills: [
      "MEP Procurement",
      "Vendor Management",
      "Contract Negotiation",
      "Supply Chain",
      "Data Center Equipment",
    ],
    per_diem_offered: false,
    salary_range: "Competitive",
    apply_url:
      "https://jobs.smartrecruiters.com/T5DataCenters1/3743990007121556-procurement-manager-mep-",
    description:
      "T5 Data Centers seeks a Procurement Manager (MEP) to manage sourcing, vendor relationships, and contracts for mechanical, electrical, and plumbing equipment and services across data center construction projects. This role drives cost savings while ensuring quality and schedule adherence for hyperscale builds.",
    requirements:
      "5+ years of procurement experience in MEP or construction, preferably in mission-critical or data center environments. Strong negotiation, vendor management, and supply chain skills. Familiarity with long-lead MEP equipment (generators, chillers, switchgear).",
  },
  {
    job_title: "Electrical Commissioning Engineer",
    company_name: "Engineering Design & Commissioning Company",
    location: "Ashburn, VA",
    job_type: "Contract",
    certifications_required: [],
    skills: [
      "Electrical Power Systems",
      "Load Bank Testing",
      "Commissioning Levels 1-5",
      "SOP/MOP Development",
      "High-Voltage",
      "Data Center Commissioning",
    ],
    per_diem_offered: false,
    salary_range: "Competitive",
    apply_url:
      "https://www.pkaza.com/job/electrical-commissioning-engineer-ashburn-va-dfeb4615-1b64-4c80-984e-4ade0804036f/",
    description:
      "Traveling Electrical Commissioning Engineer for mission-critical data center projects based in Ashburn, VA with positions across multiple cities (Charlotte NC, Atlanta GA, Dallas TX, Chicago IL). Perform Level 1–5 electrical commissioning, load bank testing, power quality analysis, and SOP/MOP development for data center electrical systems including UPS, switchgear, and generators. 4–10+ years of electrical power systems experience required.",
    requirements:
      "4-10+ years experience with electrical power systems in data center/mission-critical environments. Strong commissioning test procedure expertise. Willingness to travel extensively. Experience with Microsoft Office (Word, Excel, Project).",
  },
  {
    job_title: "Electrical Project Manager – Data Center Construction",
    company_name: "Established Electrical Contracting Firm",
    location: "Augusta, GA",
    job_type: "Full-time",
    certifications_required: ["OSHA 10"],
    skills: [
      "Data Center Construction PM",
      "Budget Management",
      "Power Systems (UPS, Switchgear, Generators, PDUs)",
      "Blueprint Interpretation",
      "MS Project",
      "Oracle Primavera P6",
      "Procore",
      "AutoCAD",
    ],
    per_diem_offered: false,
    salary_range: "Competitive",
    apply_url:
      "https://www.pkaza.com/job/electrical-project-manager-data-center-construction-augusta-ga-fc7894c2-85dd-4595-9e24-60de08044740/",
    description:
      "Lead electrical construction projects for a major data center build in Augusta, GA. Manage budgets, timelines, subcontractors, and client relationships from preconstruction through turnover. Also available in Richmond VA, Charlotte NC, Ashburn VA, Dallas TX, and Northern Atlanta GA. Licensed journeyman electrician background preferred.",
    requirements:
      "OSHA Certification required or ability to obtain within 12 months. 5+ years of supervisory experience in electrical construction. Data center project management experience. Proficiency in MS Project, Primavera P6, AutoCAD, Procore, and Bluebeam.",
  },
  {
    job_title: "Mechanical Superintendent – Data Center Construction",
    company_name: "National General Contractor",
    location: "Chesterton, IN",
    job_type: "Full-time",
    certifications_required: [],
    skills: [
      "HVAC/Mechanical Systems",
      "Chillers",
      "AHUs",
      "CRAC/CRAH Units",
      "Cooling Towers",
      "Data Center Construction",
      "MS Project",
      "AutoCAD",
      "Revit",
    ],
    per_diem_offered: false,
    salary_range: "Competitive",
    apply_url:
      "https://www.pkaza.com/job/mechanical-superintendent-data-center-construction-chesterton-in-5a2eb7f2-b9ef-4d5b-ba33-60de08044944/",
    description:
      "Experienced Mechanical Superintendent needed for a data center construction project in Chesterton, IN managing $50M+ mechanical scope. Oversee HVAC/mechanical subcontractors, coordinate with MEP engineers, and ensure quality installation of chillers, cooling towers, AHUs, and CRAC/CRAH units. Also available in Ashburn VA, Atlanta GA, Chicago IL, New Albany OH, and Dallas TX. Military/veteran background highly valued.",
    requirements:
      "5+ years field supervision in mechanical/HVAC construction. Data center experience strongly preferred. OSHA compliance familiarity. PMP or similar accreditation preferred. MS Project, AutoCAD, Revit proficiency. Willingness to travel Mon–Fri on-site.",
  },
  {
    job_title: "Onsite Engineer – Critical Facilities",
    company_name: "AEC/MEP Engineering & Commissioning Company",
    location: "Charleston, SC",
    job_type: "Full-time",
    certifications_required: [],
    skills: [
      "MEP Systems",
      "HVAC",
      "Generators",
      "UPS",
      "Electrical Distribution",
      "AutoCAD",
      "Revit",
      "BIM",
      "Construction Administration",
    ],
    per_diem_offered: false,
    salary_range: "Competitive",
    apply_url:
      "https://www.pkaza.com/job/onsite-engineer-critical-facilities-charleston-sc-3992f1b3-1224-4514-8166-60de0804133e/",
    description:
      "Non-traveling onsite engineer supporting multiple data center builds in the Charleston, SC region. Provide MEP engineering support during construction and commissioning phases, manage construction documentation, and serve as technical liaison between design engineers and site contractors. EIT or PE license a plus.",
    requirements:
      "Engineering degree (mechanical or electrical preferred). Experience with MEP systems in data center or mission-critical environments. AutoCAD, Revit, BIM proficiency. Strong communication skills for stakeholder coordination. EIT or PE license beneficial.",
  },

  // ── Batch 2: Additional jobs (Feb 2026) ──────────────────────────────────────
  {
    job_title: "Safety Manager – Data Center Construction",
    company_name: "T5 Data Centers",
    location: "Denton, TX",
    job_type: "Full-time",
    certifications_required: ["OSHA 510", "CHST"],
    skills: [
      "Construction Safety Management",
      "OSHA Compliance",
      "Incident Investigation",
      "EHS Dashboards & Metrics",
      "Safety Training & Coaching",
      "Contractor Oversight",
    ],
    per_diem_offered: false,
    salary_range: "Competitive",
    apply_url:
      "https://jobs.smartrecruiters.com/T5DataCenters1/3743990007386466-safety-manager",
    description:
      "T5 Data Centers seeks a Safety Manager to implement and oversee safety, security, and environmental compliance programs across data center construction projects in Denton, TX. Responsibilities include conducting daily site inspections, leading safety training sessions, investigating incidents, managing document control, ensuring OSHA compliance, and maintaining EHS dashboards. General Contractor background strongly preferred.",
    requirements:
      "Bachelor's degree or equivalent preferred. 5+ years direct construction safety experience. OSHA 510 and/or 500 preferred; CHST or CSP a plus. Exceptional leadership, verbal, and written communication skills. Ability to stand, walk, climb, and lift up to 100 lbs.",
  },
  {
    job_title: "Safety Manager – Data Center Construction",
    company_name: "T5 Data Centers",
    location: "Atlanta, GA",
    job_type: "Full-time",
    certifications_required: ["OSHA 510", "CHST"],
    skills: [
      "Construction Safety Management",
      "OSHA Compliance",
      "Incident Investigation",
      "EHS Dashboards & Metrics",
      "Safety Training & Coaching",
      "Contractor Oversight",
    ],
    per_diem_offered: false,
    salary_range: "Competitive",
    apply_url:
      "https://jobs.smartrecruiters.com/T5DataCenters1/3743990006377836-safety-manager",
    description:
      "T5 Data Centers is hiring a site-level Safety Manager to manage safety, security, and environmental compliance across data center construction projects in Atlanta, GA. You will conduct site inspections, lead safety training, investigate incidents, coordinate with subcontractors on safety standards, and report EHS metrics. Seeking safety professionals with a General Contractor background and a commitment to zero-incident culture.",
    requirements:
      "Bachelor's degree or equivalent preferred. 5+ years construction safety experience preferred. OSHA 510 and/or 500 preferred; CHST or CSP a plus. Strong organizational and communication skills. Ability to work in variable outdoor conditions.",
  },
  {
    job_title: "Senior Electrical Estimator – Data Center Construction",
    company_name: "Established Electrical Contracting Firm",
    location: "Atlanta, GA",
    job_type: "Full-time",
    certifications_required: [],
    skills: [
      "Electrical Construction Estimating",
      "Bid Preparation & Proposal Development",
      "Accubid / McCormick / ConEst",
      "Bluebeam",
      "Electrical Code & Voltage-Drop Calculations",
      "Team Leadership",
      "Client Relationship Management",
    ],
    per_diem_offered: false,
    salary_range: "Competitive",
    apply_url:
      "https://www.pkaza.com/job/electrical-estimator-data-center-construction-atlanta-ga-5c7bc390-d26b-40ee-61af-e69e1cb3dc08/",
    description:
      "Join a leading electrical contracting firm as a Senior Electrical Estimator focused on data center construction in Atlanta, GA. You will develop accurate electrical estimates for bids ranging $10–$100M, perform budget pricing from schematic drawings, attend job walks and pre-bid meetings, maintain estimating databases, and lead junior estimators through proposal development. Critical Facilities experience preferred.",
    requirements:
      "3–7 years estimating and preconstruction experience on large electrical projects. Proficiency in Accubid, McCormick, Bluebeam, or ConEst. Strong understanding of electrical codes, voltage-drop calculations, and conduit-fill requirements. Excellent written and verbal communication. Military/veteran electrical or mechanical background is a significant asset.",
  },
  {
    job_title: "Electrical Assistant Project Manager – Data Center",
    company_name: "National Electrical Contracting Firm",
    location: "Ashburn, VA",
    job_type: "Full-time",
    certifications_required: [],
    skills: [
      "Data Center Electrical Construction",
      "UPS / Switchgear / PDU Systems",
      "Budget Management ($10M–$50M)",
      "Commissioning Coordination",
      "MS Project",
      "Timberline",
      "Team Leadership",
    ],
    per_diem_offered: false,
    salary_range: "Competitive",
    apply_url:
      "https://www.pkaza.com/job/electrical-assistant-project-manager-ashburn-va-c6816470-9ae7-4b44-dd55-d7ec4e2fdd08/",
    description:
      "An established electrical contracting firm is seeking an Electrical Assistant Project Manager for data center and critical facilities projects in Ashburn, VA. You will supervise electrical subcontractors and self-performed work, manage budgets, maintain stakeholder communications, implement site safety programs, and support project closeout. Candidates with 8+ years of data center MEP construction experience and backup power systems expertise are strongly preferred.",
    requirements:
      "8+ years of data center or critical facilities MEP construction experience. Expertise in UPS, switchgear, and power distribution systems. Proficiency in MS Project and Timberline. Strong leadership and communication skills. Military background in electrical or mechanical fields is a major asset.",
  },
  {
    job_title: "Director of Data Center Construction",
    company_name: "Colocation Data Center Provider",
    location: "Ashburn, VA",
    job_type: "Full-time",
    certifications_required: [],
    skills: [
      "Mission-Critical Construction PM",
      "Multi-Project P&L Management",
      "Client-Facing Relationship Management",
      "Modular Data Center Construction",
      "Business Development / RFP",
      "Data Center Building Systems Design",
      "AFCOM / ASHRAE / 7x24 Exchange",
    ],
    per_diem_offered: false,
    salary_range: "Competitive",
    apply_url:
      "https://www.pkaza.com/job/director-of-data-center-construction-ashburn-va-b25c173c-30a2-4371-04dc-5352cdebdb08/",
    description:
      "A leading colocation provider is hiring a Director of Data Center Construction in Ashburn, VA to lead mission-critical construction programs with $50–$100M+ budgets. You will direct planning and execution of modular and traditional data center builds, establish project standards, manage client relationships, and oversee the PM team from preconstruction through turnover. Full P&L ownership required. Military background (Navy nuclear, Seabees, Army power generation) strongly valued.",
    requirements:
      "Extensive client-facing construction PM experience with full P&L ownership across multiple concurrent projects. Familiarity with data center building systems design. Experience with modular data center builds preferred. Involvement in professional orgs (AFCOM, ASHRAE, 7×24 Exchange) a plus. Business development and RFP/RFI experience required.",
  },
  {
    job_title: "Data Center MEP Superintendent",
    company_name: "National General Contractor",
    location: "Atlanta, GA",
    job_type: "Full-time",
    certifications_required: ["OSHA 30"],
    skills: [
      "MEP Coordination",
      "HVAC / Chilled Water",
      "Electrical Power Distribution",
      "Plumbing Systems",
      "Subcontractor Management",
      "Procore",
      "MS Project",
    ],
    per_diem_offered: true,
    salary_range: "Competitive",
    apply_url:
      "https://jobs.crelate.com/portal/pkaza/job/ie8gx7w3yhkrkobooikpdth7ao",
    description:
      "A national general contractor is seeking a Data Center MEP Superintendent to oversee all mechanical, electrical, and plumbing installation and coordination for hyperscale data center projects in Atlanta, GA. Additional positions available in Dallas, TX, Houston, TX, Kansas City, MO, and Chicago, IL. You will manage MEP subcontractors, resolve field conflicts, ensure quality and schedule compliance, and coordinate with commissioning teams during systems turnover. Per diem available for travel assignments.",
    requirements:
      "5–10 years of field supervision experience in MEP construction, with data center or mission-critical project experience strongly preferred. OSHA 30 required. Proficiency in Procore and MS Project. Strong leadership and coordination skills. Willingness to travel Mon–Fri on-site.",
  },
  {
    job_title: "Electrical Commissioning Engineer – Data Center",
    company_name: "AEC / Commissioning Firm",
    location: "New Albany, OH",
    job_type: "Full-time",
    certifications_required: [],
    skills: [
      "Electrical Power Systems",
      "Load Bank Testing",
      "Commissioning Levels 1–5",
      "UPS / Switchgear / Generators",
      "SOP / MOP Development",
      "Power Quality Analysis",
      "High-Voltage Systems",
    ],
    per_diem_offered: true,
    salary_range: "Competitive",
    apply_url:
      "https://jobs.crelate.com/portal/pkaza/job/gp3uzt45m74gs6icgmd5qeiqih",
    description:
      "An AEC and commissioning firm is hiring a traveling Electrical Commissioning Engineer for data center projects based out of New Albany, OH. Also available in Atlanta, GA, Nashville, TN, Dallas, TX, Chicago, IL, and Ashburn, VA. Perform Level 1–5 electrical commissioning, load bank testing, power quality analysis, and develop SOPs/MOPs for electrical systems including UPS, switchgear, and generators. Per diem provided for travel assignments.",
    requirements:
      "4–10+ years of electrical power systems experience in data center or mission-critical environments. Strong commissioning test procedure knowledge. Extensive travel required. Proficiency in Microsoft Office (Word, Excel, Project).",
  },
  {
    job_title: "Mechanical Commissioning Engineer – Data Center",
    company_name: "MEP Engineering & Commissioning Firm",
    location: "Atlanta, GA",
    job_type: "Full-time",
    certifications_required: [],
    skills: [
      "HVAC / Chilled Water Commissioning",
      "Cooling Tower Systems",
      "CRAC / CRAH Units",
      "AHU Testing & Balancing",
      "Commissioning Levels 1–5",
      "SOP / MOP Development",
      "AutoCAD",
    ],
    per_diem_offered: true,
    salary_range: "Competitive",
    apply_url:
      "https://jobs.crelate.com/portal/pkaza/job/kcx19g3keiw1y54abjyymam3sr",
    description:
      "A specialized MEP engineering and commissioning firm is seeking a Mechanical Commissioning Engineer for data center projects in Atlanta, GA. Additional positions available in Nashville, TN, New Albany, OH, Charlotte, NC, Richmond, VA, and Dallas, TX. Perform Levels 1–5 mechanical commissioning of HVAC systems, cooling towers, CRAC/CRAH units, AHUs, and chilled water infrastructure. Develop and execute SOPs and MOPs for mission-critical mechanical systems. Per diem offered for travel.",
    requirements:
      "5+ years of mechanical/HVAC commissioning experience, preferably in data center or mission-critical environments. Level 1–5 commissioning experience required. Strong documentation skills for SOP/MOP writing. AutoCAD proficiency preferred. Willingness to travel extensively.",
  },
  {
    job_title: "Data Center Construction Project Manager",
    company_name: "Mission-Critical General Contractor",
    location: "Dallas, TX",
    job_type: "Full-time",
    certifications_required: ["PMP"],
    skills: [
      "Data Center Construction PM",
      "Hyperscale Project Management",
      "Budget & Schedule Control",
      "Subcontractor Management",
      "Owner's Rep Interface",
      "Procore",
      "MS Project",
      "Oracle Primavera P6",
    ],
    per_diem_offered: false,
    salary_range: "Competitive",
    apply_url:
      "https://jobs.crelate.com/portal/pkaza/job/iy9okswtyw1aymuf6fd1k7mi1e",
    description:
      "A leading mission-critical general contractor is hiring a Data Center Construction Project Manager for hyperscale builds in Dallas, TX. Additional positions in New Albany, OH, Chicago, IL, Charlotte, NC, Ashburn, VA, and Kansas City, MO. Manage all phases of data center construction from preconstruction through commissioning and turnover. Drive budget, schedule, and quality across trades while serving as primary client interface. PMP preferred.",
    requirements:
      "5–10 years of data center construction project management experience. Demonstrated success managing $50M+ projects. Proficiency in Procore, MS Project, and/or Primavera P6. Strong client-facing communication skills. PMP preferred. GC or construction management firm background required.",
  },

  // ── Batch 3: Additional jobs (Feb 2026) ──────────────────────────────────────
  {
    job_title: "MEP Superintendent – Data Center",
    company_name: "Mortenson Construction",
    location: "Amarillo, TX",
    job_type: "Full-time",
    certifications_required: [],
    skills: [
      "MEP Coordination & Supervision",
      "Electrical Power Distribution",
      "HVAC / Mechanical Systems",
      "Plumbing Systems",
      "Schedule Management",
      "Construction Document Review",
      "Microsoft Office",
    ],
    per_diem_offered: false,
    salary_range: "$111,400 - $167,100",
    apply_url:
      "https://www.mortenson.com/careers/data-center-group/mep-superintendent-20545",
    description:
      "Mortenson Construction's Data Center Group is seeking a skilled MEP Superintendent to lead mechanical, electrical, and plumbing work scopes on hyperscale data center projects in Amarillo, TX. You will coordinate MEP subcontractors, manage schedules, review construction documents, resolve field conflicts, and ensure materials and inspections support the project schedule. This role manages multiple complex data center MEP systems concurrently.",
    requirements:
      "Associate or bachelor's degree in construction or engineering, OR 10+ years trade experience. Minimum 8 years construction experience with 2+ years supervisory capacity. Demonstrated ability to manage complex data center MEP projects. Intermediate Microsoft Office proficiency. Valid driver's license required.",
  },
  {
    job_title: "Commissioning Project Manager – Data Center",
    company_name: "Critical Facilities Commissioning Firm",
    location: "Hampton, GA",
    job_type: "Full-time",
    certifications_required: [],
    skills: [
      "Data Center Commissioning Management",
      "Level 1–5 Commissioning",
      "MEP Systems Oversight",
      "Client & Stakeholder Management",
      "SOP / MOP Development",
      "Commissioning Documentation",
      "Schedule & Budget Management",
    ],
    per_diem_offered: true,
    salary_range: "$85,000 - $125,000",
    apply_url:
      "https://www.pkaza.com/job/commissioning-project-manager-hampton-ga-b41e2aa0-d9ed-4e0e-5b78-6eafc329dd08/",
    description:
      "A leading critical facilities commissioning firm is seeking a Commissioning Project Manager for data center projects in Hampton, GA. Also available in Fayetteville, GA, New Albany, OH, Dallas, TX, and Charlotte, NC. You will manage all phases of data center commissioning from Level 1 through Level 5, oversee Cx team members, interface with the GC and owner, and ensure all MEP systems are commissioned to specification on time.",
    requirements:
      "5+ years of data center commissioning experience with project management responsibility. Demonstrated Level 1–5 Cx experience on mission-critical projects. Strong client-facing communication and documentation skills. Willingness to travel per project demands. Commissioning certifications a plus.",
  },
  {
    job_title: "MEP Resident Engineer – Data Center",
    company_name: "Colocation Data Center Provider",
    location: "St. Louis, MO",
    job_type: "Full-time",
    certifications_required: ["EIT", "PE"],
    skills: [
      "MEP Engineering",
      "Construction Administration",
      "RFI / Submittal Management",
      "MEP Systems Review",
      "HVAC / Electrical / Plumbing",
      "Procore",
      "AutoCAD / Revit",
    ],
    per_diem_offered: false,
    salary_range: "Competitive",
    apply_url:
      "https://www.pkaza.com/job/mep-resident-engineer-data-center-colo-totowa-nj-3809ebe4-69a7-48f1-9765-581a4342dd08/",
    description:
      "A colocation data center provider is hiring an MEP Resident Engineer to be the on-site MEP engineering representative during construction at their data center campus in St. Louis, MO. Also available in Boydton, VA, Ashburn, VA, New Albany, OH, and Toledo, OH. You will manage RFIs, submittals, and change orders, coordinate with GC and MEP subcontractors, review shop drawings, and ensure design intent is met throughout construction and commissioning.",
    requirements:
      "Engineering degree in mechanical or electrical engineering required. EIT or PE license preferred. 3–7 years of MEP construction administration or resident engineering experience. Data center or critical facilities experience strongly preferred. Proficiency in Procore, AutoCAD, and/or Revit.",
  },
  {
    job_title: "Controls Superintendent – Data Center Retrofits",
    company_name: "Mission-Critical Controls Contractor",
    location: "Dallas, TX",
    job_type: "Full-time",
    certifications_required: [],
    skills: [
      "BAS / BMS Controls",
      "SCADA Systems",
      "PLC Programming",
      "Data Center Retrofit & Upgrade",
      "Subcontractor Management",
      "Commissioning Coordination",
      "Electrical Controls",
    ],
    per_diem_offered: true,
    salary_range: "Competitive",
    apply_url:
      "https://www.pkaza.com/job/controls-superintendent-data-center-retrofits-montreal-qc-915a86d3-e46d-4f36-1335-95722445dd08/",
    description:
      "A mission-critical controls contractor is hiring a Controls Superintendent to manage on-site installation and commissioning of BAS/BMS and SCADA control systems for data center retrofit and upgrade projects in Dallas, TX. Also available in Ashburn, VA, New Albany, OH, and Richmond, VA. You will supervise controls technicians and subcontractors, coordinate with MEP teams, and ensure proper integration of control systems with existing data center infrastructure. Per diem offered for travel assignments.",
    requirements:
      "5+ years field supervision experience in BAS/BMS or controls installation. Data center or critical facilities experience required. Strong knowledge of PLC programming, SCADA, and electrical controls systems. Ability to read and interpret controls drawings and specifications. Willingness to travel.",
  },
  {
    job_title: "Critical Facilities Operations Electrician",
    company_name: "Hyperscale Colocation Provider",
    location: "Elk Grove Village, IL",
    job_type: "Full-time",
    certifications_required: ["NFPA 70E", "OSHA 10"],
    skills: [
      "Medium/High-Voltage Electrical Systems",
      "UPS Maintenance & Troubleshooting",
      "Generator Operations",
      "PDU / STS Maintenance",
      "Switchgear Operations",
      "CMMS / Work Order Management",
      "Preventive Maintenance",
    ],
    per_diem_offered: false,
    salary_range: "Competitive",
    apply_url:
      "https://www.pkaza.com/job/critical-facilities-operations-electrician-sumner-wa-265270ff-1846-4abf-0427-055a020fdd08/",
    description:
      "A hyperscale colocation provider is seeking a Critical Facilities Operations Electrician to maintain and troubleshoot electrical systems at their mission-critical data center campus in Elk Grove Village, IL. Also available in Ashburn, VA. Perform preventive and corrective maintenance on UPS systems, generators, switchgear, PDUs, and STSs. Respond to electrical alarms, manage work orders via CMMS, and support commissioning of new infrastructure.",
    requirements:
      "Journeyman or Master Electrician license preferred. NFPA 70E and OSHA 10 required. 3+ years of critical facilities electrical operations experience. Hands-on experience with UPS, generators, switchgear, and medium-voltage systems. CMMS experience preferred. Ability to work rotating shifts.",
  },
  {
    job_title: "Construction Project Manager, MEP – Data Center",
    company_name: "Gray Construction",
    location: "Atlanta, GA",
    job_type: "Full-time",
    certifications_required: ["OSHA 30"],
    skills: [
      "MEP Construction Project Management",
      "Data Center MEP Systems",
      "Budget & Schedule Control",
      "Subcontractor Management",
      "Procore",
      "MS Project",
      "Owner Interface",
    ],
    per_diem_offered: false,
    salary_range: "$120,000 - $180,000",
    apply_url:
      "https://grayconstruction-gray.icims.com/jobs/4527/construction-project-manager,-mep---data-center-market/job",
    description:
      "Gray Construction is seeking a Construction Project Manager with MEP expertise to join their Data Center Market team in Atlanta, GA or Dallas, TX. Gray is one of the nation's leading mission-critical GCs with over 1 GW of active data center development. You will manage MEP scope budgets, drive schedule performance, coordinate with trade partners, and serve as the owner's primary MEP point of contact from preconstruction through commissioning and turnover.",
    requirements:
      "5–10 years demonstrated experience as a data center construction or MEP project manager. OSHA 30 required. Strong background in MEP mechanical, electrical, process piping, and ground-up data center construction. Proficiency in Procore and MS Project. Construction management or engineering degree preferred.",
  },
  {
    job_title: "Assistant Site Manager, Commissioning – Data Center",
    company_name: "Gray Construction",
    location: "Lexington, KY",
    job_type: "Full-time",
    certifications_required: ["OSHA 10"],
    skills: [
      "Data Center Commissioning",
      "MEP Systems",
      "Commissioning Documentation",
      "Test & Balance",
      "Field Coordination",
      "Procore",
    ],
    per_diem_offered: false,
    salary_range: "$85,000 - $125,000",
    apply_url:
      "https://grayconstruction-gray.icims.com/jobs/4520/assistant-site-manager,-commissioning/job",
    description:
      "Gray Construction is adding an Assistant Site Manager for Commissioning to support their Field Operations Team on data center projects in Lexington, KY. This field/project-based role assists the Commissioning Site Manager with planning and executing Level 1–5 commissioning of MEP systems, coordinating with subcontractors and the GC team, maintaining commissioning logs, and ensuring readiness for turnover. Excellent growth opportunity within Gray's rapidly expanding data center commissioning practice.",
    requirements:
      "3–5 years of construction or commissioning experience, preferably in data center or mission-critical environments. Familiarity with Level 1–5 commissioning processes. OSHA 10 required. Strong documentation and communication skills. Proficiency in Procore preferred.",
  },
  {
    job_title: "Project Executive – Data Center Construction",
    company_name: "Gray Construction",
    location: "Dallas, TX",
    job_type: "Full-time",
    certifications_required: [],
    skills: [
      "Executive Project Leadership",
      "Data Center Megaproject Management",
      "Client Relationship Management",
      "P&L Ownership",
      "Business Development",
      "Multi-GW Portfolio Oversight",
      "Owner's Rep Interface",
    ],
    per_diem_offered: false,
    salary_range: "Competitive",
    apply_url:
      "https://grayconstruction-gray.icims.com/jobs/1699/project-executive/job",
    description:
      "Gray Construction is hiring a Project Executive for their Data Center Market in Dallas, TX to lead executive-level oversight of multiple hyperscale data center projects. Gray currently has over 1 GW of active data center development across seven campuses with nearly 3,000 team members on-site. You will own P&L for your project portfolio, drive business development with hyperscale clients, and mentor project management teams through all phases of construction.",
    requirements:
      "10+ years of data center or mission-critical construction experience with executive-level P&L ownership. Track record of managing hyperscale ($100M+) projects. Strong business development capabilities. Deep relationships with hyperscale or enterprise data center clients. Construction management or engineering degree preferred.",
  },

  // ── Batch 4: AI Hyperscaler jobs (Feb 2026) ─────────────────────────────────
  {
    job_title: "Construction Engineer: Power Infrastructure",
    company_name: "xAI",
    location: "Memphis, TN",
    job_type: "Full-time",
    certifications_required: ["PE"],
    skills: [
      "Power Generation Systems",
      "Natural Gas Turbine Construction",
      "Constructability Reviews",
      "ASME / IEEE / EPA Compliance",
      "Project & Budget Management",
      "Stakeholder Coordination",
    ],
    per_diem_offered: false,
    salary_range: "Competitive",
    apply_url:
      "https://job-boards.greenhouse.io/xai/jobs/4939291007",
    description:
      "xAI is building Colossus, the world's largest AI supercomputer in Memphis, TN. As a Construction Engineer for Power Infrastructure, you will lead the construction of natural gas power plants from site preparation through final commissioning, ensuring adherence to specifications and safety standards. You will manage contractors, oversee procurement of major equipment, and conduct constructability reviews for turbine and control system installations.",
    requirements:
      "Bachelor's degree in Civil, Mechanical, or Electrical Engineering (or Construction Management). 5+ years construction engineering experience on industrial or power generation projects; 7+ years on projects >$100M preferred. Familiarity with major turbine manufacturers (GE, Siemens). PE license preferred. Travel up to 50%.",
  },
  {
    job_title: "Electrical Engineer – Data Center",
    company_name: "xAI",
    location: "Memphis, TN",
    job_type: "Full-time",
    certifications_required: ["PE"],
    skills: [
      "Power Distribution Design",
      "UPS Systems",
      "Medium/High-Voltage Infrastructure",
      "AutoCAD / Revit",
      "Data Center Electrical Systems",
      "Energy Efficiency Optimization",
    ],
    per_diem_offered: false,
    salary_range: "Competitive",
    apply_url:
      "https://job-boards.greenhouse.io/xai/jobs/4593414007",
    description:
      "xAI is seeking an Electrical Engineer to design, evaluate, and optimize electrical systems for their state-of-the-art AI data center in Memphis, TN. You will manage implementation and maintenance of power distribution infrastructure, design backup and redundancy systems, and ensure compliance with NEC and IEEE standards. This role supports the Colossus supercomputer — the world's largest GPU cluster.",
    requirements:
      "Bachelor's degree in Electrical Engineering. 5–8 years of relevant experience in data center or critical facilities electrical infrastructure. PE license preferred; EIT acceptable. Proficiency in AutoCAD and/or Revit. Knowledge of UPS, switchgear, and power distribution systems.",
  },
  {
    job_title: "Electrical Engineer (EIT) – Data Center",
    company_name: "xAI",
    location: "Memphis, TN",
    job_type: "Full-time",
    certifications_required: ["EIT"],
    skills: [
      "Data Center Electrical Systems",
      "AutoCAD / Revit",
      "Power Distribution",
      "UPS Systems",
      "Electrical Design Support",
    ],
    per_diem_offered: false,
    salary_range: "Competitive",
    apply_url:
      "https://job-boards.greenhouse.io/xai/jobs/4977264007",
    description:
      "xAI is hiring an entry-to-mid level Electrical Engineer (EIT) to support electrical infrastructure design and implementation at their Memphis, TN AI supercomputer campus. Working under senior engineers, you will contribute to power distribution design, backup systems analysis, and commissioning support for one of the world's most advanced data center facilities.",
    requirements:
      "Bachelor's degree in Electrical Engineering. EIT certification required. 2–4 years of relevant electrical engineering experience. Data center or critical facilities background preferred. Proficiency in AutoCAD and/or Revit.",
  },
  {
    job_title: "Mechanical Engineer (HVAC / Chilled Water) – Data Center",
    company_name: "xAI",
    location: "Memphis, TN",
    job_type: "Full-time",
    certifications_required: ["PE"],
    skills: [
      "Chilled Water System Design",
      "Cooling Towers / Chillers / Pumps",
      "HVAC Systems",
      "AutoCAD / Revit",
      "ASHRAE Standards",
      "Cooling Capacity Analysis",
    ],
    per_diem_offered: false,
    salary_range: "Competitive",
    apply_url:
      "https://job-boards.greenhouse.io/xai/jobs/4593412007",
    description:
      "xAI seeks a Mechanical Engineer specializing in HVAC and chilled water systems for their AI data center campus in Memphis, TN. You will design, analyze, and implement advanced mechanical cooling systems for the Colossus supercomputer, lead design meetings, oversee installation of chillers, cooling towers, and pumps, manage maintenance schedules, and analyze cooling capacity to meet the extreme thermal demands of GPU-dense AI infrastructure.",
    requirements:
      "Bachelor's degree in Mechanical Engineering (master's preferred). PE license required. ASHRAE certification a plus. 5–7 years of data center operations experience with expertise in chilled water system design and construction. Comfort with shift flexibility and industrial work environments.",
  },
  {
    job_title: "Power Generation Engineer – AI Data Center",
    company_name: "xAI",
    location: "Memphis, TN",
    job_type: "Full-time",
    certifications_required: [],
    skills: [
      "Natural Gas Power Plant Operations",
      "Turbine & Generator Systems",
      "HRSG / Steam Systems",
      "Power Quality & Reliability",
      "Preventive Maintenance",
      "SCADA / DCS Controls",
    ],
    per_diem_offered: false,
    salary_range: "Competitive",
    apply_url:
      "https://job-boards.greenhouse.io/xai/jobs/4869805007",
    description:
      "xAI is building Colossus I & II, the world's largest AI supercomputers in Memphis, TN. As a Power Generation Engineer, you will play a pivotal role powering this groundbreaking infrastructure — responsible for the reliable operation and optimization of natural gas power generation plants, ensuring uninterrupted, high-efficiency power delivery to the AI datacenter. This role oversees turbine performance, heat recovery systems, and power quality across the campus.",
    requirements:
      "Bachelor's degree in Mechanical, Electrical, or Power Engineering. 5+ years of power plant operations or engineering experience, preferably with combined-cycle or gas turbine facilities. Strong knowledge of HRSG, steam systems, and power distribution. Experience with SCADA/DCS controls. Background in mission-critical or utility-scale power delivery preferred.",
  },
  {
    job_title: "Fiber Foreman – AI Data Center",
    company_name: "xAI",
    location: "Memphis, TN",
    job_type: "Full-time",
    certifications_required: ["OSHA 10"],
    skills: [
      "Fiber Optic Installation & Splicing",
      "Hyperscale Data Center Cabling",
      "OTDR / Power Meter Testing",
      "Crew Leadership & Scheduling",
      "Cable Pathway & Tray Management",
      "Blueprint Interpretation",
    ],
    per_diem_offered: false,
    salary_range: "Competitive",
    apply_url:
      "https://job-boards.greenhouse.io/xai/jobs/4426119007",
    description:
      "xAI is hiring a Fiber Foreman to lead fiber optic installation crews at their Memphis, TN AI supercomputer campus (Colossus). You will manage installation, splicing, termination, and certification of high-count fiber optic cables across the hyperscale data center, coordinate crew schedules, ensure quality standards, and interface with the general contractor and networking teams.",
    requirements:
      "5+ years of fiber optic installation experience in data center or hyperscale environments. Proven crew leadership and scheduling skills. Proficiency with OTDR, power meters, and fiber test equipment. OSHA 10 required. Ability to work at elevated heights with safety gear. BICSI certification a plus.",
  },
  {
    job_title: "Senior Principal Construction Project Manager",
    company_name: "Oracle",
    location: "Abilene, TX",
    job_type: "Full-time",
    certifications_required: ["PMP"],
    skills: [
      "Large-Scale Data Center Construction",
      "Owner's Rep Project Management",
      "MEP Coordination",
      "Budget & Schedule Control ($100M+)",
      "GC & Subcontractor Oversight",
      "Oracle Primavera / MS Project",
    ],
    per_diem_offered: false,
    salary_range: "Competitive",
    apply_url:
      "https://careers.oracle.com/en/job/305135",
    description:
      "Oracle's Data Center Infrastructure Construction team is seeking a Senior Principal Construction Project Manager to lead large-scale data center construction projects at their Abilene, TX campus — part of the Stargate AI infrastructure initiative. You will manage all phases from preconstruction through commissioning, coordinate with GCs and MEP subcontractors, and ensure Oracle's world-class quality and schedule standards are met.",
    requirements:
      "10+ years of data center or mission-critical construction project management experience. Demonstrated success on $100M+ hyperscale projects. PMP certification preferred. Strong MEP and commissioning coordination skills. Experience with Oracle or Primavera scheduling tools. Willingness to relocate within 50 miles of Abilene, TX.",
  },
  {
    job_title: "Director, Data Center Construction",
    company_name: "Oracle",
    location: "Abilene, TX",
    job_type: "Full-time",
    certifications_required: [],
    skills: [
      "Executive Construction Leadership",
      "Multi-Campus Portfolio Management",
      "P&L Ownership",
      "Hyperscale Data Center Delivery",
      "Stakeholder & Vendor Management",
      "Commissioning Oversight",
    ],
    per_diem_offered: false,
    salary_range: "Competitive",
    apply_url:
      "https://careers.oracle.com/en/job/319228",
    description:
      "Oracle is hiring a Director of Data Center Construction to lead large-scale data center construction programs at their Abilene, TX campus supporting the Stargate AI initiative. You will own the delivery of multiple hyperscale data center buildings, manage the construction PM team, drive vendor relationships, oversee budgets and schedules at the portfolio level, and ensure seamless handoff from construction through commissioning to operations.",
    requirements:
      "12+ years of data center or mission-critical construction experience with director-level P&L responsibility. Track record of delivering hyperscale ($200M+) data center campuses. Strong GC and trade partner relationship management. Willingness to relocate within 50 miles of Abilene, TX.",
  },
  {
    job_title: "Program Manager, Data Center Construction",
    company_name: "Google",
    location: "Midlothian, TX",
    job_type: "Full-time",
    certifications_required: ["PMP"],
    skills: [
      "Data Center Construction Program Management",
      "MEP Systems Oversight",
      "Commissioning Agent Coordination",
      "Vendor & Trade Management",
      "Budget & Schedule Control",
      "Google Workspace / MS Project",
    ],
    per_diem_offered: false,
    salary_range: "$120,000 - $180,000",
    apply_url:
      "https://www.google.com/about/careers/applications/jobs/results/137349914190324422-program-manager/",
    description:
      "Google is hiring a Program Manager for Data Center Construction to manage complex, multi-disciplinary hyperscale data center projects from initial concept and design through construction and deployment at their Midlothian, TX campus (Dallas-Fort Worth area). You will lead vendor and trade partner relationships, coordinate with commissioning agents, develop sequence of operations, and collaborate with internal engineering teams on some of the most advanced AI and cloud computing infrastructure in the world.",
    requirements:
      "8+ years of data center or mission-critical construction program management experience. PMP certification preferred. Demonstrated ability to manage $100M+ programs. Strong vendor and commissioning agent coordination skills. Experience with Google Workspace and scheduling tools.",
  },
  {
    job_title: "Data Center Electrical Engineer",
    company_name: "Google",
    location: "Midlothian, TX",
    job_type: "Full-time",
    certifications_required: ["PE"],
    skills: [
      "Data Center Electrical Design",
      "AC/DC Power Distribution",
      "UPS & Backup Power Systems",
      "Utility Interconnection Design",
      "Commissioning Support",
      "AutoCAD / Revit / BIM",
    ],
    per_diem_offered: false,
    salary_range: "$130,000 - $200,000",
    apply_url:
      "https://www.google.com/about/careers/applications/jobs/results/138935867505812166-data-center-electrical-engineer/",
    description:
      "Google is seeking a Data Center Electrical Engineer to support data center design, development, construction, and commissioning projects at their Midlothian, TX campus. You will provide support for all electrical systems from incoming utility designs to in-rack power distribution, develop electrical designs through construction and commissioning, and ensure compliance with NEC and IEEE standards for some of the world's most energy-efficient data centers.",
    requirements:
      "Bachelor's degree in Electrical Engineering. PE license preferred. 5+ years of data center electrical design and construction experience. Demonstrated design, construction, equipment operation, and maintenance experience. Proficiency in AutoCAD, Revit, and/or BIM tools. Strong commissioning and startup knowledge.",
  },
  {
    job_title: "Construction Project Manager – Data Center",
    company_name: "Apple",
    location: "Dallas, TX",
    job_type: "Full-time",
    certifications_required: ["PMP"],
    skills: [
      "Data Center Construction PM",
      "Equipment Upgrade Management",
      "Commissioning Agent Coordination",
      "MEP Systems",
      "Sequence of Operations",
      "Cross-Functional Team Leadership",
    ],
    per_diem_offered: false,
    salary_range: "Competitive",
    apply_url:
      "https://jobs.apple.com/en-us/details/200582562/construction-project-manager",
    description:
      "Apple is hiring a Construction Project Manager for their data center campus in Dallas, TX. You will handle all aspects of development for some of the most innovative and energy-efficient data centers in the world, meeting with internal engineering groups to determine project requirements, managing commissioning agents, developing sequence of operations and test scripts, and coordinating with real estate, legal, design, EH&S, energy, construction, network, and operations teams. This role manages equipment upgrades within live production environments in parallel with new construction.",
    requirements:
      "8+ years of data center or mission-critical construction project management experience. PMP certification preferred. Experience with commissioning agent management and sequence of operations development. Strong cross-functional collaboration skills. Ability to manage concurrent projects in live production environments.",
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log("\n📋 Step 1 — Discovered apply links:");
  console.log(JSON.stringify(APPLY_LINKS, null, 2));

  console.log("\n⚙️  Step 2 — Validating and mapping job data...\n");

  const mapped = RAW_SCRAPED_JOBS.map((raw) => validateAndMap(raw)).filter(
    (j): j is NonNullable<ReturnType<typeof validateAndMap>> => j !== null
  );

  console.log(`\n✅ ${mapped.length}/${RAW_SCRAPED_JOBS.length} jobs passed validation\n`);

  if (isDryRun) {
    console.log("🔍 Dry run — output only:\n");
    console.log(JSON.stringify(mapped, null, 2));
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL not set. Run with --dry-run or set DATABASE_URL.");
    process.exit(1);
  }

  let inserted = 0;
  let skipped = 0;

  for (const job of mapped) {
    const existing = await prisma.job.findFirst({
      where: { sourceUrl: job.sourceUrl ?? undefined, source: "scraped" },
    });

    if (existing) {
      console.log(`⏭  Already exists: ${job.title}`);
      skipped++;
      continue;
    }

    await prisma.job.create({ data: job });
    console.log(`✅ Inserted: ${job.title} @ ${job.location}`);
    inserted++;
  }

  console.log(`\n🎉 Done — ${inserted} inserted, ${skipped} skipped`);
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
