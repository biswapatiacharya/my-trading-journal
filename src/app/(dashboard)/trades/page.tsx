import { createClient } from "@/lib/supabase/server";
import { TradeListClient } from "@/components/trades/trade-list-client";
import type { Trade, Strategy, Tag } from "@/types";

export const metadata = { title: "Trades" };

export default async function TradesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: trades }, { data: strategies }, { data: tags }] = await Promise.all([
    supabase
      .from("trades")
      .select(`*, strategy:strategies(id, name, color), tags:trade_tags(tag:tags(id, name, color))`)
      .eq("user_id", user!.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("strategies").select("*").eq("user_id", user!.id).order("name"),
    supabase.from("tags").select("*").eq("user_id", user!.id).order("name"),
  ]);

  const normalised = (trades ?? []).map((t) => ({
    ...t,
    tags: (t.tags as { tag: Tag }[] | null)?.map((tt) => tt.tag) ?? [],
  })) as Trade[];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 animate-fade-in">
      <TradeListClient
        trades={normalised}
        strategies={(strategies ?? []) as Strategy[]}
        tags={(tags ?? []) as Tag[]}
      />
    </div>
  );
}
