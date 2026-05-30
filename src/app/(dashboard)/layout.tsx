import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/navigation/sidebar";
import { MobileNav } from "@/components/navigation/mobile-nav";
import { TopBar } from "@/components/navigation/top-bar";
import type { Profile } from "@/types";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user || error) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar profile={profile as Profile | null} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar profile={profile as Profile | null} />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
          {children}
        </main>
        <MobileNav />
      </div>
    </div>
  );
}
