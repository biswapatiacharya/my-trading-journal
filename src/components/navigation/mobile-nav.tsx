"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, TrendingUp, BookOpen, BarChart3, BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard",   label: "Dashboard", icon: LayoutDashboard },
  { href: "/trades",      label: "Trades",    icon: TrendingUp },
  { href: "/journal",     label: "Journal",   icon: BookOpen },
  { href: "/analytics",   label: "Analytics", icon: BarChart3 },
  { href: "/ai-insights", label: "AI",        icon: BrainCircuit },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-safe">
      <div className="flex items-center justify-around h-16">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-full h-full text-xs font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5", active && "text-primary")} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
