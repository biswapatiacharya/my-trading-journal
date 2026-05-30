import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { calculateDashboardStats, buildPerformanceByWeekday, buildPerformanceByTimeOfDay } from "@/lib/trade-calculations";
import type { Trade, Tag } from "@/types";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: trades } = await supabase
      .from("trades")
      .select(`*, strategy:strategies(id, name), tags:trade_tags(tag:tags(id, name))`)
      .eq("user_id", user.id)
      .eq("status", "closed")
      .order("date", { ascending: false })
      .limit(200);

    if (!trades || trades.length < 5) {
      return NextResponse.json({ error: "Add at least 5 closed trades to generate insights" }, { status: 400 });
    }

    const normalised = trades.map((t) => ({
      ...t,
      tags: (t.tags as { tag: Tag }[] | null)?.map((tt) => tt.tag) ?? [],
    })) as Trade[];

    const stats = calculateDashboardStats(normalised);
    const weekdayPerf = buildPerformanceByWeekday(normalised);
    const timePerf = buildPerformanceByTimeOfDay(normalised);

    // Build a compact trade summary for the AI (avoid sending full data)
    const tradeSummary = {
      totalTrades: normalised.length,
      winRate: stats.winRate.toFixed(1),
      profitFactor: stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2),
      avgWinner: stats.avgWinner.toFixed(2),
      avgLoser: stats.avgLoser.toFixed(2),
      avgRMultiple: stats.avgRMultiple.toFixed(2),
      expectancy: stats.expectancy.toFixed(2),
      maxDrawdown: stats.largestDrawdown.toFixed(2),
      streak: stats.currentStreak,
      weekdayPerf: weekdayPerf.map((d) => ({
        day: d.name,
        winRate: d.winRate.toFixed(0) + "%",
        pnl: "$" + d.pnl.toFixed(0),
        trades: d.trades,
      })),
      timePerf: timePerf.filter((t) => t.trades > 0).map((t) => ({
        time: t.name,
        winRate: t.winRate.toFixed(0) + "%",
        pnl: "$" + t.pnl.toFixed(0),
        trades: t.trades,
      })),
      // Sample of recent trades
      recentTrades: normalised.slice(0, 30).map((t) => ({
        symbol: t.symbol,
        date: t.date,
        direction: t.direction,
        pnl: (t.pnl ?? 0).toFixed(2),
        rMultiple: t.r_multiple?.toFixed(2) ?? null,
        emotions: t.emotions ?? [],
        confidence: t.confidence_score,
        tags: t.tags?.map((tag) => tag.name) ?? [],
        strategy: t.strategy?.name ?? null,
        timeOfDay: t.time ?? null,
        aPlus: t.a_plus_score,
      })),
    };

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `You are an expert trading coach and performance analyst. Analyse this trader's statistics and identify specific, actionable insights.

TRADER DATA:
${JSON.stringify(tradeSummary, null, 2)}

Generate exactly 6 insights in JSON format. Each insight must be specific to the data above (mention specific numbers, days, symbols, setups).

Return a JSON array of exactly 6 objects with these fields:
- insight_type: one of "pattern" | "behavioral" | "emotional" | "performance" | "recommendation"
- title: short title (max 60 chars)
- content: detailed insight with specific data references (2-3 sentences, actionable)
- severity: one of "info" | "warning" | "success" | "critical"

Focus on:
1. Day/time performance patterns (which days/times are most/least profitable)
2. Win rate and profit factor analysis
3. Emotional trading patterns
4. Setup/strategy performance
5. Risk management (R-multiple, drawdown)
6. One positive strength to reinforce

Return ONLY the JSON array, no markdown or other text.`,
        },
      ],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "[]";

    let insightData: { insight_type: string; title: string; content: string; severity: string }[];
    try {
      insightData = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/\[[\s\S]*\]/);
      insightData = match ? JSON.parse(match[0]) : [];
    }

    if (!Array.isArray(insightData) || insightData.length === 0) {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    // Delete old insights and insert new ones
    await supabase.from("ai_insights").delete().eq("user_id", user.id);

    const { data: newInsights, error: insertError } = await supabase
      .from("ai_insights")
      .insert(insightData.map((insight) => ({
        user_id: user.id,
        insight_type: insight.insight_type,
        title: insight.title,
        content: insight.content,
        severity: insight.severity,
        metadata: { tradeCount: normalised.length },
      })))
      .select();

    if (insertError) throw insertError;

    return NextResponse.json({ insights: newInsights });
  } catch (err: unknown) {
    console.error("AI insights error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
