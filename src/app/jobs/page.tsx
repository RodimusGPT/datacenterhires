import { prisma } from "@/lib/db";
import JobCard from "@/components/JobCard";
import { Search, SlidersHorizontal } from "lucide-react";
import { JOB_CATEGORIES } from "@/lib/utils";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; type?: string }>;
}) {
  const params = await searchParams;
  const query = params.q || "";
  const category = params.category || "";
  const type = params.type || "";

  const where: Record<string, unknown> = { status: "active" };
  if (query) {
    where.OR = [
      { title: { contains: query } },
      { company: { contains: query } },
      { location: { contains: query } },
      { description: { contains: query } },
    ];
  }
  if (category) where.category = category;
  if (type) where.jobType = type;

  const jobs = await prisma.job.findMany({
    where,
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="bg-surface min-h-screen">
      <div className="bg-primary py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-white mb-2">Data Center Jobs</h1>
          <p className="text-blue-100">
            {jobs.length} active positions in the Houston / Energy Corridor area
          </p>

          <form className="mt-6 flex flex-col sm:flex-row gap-3" action="/jobs" method="GET">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
              <input
                name="q"
                defaultValue={query}
                placeholder="Search by title, company, or location..."
                className="input pl-10"
              />
            </div>
            <select name="category" defaultValue={category} className="input sm:w-48">
              <option value="">All Trades</option>
              {JOB_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            <select name="type" defaultValue={type} className="input sm:w-40">
              <option value="">All Types</option>
              <option value="full_time">Full Time</option>
              <option value="contract">Contract</option>
              <option value="temp">Temporary</option>
            </select>
            <button type="submit" className="btn-accent flex items-center justify-center gap-2">
              <SlidersHorizontal className="h-4 w-4" /> Filter
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {jobs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-lg text-muted">No jobs found matching your criteria.</p>
            <a href="/jobs" className="text-primary font-medium mt-2 inline-block hover:underline">
              Clear filters
            </a>
          </div>
        ) : (
          <div className="grid gap-4">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
