import { createClient } from "@/lib/supabase/server";
import { AIInsightsClient } from "@/components/ai/ai-insights-client";
import type { Trade, AIInsight, Tag } from "@/types";

export const metadata = { title: "AI Insights" };

export default async function AIInsightsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: trades }, { data: insights }] = await Promise.all([
    supabase
      .from("trades")
      .select(`*, strategy:strategies(id, name, color), tags:trade_tags(tag:tags(id, name, color))`)
      .eq("user_id", user!.id)
      .order("date", { ascending: false })
      .limit(200),
    supabase
      .from("ai_insights")
      .select("*")
      .eq("user_id", user!.id)
      .order("generated_at", { ascending: false })
      .limit(20),
  ]);

  const normalisedTrades = (trades ?? []).map((t) => ({
    ...t,
    tags: (t.tags as { tag: Tag }[] | null)?.map((tt) => tt.tag) ?? [],
  })) as Trade[];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">AI Insights</h1>
        <p className="text-sm text-muted-foreground">
          Claude AI analyses your trading patterns and gives you actionable feedback
        </p>
      </div>
      <AIInsightsClient
        trades={normalisedTrades}
        insights={(insights ?? []) as AIInsight[]}
      />
    </div>
  );
}
