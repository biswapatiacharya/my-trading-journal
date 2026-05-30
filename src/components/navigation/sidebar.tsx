"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, TrendingUp, BookOpen, BarChart3, BrainCircuit,
  Upload, Settings, LogOut, Moon, Sun, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useState } from "react";
import type { Profile } from "@/types";

const NAV_ITEMS = [
  { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { href: "/trades",       label: "Trades",       icon: TrendingUp },
  { href: "/journal",      label: "Journal",      icon: BookOpen },
  { href: "/analytics",    label: "Analytics",    icon: BarChart3 },
  { href: "/ai-insights",  label: "AI Insights",  icon: BrainCircuit },
  { href: "/import",       label: "Import",       icon: Upload },
  { href: "/settings",     label: "Settings",     icon: Settings },
];

interface SidebarProps {
  profile: Profile | null;
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    toast.success("Signed out");
  }

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : profile?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "hidden md:flex flex-col border-r bg-card transition-all duration-300",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo */}
        <div className={cn("flex items-center h-16 px-4 border-b gap-3", collapsed && "justify-center px-2")}>
          {!collapsed && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-base truncate">TradingJournal</span>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary-foreground" />
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Tooltip key={href}>
                <TooltipTrigger asChild>
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      collapsed && "justify-center px-2"
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span>{label}</span>}
                  </Link>
                </TooltipTrigger>
                {collapsed && <TooltipContent side="right">{label}</TooltipContent>}
              </Tooltip>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className={cn("p-2 border-t space-y-1", collapsed && "px-1")}>
          {/* Theme toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size={collapsed ? "icon" : "sm"}
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className={cn("w-full", !collapsed && "justify-start gap-3 px-3")}
              >
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {!collapsed && <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>}
              </Button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Toggle theme</TooltipContent>}
          </Tooltip>

          {/* Collapse toggle */}
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            onClick={() => setCollapsed(!collapsed)}
            className={cn("w-full", !collapsed && "justify-start gap-3 px-3")}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {!collapsed && <span>Collapse</span>}
          </Button>

          {/* User */}
          <div className={cn("flex items-center gap-2 px-2 py-2 rounded-lg", collapsed && "justify-center")}>
            <Avatar className="w-7 h-7 shrink-0">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{profile?.full_name ?? "Trader"}</p>
                <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
              </div>
            )}
            {!collapsed && (
              <Button variant="ghost" size="icon-sm" onClick={handleSignOut} title="Sign out">
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
