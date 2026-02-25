"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, User, Building2 } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [role, setRole] = useState<"job_seeker" | "employer">("job_seeker");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      role,
      companyName: form.get("companyName"),
    };

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    router.push(data.redirect);
    router.refresh();
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="bg-primary rounded-lg p-2">
              <Zap className="h-6 w-6 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Create Your Account</h1>
          <p className="text-muted mt-1">Join the mission-critical talent network</p>
        </div>

        {/* Role Selector */}
        <div className="flex gap-3 mb-6">
          <button
            type="button"
            onClick={() => setRole("job_seeker")}
            className={`flex-1 py-3 px-4 rounded-lg border-2 flex items-center justify-center gap-2 font-medium transition-all ${
              role === "job_seeker"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-muted hover:border-primary/30"
            }`}
          >
            <User className="h-4 w-4" /> Job Seeker
          </button>
          <button
            type="button"
            onClick={() => setRole("employer")}
            className={`flex-1 py-3 px-4 rounded-lg border-2 flex items-center justify-center gap-2 font-medium transition-all ${
              role === "employer"
                ? "border-accent bg-accent/5 text-accent"
                : "border-border text-muted hover:border-accent/30"
            }`}
          >
            <Building2 className="h-4 w-4" /> Employer
          </button>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Full Name</label>
            <input name="name" type="text" required className="input" placeholder="John Martinez" />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Email</label>
            <input name="email" type="email" required className="input" placeholder="john@example.com" />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Password</label>
            <input name="password" type="password" required minLength={8} className="input" placeholder="Min 8 characters" />
          </div>

          {role === "employer" && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Company Name</label>
              <input name="companyName" type="text" required className="input" placeholder="Rosendin Electric" />
            </div>
          )}

          {error && <p className="text-danger text-sm">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? "Creating Account..." : "Create Account"}
          </button>

          <p className="text-center text-sm text-muted">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-primary font-medium hover:underline">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
