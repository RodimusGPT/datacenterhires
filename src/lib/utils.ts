import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSalary(min?: number | null, max?: number | null, period?: string | null): string {
  if (!min && !max) return "Competitive";
  const fmt = (n: number) =>
    period === "hourly" ? `$${n}/hr` : `$${(n / 1000).toFixed(0)}k`;
  if (min && max) return `${fmt(min)} - ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

export function timeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export const JOB_CATEGORIES = [
  { value: "electrical", label: "Electrical" },
  { value: "mechanical", label: "Mechanical / HVAC" },
  { value: "networking", label: "Networking / Cabling" },
  { value: "security", label: "Physical Security" },
  { value: "project_management", label: "Project Management" },
  { value: "commissioning", label: "Commissioning" },
  { value: "general", label: "General Construction" },
] as const;

export const CERTIFICATIONS = [
  "OSHA 10",
  "OSHA 30",
  "NFPA 70E",
  "CompTIA A+",
  "CompTIA Network+",
  "CompTIA Server+",
  "BICSI RCDD",
  "BICSI Technician",
  "EPA 608",
  "First Aid/CPR",
  "CDCDP",
  "Uptime Institute ATD",
] as const;

export const TIER_LIMITS = {
  free: { dailyApplies: 5, label: "Free" },
  premium: { dailyApplies: 20, label: "Premium - $19/mo" },
  elite: { dailyApplies: 50, label: "Elite - $39/mo" },
} as const;
