"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Zap, User, Building2 } from "lucide-react";

export default function Navbar({ user }: { user?: { name: string; role: string } | null }) {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-primary rounded-lg p-1.5">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">
              DataCenter<span className="text-primary">Hires</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link href="/jobs" className="text-muted hover:text-foreground transition-colors font-medium">
              Find Jobs
            </Link>
            <Link href="/employer" className="text-muted hover:text-foreground transition-colors font-medium">
              For Employers
            </Link>
            {user ? (
              <div className="flex items-center gap-3">
                <Link
                  href={user.role === "employer" ? "/employer" : "/dashboard"}
                  className="flex items-center gap-2 text-muted hover:text-foreground"
                >
                  {user.role === "employer" ? (
                    <Building2 className="h-4 w-4" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                  {user.name}
                </Link>
                <form action="/api/auth/logout" method="POST">
                  <button className="text-sm text-muted hover:text-danger transition-colors">
                    Sign Out
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/auth/login" className="btn-outline text-sm py-2 px-4">
                  Log In
                </Link>
                <Link href="/auth/signup" className="btn-primary text-sm py-2 px-4">
                  Get Started
                </Link>
              </div>
            )}
          </div>

          <button className="md:hidden" onClick={() => setOpen(!open)}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {open && (
          <div className="md:hidden pb-4 space-y-2">
            <Link href="/jobs" className="block py-2 text-muted hover:text-foreground font-medium">
              Find Jobs
            </Link>
            <Link href="/employer" className="block py-2 text-muted hover:text-foreground font-medium">
              For Employers
            </Link>
            {user ? (
              <>
                <Link
                  href={user.role === "employer" ? "/employer" : "/dashboard"}
                  className="block py-2 text-muted hover:text-foreground font-medium"
                >
                  Dashboard
                </Link>
                <form action="/api/auth/logout" method="POST">
                  <button className="block py-2 text-danger font-medium">Sign Out</button>
                </form>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="block py-2 text-primary font-medium">
                  Log In
                </Link>
                <Link href="/auth/signup" className="block py-2 btn-primary text-center">
                  Get Started
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
