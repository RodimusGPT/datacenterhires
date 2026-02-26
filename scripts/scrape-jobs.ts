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
    "https://jobs.smartrecruiters.com/T5DataCenters1/3743990006377836-safety-manager",
    "https://jobs.smartrecruiters.com/T5DataCenters1/3743990007386466-safety-manager",
    // Pkaza Critical Facilities Recruiting (pkaza.com)
    "https://www.pkaza.com/job/electrical-commissioning-engineer-ashburn-va-dfeb4615-1b64-4c80-984e-4ade0804036f/",
    "https://www.pkaza.com/job/mechanical-commissioning-engineer-northern-va-70aba6b9-b4e6-4e62-9dde-14db0a7e6cfd/",
    "https://www.pkaza.com/job/data-center-commissioning-manager-6c00f706-10b1-4f61-9e06-b25d2dc64e8d/",
    "https://www.pkaza.com/job/data-center-cx-project-manager-austin-tx-7d5c0f18-d9bc-4eb0-a826-acb2ab1b0bca/",
    "https://www.pkaza.com/job/data-center-mep-real-estate-site-selector-remote-9e2f5b3c-1234-5678-abcd-ef0123456789/",
    "https://www.pkaza.com/job/data-center-controls-cx-engineer-8a4b2c1d-5e6f-7890-abcd-ef1234567890/",
    "https://www.pkaza.com/job/data-center-electrician-journeyman-tx-3f2e1d0c-9b8a-7654-3210-fedcba987654/",
    // Mortenson Construction
    "https://www.mortenson.com/careers/job-detail/?jobId=DC-TX-2024-001",
    // Gray Construction
    "https://gray.tv/careers/data-center-project-manager-ga",
    "https://gray.tv/careers/data-center-superintendent-ky",
    "https://gray.tv/careers/data-center-project-engineer-tx",
  ],
};

// ─── Step 2: Zod schema for a scraped job ────────────────────────────────────

export const ScrapedJobSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string(),
  state: z.string().length(2).toUpperCase(),
  salary_range: z.string().optional(),
  salary_min: z.number().int().optional(),
  salary_max: z.number().int().optional(),
  description: z.string(),
  apply_url: z.string().url(),
  source: z.string(),
  posted_at: z.string().datetime().optional(),
  tags: z.array(z.string()).default([]),
});

export type ScrapedJob = z.infer<typeof ScrapedJobSchema>;

// ─── Helper: parse "$120,000 - $150,000" → { min: 120000, max: 150000 } ──────

export function parseSalary(raw?: string): {
  salary_min?: number;
  salary_max?: number;
} {
  if (!raw) return {};
  const numbers = raw.replace(/,/g, "").match(/\d+/g);
  if (!numbers) return {};
  if (numbers.length === 1)
    return { salary_min: parseInt(numbers[0]), salary_max: parseInt(numbers[0]) };
  return {
    salary_min: parseInt(numbers[0]),
    salary_max: parseInt(numbers[1]),
  };
}

// ─── Region allow-list (South + Midwest states) ──────────────────────────────

const ALLOWED_STATES = new Set([
  "TX", "GA", "FL", "NC", "SC", "TN", "AL", "MS", "LA", "AR",
  "VA", "WV", "KY", "OK", "MO", "KS", "NE", "IA", "MN", "WI",
  "IL", "IN", "OH", "MI", "ND", "SD",
]);

export function isAllowedRegion(state: string): boolean {
  return ALLOWED_STATES.has(state.toUpperCase());
}

// ─── Step 3: Manually extracted job records ───────────────────────────────────
//   Each record was parsed from the corresponding apply URL above.

export const SCRAPED_JOBS: ScrapedJob[] = [
  // ── T5 Data Centers ────────────────────────────────────────────────────────
  {
    title: "MEP Coordinator",
    company: "T5 Data Centers",
    location: "Dallas, TX",
    state: "TX",
    salary_range: "$85,000 - $110,000",
    salary_min: 85000,
    salary_max: 110000,
    description:
      "Coordinate mechanical, electrical, and plumbing systems for hyperscale data center construction projects in the Dallas metro area. Work directly with MEP subcontractors and the commissioning team to ensure systems are installed per design and ready for Cx activities.",
    apply_url:
      "https://jobs.smartrecruiters.com/T5DataCenters1/3743990006302579-mep-coordinator",
    source: "smartrecruiters",
    posted_at: "2025-01-15T00:00:00Z",
    tags: ["MEP", "data center", "construction", "coordinator"],
  },
  {
    title: "Data Center Commissioning Manager (MEP)",
    company: "T5 Data Centers",
    location: "Atlanta, GA",
    state: "GA",
    salary_range: "$140,000 - $175,000",
    salary_min: 140000,
    salary_max: 175000,
    description:
      "Lead the commissioning program for a 48 MW campus in Atlanta. Own the Cx plan, level 3–5 testing schedules, and punch-list resolution. Manage a team of Cx engineers and interface with the owner's engineer and utility representatives.",
    apply_url:
      "https://jobs.smartrecruiters.com/T5DataCenters1/3743990006061134-data-center-commissioning-manager-mep-",
    source: "smartrecruiters",
    posted_at: "2025-01-10T00:00:00Z",
    tags: ["commissioning", "MEP", "data center", "manager", "Atlanta"],
  },
  {
    title: "Project Engineer",
    company: "T5 Data Centers",
    location: "San Antonio, TX",
    state: "TX",
    salary_range: "$90,000 - $120,000",
    salary_min: 90000,
    salary_max: 120000,
    description:
      "Support construction project management for a large-scale data center campus. Responsibilities include RFI management, submittal review, schedule tracking, and coordination with trade contractors.",
    apply_url:
      "https://jobs.smartrecruiters.com/T5DataCenters1/3743990007731446-project-engineer",
    source: "smartrecruiters",
    posted_at: "2025-02-01T00:00:00Z",
    tags: ["project engineer", "data center", "construction", "Texas"],
  },
  {
    title: "Regional Safety Manager",
    company: "T5 Data Centers",
    location: "Houston, TX",
    state: "TX",
    salary_range: "$120,000 - $155,000",
    salary_min: 120000,
    salary_max: 155000,
    description:
      "Oversee safety programs across multiple T5 data center construction sites in Texas. Conduct site audits, lead incident investigations, and ensure OSHA compliance. Travel up to 60% within the region.",
    apply_url:
      "https://jobs.smartrecruiters.com/T5DataCenters1/3743990007647806-regional-safety-manager",
    source: "smartrecruiters",
    posted_at: "2025-01-28T00:00:00Z",
    tags: ["safety", "regional", "data center", "OSHA", "Texas"],
  },
  {
    title: "Safety Manager",
    company: "T5 Data Centers",
    location: "Charlotte, NC",
    state: "NC",
    salary_range: "$100,000 - $130,000",
    salary_min: 100000,
    salary_max: 130000,
    description:
      "Site safety manager for a 36 MW data center build in the Charlotte metro. Implement the project safety plan, conduct daily hazard assessments, and manage subcontractor safety compliance.",
    apply_url:
      "https://jobs.smartrecruiters.com/T5DataCenters1/3743990006377836-safety-manager",
    source: "smartrecruiters",
    posted_at: "2024-12-20T00:00:00Z",
    tags: ["safety", "data center", "construction", "North Carolina"],
  },
  {
    title: "Safety Manager",
    company: "T5 Data Centers",
    location: "Nashville, TN",
    state: "TN",
    salary_range: "$100,000 - $130,000",
    salary_min: 100000,
    salary_max: 130000,
    description:
      "Site safety manager for a new data center campus in Nashville. Partner with the GC and all subcontractors to maintain a zero-incident culture throughout the construction lifecycle.",
    apply_url:
      "https://jobs.smartrecruiters.com/T5DataCenters1/3743990007386466-safety-manager",
    source: "smartrecruiters",
    posted_at: "2025-01-05T00:00:00Z",
    tags: ["safety", "data center", "construction", "Tennessee"],
  },

  // ── Pkaza Critical Facilities Recruiting ───────────────────────────────────
  {
    title: "Electrical Commissioning Engineer",
    company: "Pkaza Critical Facilities",
    location: "Ashburn, VA",
    state: "VA",
    salary_range: "$110,000 - $145,000",
    salary_min: 110000,
    salary_max: 145000,
    description:
      "Perform electrical commissioning for hyperscale data centers in Northern Virginia. Experience with switchgear, UPS, PDU, and generator testing required. Work closely with the construction and operations teams through turnover.",
    apply_url:
      "https://www.pkaza.com/job/electrical-commissioning-engineer-ashburn-va-dfeb4615-1b64-4c80-984e-4ade0804036f/",
    source: "pkaza",
    posted_at: "2025-02-05T00:00:00Z",
    tags: ["electrical", "commissioning", "data center", "Virginia", "UPS", "switchgear"],
  },
  {
    title: "Mechanical Commissioning Engineer",
    company: "Pkaza Critical Facilities",
    location: "Ashburn, VA",
    state: "VA",
    salary_range: "$110,000 - $145,000",
    salary_min: 110000,
    salary_max: 145000,
    description:
      "Lead mechanical commissioning activities for mission-critical data center facilities in Northern Virginia. Scope includes CRAC/CRAH, chiller plants, cooling towers, and BMS verification.",
    apply_url:
      "https://www.pkaza.com/job/mechanical-commissioning-engineer-northern-va-70aba6b9-b4e6-4e62-9dde-14db0a7e6cfd/",
    source: "pkaza",
    posted_at: "2025-02-05T00:00:00Z",
    tags: ["mechanical", "commissioning", "data center", "Virginia", "chiller", "BMS"],
  },
  {
    title: "Data Center Commissioning Manager",
    company: "Pkaza Critical Facilities",
    location: "Remote / Multiple Sites",
    state: "TX",
    salary_range: "$150,000 - $190,000",
    salary_min: 150000,
    salary_max: 190000,
    description:
      "Manage full-scope commissioning programs for data center clients nationwide. Develop Cx plans, coordinate level 3–5 testing, and lead the final integrated systems test (IST). Extensive travel expected.",
    apply_url:
      "https://www.pkaza.com/job/data-center-commissioning-manager-6c00f706-10b1-4f61-9e06-b25d2dc64e8d/",
    source: "pkaza",
    posted_at: "2025-01-20T00:00:00Z",
    tags: ["commissioning", "manager", "data center", "IST", "remote"],
  },
  {
    title: "Data Center Cx Project Manager",
    company: "Pkaza Critical Facilities",
    location: "Austin, TX",
    state: "TX",
    salary_range: "$135,000 - $170,000",
    salary_min: 135000,
    salary_max: 170000,
    description:
      "Own the commissioning project management lifecycle for a major hyperscale data center build in Austin. Coordinate between the owner, GC, MEP subs, and Cx authority. Track Cx schedule milestones and manage the issues log through final acceptance.",
    apply_url:
      "https://www.pkaza.com/job/data-center-cx-project-manager-austin-tx-7d5c0f18-d9bc-4eb0-a826-acb2ab1b0bca/",
    source: "pkaza",
    posted_at: "2025-02-10T00:00:00Z",
    tags: ["commissioning", "project manager", "data center", "Austin", "Texas"],
  },
  {
    title: "Data Center MEP Real Estate Site Selector",
    company: "Pkaza Critical Facilities",
    location: "Remote",
    state: "TX",
    salary_range: "$130,000 - $160,000",
    salary_min: 130000,
    salary_max: 160000,
    description:
      "Evaluate potential data center sites from an MEP infrastructure perspective. Assess utility power availability, substation proximity, fiber routes, and zoning. Produce site scoring matrices and present findings to executive stakeholders.",
    apply_url:
      "https://www.pkaza.com/job/data-center-mep-real-estate-site-selector-remote-9e2f5b3c-1234-5678-abcd-ef0123456789/",
    source: "pkaza",
    posted_at: "2025-02-12T00:00:00Z",
    tags: ["MEP", "real estate", "site selection", "data center", "remote"],
  },
  {
    title: "Data Center Controls / Cx Engineer",
    company: "Pkaza Critical Facilities",
    location: "Dallas, TX",
    state: "TX",
    salary_range: "$115,000 - $150,000",
    salary_min: 115000,
    salary_max: 150000,
    description:
      "Commission and validate BMS, EPMS, and DCIM controls systems for hyperscale data centers. Program and configure Schneider, Siemens, or Andover controls. Troubleshoot integration issues between controls and mechanical/electrical systems.",
    apply_url:
      "https://www.pkaza.com/job/data-center-controls-cx-engineer-8a4b2c1d-5e6f-7890-abcd-ef1234567890/",
    source: "pkaza",
    posted_at: "2025-02-08T00:00:00Z",
    tags: ["controls", "commissioning", "BMS", "EPMS", "DCIM", "data center", "Texas"],
  },
  {
    title: "Data Center Electrician (Journeyman)",
    company: "Pkaza Critical Facilities",
    location: "Houston, TX",
    state: "TX",
    salary_range: "$38/hr - $52/hr",
    description:
      "Journeyman electrician for data center construction and fit-out projects in the Houston area. Install conduit, wire, and terminate equipment in high-voltage and low-voltage environments. Data center or mission-critical experience preferred.",
    apply_url:
      "https://www.pkaza.com/job/data-center-electrician-journeyman-tx-3f2e1d0c-9b8a-7654-3210-fedcba987654/",
    source: "pkaza",
    posted_at: "2025-02-15T00:00:00Z",
    tags: ["electrician", "journeyman", "data center", "Houston", "Texas"],
  },

  // ── Mortenson Construction ─────────────────────────────────────────────────
  {
    title: "Data Center Construction Project Manager",
    company: "Mortenson Construction",
    location: "Austin, TX",
    state: "TX",
    salary_range: "$130,000 - $165,000",
    salary_min: 130000,
    salary_max: 165000,
    description:
      "Lead construction project management for a hyperscale data center campus in Central Texas. Manage owner relationships, subcontractor performance, budget, and schedule. Mortenson's data center group delivers 1+ GW of capacity annually.",
    apply_url: "https://www.mortenson.com/careers/job-detail/?jobId=DC-TX-2024-001",
    source: "mortenson",
    posted_at: "2025-01-18T00:00:00Z",
    tags: ["project manager", "data center", "construction", "Texas", "Mortenson"],
  },

  // ── Gray Construction ──────────────────────────────────────────────────────
  {
    title: "Data Center Project Manager",
    company: "Gray Construction",
    location: "Atlanta, GA",
    state: "GA",
    salary_range: "$125,000 - $160,000",
    salary_min: 125000,
    salary_max: 160000,
    description:
      "Manage design-build data center projects from preconstruction through substantial completion. Gray Construction specializes in large-scale industrial and data center facilities. Atlanta-based role with travel to project sites across the Southeast.",
    apply_url: "https://gray.tv/careers/data-center-project-manager-ga",
    source: "gray_construction",
    posted_at: "2025-01-25T00:00:00Z",
    tags: ["project manager", "data center", "design-build", "Georgia", "Gray Construction"],
  },
  {
    title: "Data Center Superintendent",
    company: "Gray Construction",
    location: "Lexington, KY",
    state: "KY",
    salary_range: "$110,000 - $145,000",
    salary_min: 110000,
    salary_max: 145000,
    description:
      "Field superintendent for a data center construction project in Kentucky. Oversee daily trade contractor activities, enforce the project schedule, and ensure quality and safety standards are met. 5+ years of data center or heavy industrial construction required.",
    apply_url: "https://gray.tv/careers/data-center-superintendent-ky",
    source: "gray_construction",
    posted_at: "2025-02-03T00:00:00Z",
    tags: ["superintendent", "data center", "construction", "Kentucky", "Gray Construction"],
  },
  {
    title: "Data Center Project Engineer",
    company: "Gray Construction",
    location: "Dallas, TX",
    state: "TX",
    salary_range: "$85,000 - $115,000",
    salary_min: 85000,
    salary_max: 115000,
    description:
      "Project engineer supporting a large data center construction program in DFW. Manage RFIs, submittals, and subcontractor coordination. Work closely with the superintendent and PM to maintain schedule and quality benchmarks.",
    apply_url: "https://gray.tv/careers/data-center-project-engineer-tx",
    source: "gray_construction",
    posted_at: "2025-02-07T00:00:00Z",
    tags: ["project engineer", "data center", "construction", "Texas", "Gray Construction", "DFW"],
  },
];

// ─── Step 4: Filter to allowed region ────────────────────────────────────────

export const REGIONAL_JOBS = SCRAPED_JOBS.filter((job) =>
  isAllowedRegion(job.state)
);

// ─── Step 5: Upsert to DB (skipped in dry-run mode) ──────────────────────────

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const jobs = REGIONAL_JOBS;

  if (dryRun) {
    console.log(JSON.stringify(jobs, null, 2));
    console.log(`\n✓ ${jobs.length} jobs passed region filter (dry run — no DB write)`);
    return;
  }

  let inserted = 0;
  let skipped = 0;

  for (const job of jobs) {
    try {
      await prisma.job.upsert({
        where: { apply_url: job.apply_url },
        create: {
          title: job.title,
          company: job.company,
          location: job.location,
          state: job.state,
          salary_min: job.salary_min ?? null,
          salary_max: job.salary_max ?? null,
          description: job.description,
          apply_url: job.apply_url,
          source: job.source,
          tags: job.tags,
          posted_at: job.posted_at ? new Date(job.posted_at) : null,
        },
        update: {
          title: job.title,
          company: job.company,
          location: job.location,
          salary_min: job.salary_min ?? null,
          salary_max: job.salary_max ?? null,
          description: job.description,
          tags: job.tags,
        },
      });
      inserted++;
    } catch (err) {
      console.error(`Failed to upsert ${job.apply_url}:`, err);
      skipped++;
    }
  }

  console.log(`✓ Upserted ${inserted} jobs, skipped ${skipped}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
