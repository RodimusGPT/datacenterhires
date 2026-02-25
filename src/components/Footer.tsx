import { Zap } from "lucide-react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-foreground text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-primary rounded-lg p-1.5">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold">
                DataCenter<span className="text-primary-light">Hires</span>
              </span>
            </div>
            <p className="text-sm text-gray-400">
              The Digital Dispatch Hall for mission-critical infrastructure talent.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-3 text-gray-200">Job Seekers</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/jobs" className="hover:text-white transition-colors">Browse Jobs</Link></li>
              <li><Link href="/auth/signup" className="hover:text-white transition-colors">Create Profile</Link></li>
              <li><Link href="/dashboard/submit-all" className="hover:text-white transition-colors">Submit All (AI Apply)</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-3 text-gray-200">Employers</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/employer/post-job" className="hover:text-white transition-colors">Post a Job</Link></li>
              <li><Link href="/employer/candidates" className="hover:text-white transition-colors">Search Candidates</Link></li>
              <li><Link href="/employer/ping" className="hover:text-white transition-colors">Candidate Ping</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-3 text-gray-200">Coverage</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>Houston / Katy, TX</li>
              <li>Atlanta, GA</li>
              <li>Columbus, OH</li>
              <li>Chicago, IL</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
          <p>&copy; 2026 DataCenterHires.com. All rights reserved.</p>
          <div className="flex gap-4 mt-4 md:mt-0">
            <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms</Link>
            <Link href="#" className="hover:text-white transition-colors">TCPA Compliance</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
