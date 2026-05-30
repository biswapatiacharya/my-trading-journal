import { createClient } from "@/lib/supabase/server";
import { TradeForm } from "@/components/trades/trade-form";
import type { Strategy, Tag } from "@/types";

export const metadata = { title: "New Trade" };

export default async function NewTradePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: strategies }, { data: tags }] = await Promise.all([
    supabase.from("strategies").select("*").eq("user_id", user!.id).order("name"),
    supabase.from("tags").select("*").eq("user_id", user!.id).order("name"),
  ]);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">New Trade</h1>
        <p className="text-sm text-muted-foreground">Log a new trade entry</p>
      </div>
      <TradeForm
        strategies={(strategies ?? []) as Strategy[]}
        tags={(tags ?? []) as Tag[]}
      />
    </div>
  );
}
