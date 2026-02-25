import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const HOUSTON_JOBS = [
  {
    title: "Senior Electrical Foreman - Data Center",
    company: "Rosendin Electric",
    description: "Lead electrical installation for a 200MW hyperscale data center campus in Katy, TX. Oversee crew of 40+ electricians on medium/high voltage switchgear, UPS systems, and PDU installations.",
    requirements: "OSHA 30, NFPA 70E, Journeyman Electrician License, 10+ years data center experience",
    location: "Katy, TX (Energy Corridor)",
    salaryMin: 95000, salaryMax: 130000, salaryPeriod: "annual",
    jobType: "full_time", category: "electrical", certRequired: "OSHA 30,NFPA 70E",
    latitude: 29.7858, longitude: -95.8245, crewSize: 45,
  },
  {
    title: "HVAC/Mechanical Technician - Critical Facilities",
    company: "Comfort Systems USA",
    description: "Install and commission precision cooling systems (CRAC/CRAH units, chilled water systems) for a new GPU cluster facility.",
    requirements: "EPA 608 Universal, OSHA 10, 5+ years HVAC experience",
    location: "Houston, TX",
    salaryMin: 35, salaryMax: 55, salaryPeriod: "hourly",
    jobType: "full_time", category: "mechanical", certRequired: "EPA 608,OSHA 10",
    latitude: 29.7604, longitude: -95.3698, crewSize: 20,
  },
  {
    title: "Structured Cabling Lead - Hyperscale Campus",
    company: "DataPath Infrastructure",
    description: "Lead fiber optic and copper cabling installation for a 500,000 sq ft data center build-out.",
    requirements: "BICSI Technician, OSHA 10, experience with Fluke testing equipment",
    location: "Katy, TX",
    salaryMin: 75000, salaryMax: 95000, salaryPeriod: "annual",
    jobType: "contract", category: "networking", certRequired: "BICSI Technician,OSHA 10",
    latitude: 29.7908, longitude: -95.8132, crewSize: 30,
  },
  {
    title: "Data Center Commissioning Agent",
    company: "ESD (formerly Encompass)",
    description: "Perform Integrated Systems Testing (IST) and Level 5 commissioning for critical power and cooling infrastructure.",
    requirements: "CDCDP or Uptime Institute ATD, 7+ years commissioning experience",
    location: "Houston, TX",
    salaryMin: 110000, salaryMax: 150000, salaryPeriod: "annual",
    jobType: "full_time", category: "commissioning", certRequired: "CDCDP,Uptime Institute ATD",
    latitude: 29.7352, longitude: -95.3703, crewSize: 8,
  },
  {
    title: "Electrical Helper - Data Center New Build",
    company: "Holder Construction",
    description: "Assist journeyman electricians with conduit installation, wire pulling, and equipment mounting in a new hyperscale data center.",
    requirements: "OSHA 10, valid driver's license, ability to lift 50 lbs",
    location: "Katy, TX (Energy Corridor)",
    salaryMin: 18, salaryMax: 25, salaryPeriod: "hourly",
    jobType: "full_time", category: "electrical", certRequired: "OSHA 10",
    latitude: 29.7810, longitude: -95.8300, crewSize: 60,
  },
  {
    title: "Physical Security Installation Tech",
    company: "Securitas Technology",
    description: "Install access control systems (Lenel, Genetec), CCTV cameras, and intrusion detection for a Tier IV data center.",
    requirements: "CompTIA A+, low-voltage license, security clearance preferred",
    location: "Houston, TX",
    salaryMin: 28, salaryMax: 42, salaryPeriod: "hourly",
    jobType: "contract", category: "security", certRequired: "CompTIA A+",
    latitude: 29.7530, longitude: -95.3580, crewSize: 12,
  },
  {
    title: "Data Center Project Manager",
    company: "Turner Construction",
    description: "Manage $150M+ hyperscale data center build from foundation to turnover. Coordinate 200+ trades.",
    requirements: "PMP preferred, 10+ years construction PM experience, 5+ in data center",
    location: "Houston, TX",
    salaryMin: 140000, salaryMax: 190000, salaryPeriod: "annual",
    jobType: "full_time", category: "project_management", certRequired: "",
    latitude: 29.7604, longitude: -95.3698, crewSize: 200,
  },
  {
    title: "Medium Voltage Electrician - Data Center",
    company: "Interstates",
    description: "Install and terminate medium voltage cables (15kV class) for utility feeds and generator paralleling gear.",
    requirements: "OSHA 30, NFPA 70E, Journeyman License, MV experience required",
    location: "Katy, TX",
    salaryMin: 45, salaryMax: 65, salaryPeriod: "hourly",
    jobType: "contract", category: "electrical", certRequired: "OSHA 30,NFPA 70E",
    latitude: 29.7880, longitude: -95.8200, crewSize: 25,
  },
  {
    title: "Fire Protection Installer - Data Center",
    company: "APi Group",
    description: "Install pre-action sprinkler systems and clean agent fire suppression systems in data hall environments.",
    requirements: "OSHA 10, NICET Level II preferred, experience with clean agent systems",
    location: "Houston, TX",
    salaryMin: 30, salaryMax: 48, salaryPeriod: "hourly",
    jobType: "full_time", category: "mechanical", certRequired: "OSHA 10",
    latitude: 29.7500, longitude: -95.3800, crewSize: 15,
  },
  {
    title: "BMS/Controls Technician - Critical Facilities",
    company: "Schneider Electric",
    description: "Program and commission Building Management Systems for data center power monitoring and environmental controls.",
    requirements: "CompTIA A+, Schneider/Andover certification preferred, BACnet/Modbus experience",
    location: "Houston, TX",
    salaryMin: 85000, salaryMax: 115000, salaryPeriod: "annual",
    jobType: "full_time", category: "networking", certRequired: "CompTIA A+",
    latitude: 29.7604, longitude: -95.3698, crewSize: 6,
  },
];

async function seed() {
  console.log("Seeding database...");
  await prisma.application.deleteMany();
  await prisma.pingNotification.deleteMany();
  await prisma.pingCampaign.deleteMany();
  await prisma.job.deleteMany();
  await prisma.certification.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.jobSeekerProfile.deleteMany();
  await prisma.employerProfile.deleteMany();
  await prisma.session.deleteMany();
  await prisma.smsConsent.deleteMany();
  await prisma.user.deleteMany();

  for (const jobData of HOUSTON_JOBS) {
    await prisma.job.create({ data: jobData });
  }

  console.log(`Seeded ${HOUSTON_JOBS.length} jobs`);
}

seed()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
