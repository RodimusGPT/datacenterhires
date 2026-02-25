import Link from "next/link";
import { Search, Zap, Send, Shield, MapPin, ArrowRight, CheckCircle2 } from "lucide-react";
import StatsBar from "@/components/StatsBar";
import JobCard from "@/components/JobCard";
import { prisma } from "@/lib/db";

export default async function Home() {
  const featuredJobs = await prisma.job.findMany({
    where: { status: "active" },
    orderBy: { createdAt: "desc" },
    take: 4,
  });

  return (
    <>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary-dark via-primary to-primary-light overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-accent rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-20 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 badge bg-white/20 text-white text-sm px-4 py-1.5 mb-6">
              <MapPin className="h-4 w-4" /> Now Hiring: Houston Energy Corridor
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight">
              Build the Backbone of{" "}
              <span className="text-accent">America&apos;s AI</span>{" "}
              Infrastructure
            </h1>
            <p className="mt-6 text-lg md:text-xl text-blue-100 max-w-2xl">
              The Digital Dispatch Hall for data center construction. Connect certified
              mission-critical talent with hyperscale projects — powered by AI matching
              and SMS-first outreach.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link href="/jobs" className="btn-accent flex items-center justify-center gap-2 text-lg">
                <Search className="h-5 w-5" /> Find Data Center Jobs
              </Link>
              <Link
                href="/employer"
                className="bg-white/10 border-2 border-white/30 text-white font-semibold px-6 py-3 rounded-lg hover:bg-white/20 transition-colors flex items-center justify-center gap-2 text-lg"
              >
                I&apos;m Hiring <ArrowRight className="h-5 w-5" />
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-6 text-sm text-blue-200">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-accent" /> OSHA Certified Talent
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-accent" /> AI-Powered Apply
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-accent" /> SMS-First Outreach
              </span>
            </div>
          </div>
        </div>
      </section>

      <StatsBar />

      {/* How It Works */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              How DataCenterHires Works
            </h2>
            <p className="mt-3 text-muted text-lg max-w-2xl mx-auto">
              Whether you&apos;re a certified electrician or a contractor building a 200MW campus,
              we&apos;ve got you covered.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Job Seekers */}
            <div className="card bg-surface border-2 border-primary/10">
              <h3 className="text-xl font-bold text-primary mb-6 flex items-center gap-2">
                <Zap className="h-5 w-5" /> For Job Seekers
              </h3>
              <div className="space-y-5">
                {[
                  {
                    step: "1",
                    title: "Build Your Mission-Critical ID",
                    desc: "Upload OSHA, NFPA 70E, CompTIA and other certifications to your verified profile.",
                  },
                  {
                    step: "2",
                    title: "Browse 2,400+ Data Center Jobs",
                    desc: "Filter by trade, certification, location, and salary. See crew sizes and project timelines.",
                  },
                  {
                    step: "3",
                    title: 'Hit "Submit All" with AI Apply',
                    desc: "Apply to up to 50 jobs daily with one click. Our AI fills ATS forms and writes screening answers.",
                  },
                ].map((item) => (
                  <div key={item.step} className="flex gap-4">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
                      {item.step}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{item.title}</p>
                      <p className="text-sm text-muted mt-1">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/auth/signup" className="btn-primary mt-6 block text-center">
                Create Free Profile
              </Link>
            </div>

            {/* Employers */}
            <div className="card bg-surface border-2 border-accent/20">
              <h3 className="text-xl font-bold text-accent-light mb-6 flex items-center gap-2">
                <Send className="h-5 w-5 text-accent" /> For Employers
              </h3>
              <div className="space-y-5">
                {[
                  {
                    step: "1",
                    title: "Post Jobs or Browse the Database",
                    desc: "List positions from $100 or search 12,000+ certified professionals directly.",
                  },
                  {
                    step: "2",
                    title: '"Ping" Top Candidates via SMS',
                    desc: "Send Request-to-Apply notifications with 98% read rates to reach on-site contractors instantly.",
                  },
                  {
                    step: "3",
                    title: "Plan 6-12 Months Ahead",
                    desc: "Use the project site map to signal labor needs in advance for traveling professional crews.",
                  },
                ].map((item) => (
                  <div key={item.step} className="flex gap-4">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-accent text-foreground flex items-center justify-center font-bold text-sm">
                      {item.step}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{item.title}</p>
                      <p className="text-sm text-muted mt-1">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/employer" className="btn-accent mt-6 block text-center">
                Start Hiring
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Jobs */}
      <section className="py-16 md:py-24 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-3xl font-bold text-foreground">Latest Houston Openings</h2>
              <p className="text-muted mt-1">Phase 1: Energy Corridor &amp; Greater Houston Area</p>
            </div>
            <Link href="/jobs" className="hidden sm:flex items-center gap-1 text-primary font-semibold hover:underline">
              View All Jobs <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {featuredJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>

          <Link href="/jobs" className="sm:hidden btn-primary mt-6 block text-center">
            View All Jobs
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Shield className="h-12 w-12 text-accent mx-auto mb-4" />
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            $3 Trillion in Infrastructure Spending. Your Skills Are in Demand.
          </h2>
          <p className="mt-4 text-blue-100 text-lg max-w-2xl mx-auto">
            Data center construction is growing 327% in Houston alone. Don&apos;t miss the biggest
            buildout in American history.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup" className="btn-accent text-lg">
              Join as a Job Seeker
            </Link>
            <Link
              href="/employer"
              className="bg-white/10 border-2 border-white/30 text-white font-semibold px-6 py-3 rounded-lg hover:bg-white/20 transition-colors text-lg"
            >
              Employer Solutions
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
