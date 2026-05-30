import { createClient } from "@/lib/supabase/server";
import { ImportClient } from "@/components/import/import-client";
import type { Strategy, Tag } from "@/types";

export const metadata = { title: "Import Trades" };

export default async function ImportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: strategies }, { data: tags }] = await Promise.all([
    supabase.from("strategies").select("*").eq("user_id", user!.id).order("name"),
    supabase.from("tags").select("*").eq("user_id", user!.id).order("name"),
  ]);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Import Trades</h1>
        <p className="text-sm text-muted-foreground">Import trades from broker CSV exports</p>
      </div>
      <ImportClient
        strategies={(strategies ?? []) as Strategy[]}
        tags={(tags ?? []) as Tag[]}
      />
    </div>
  );
}
