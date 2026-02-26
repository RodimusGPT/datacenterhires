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
    // Pkaza Critical Facilities Recruiting
    "https://www.pkaza.com/job/electrical-commissioning-engineer-ashburn-va-dfeb4615-1b64-4c80-984e-4ade0804036f/",
    "https://www.pkaza.com/job/electrical-project-manager-data-center-construction-augusta-ga-fc7894c2-85dd-4595-9e24-60de08044740/",
    "https://www.pkaza.com/job/mechanical-superintendent-data-center-construction-chesterton-in-5a2eb7f2-b9ef-4d5b-ba33-60de08044944/",
    "https://www.pkaza.com/job/onsite-engineer-critical-facilities-charleston-sc-3992f1b3-1224-4514-8166-60de0804133e/",
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
            : job.apply_url?.includes("pkaza") ? "pkaza"
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
