import { Briefcase, Users, MapPin, TrendingUp } from "lucide-react";

const stats = [
  { icon: Briefcase, label: "Active Listings", value: "2,400+", color: "text-primary" },
  { icon: Users, label: "Certified Pros", value: "12,000+", color: "text-success" },
  { icon: MapPin, label: "Project Sites", value: "180+", color: "text-accent" },
  { icon: TrendingUp, label: "Growth (YoY)", value: "327%", color: "text-danger" },
];

export default function StatsBar() {
  return (
    <div className="bg-surface border-y border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-3">
              <stat.icon className={`h-8 w-8 ${stat.color} shrink-0`} />
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
