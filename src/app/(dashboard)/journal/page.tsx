import { createClient } from "@/lib/supabase/server";
import { JournalClient } from "@/components/journal/journal-client";
import type { JournalEntry, Trade } from "@/types";

export const metadata = { title: "Journal" };

export default async function JournalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: entries }, { data: trades }] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("*")
      .eq("user_id", user!.id)
      .order("date", { ascending: false }),
    supabase
      .from("trades")
      .select("id, date, symbol, direction, pnl, pnl_percentage, status")
      .eq("user_id", user!.id)
      .order("date", { ascending: false }),
  ]);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Trading Journal</h1>
        <p className="text-sm text-muted-foreground">Daily notes, reflections, and market observations</p>
      </div>
      <JournalClient
        entries={(entries ?? []) as JournalEntry[]}
        trades={(trades ?? []) as Trade[]}
      />
    </div>
  );
}
