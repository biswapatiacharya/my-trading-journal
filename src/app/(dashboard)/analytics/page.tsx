import { createClient } from "@/lib/supabase/server";
import {
  calculateDashboardStats, buildEquityCurve, buildCalendarPnl,
  buildPerformanceByWeekday, buildPerformanceBySetup, buildPerformanceBySymbol,
  buildPerformanceByStrategy, buildPerformanceByTimeOfDay,
} from "@/lib/trade-calculations";
import { EquityCurve } from "@/components/charts/equity-curve";
import { WinLossPie } from "@/components/charts/win-loss-pie";
import { PerformanceBar } from "@/components/charts/performance-bar";
import { CalendarPnl } from "@/components/charts/calendar-pnl";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatPercent, formatNumber, formatHoldingTime, getPnlColor } from "@/lib/utils";
import { Target, BarChart3, TrendingUp, TrendingDown, Clock, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Trade, Tag } from "@/types";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: trades = [] } = await supabase
    .from("trades")
    .select(`*, strategy:strategies(id, name, color), tags:trade_tags(tag:tags(id, name, color))`)
    .eq("user_id", user!.id)
    .order("date", { ascending: false });

  const normalised = (trades as Record<string, unknown>[]).map((t) => ({
    ...t,
    tags: (t.tags as { tag: Tag }[] | null)?.map((tt) => tt.tag) ?? [],
  })) as Trade[];

  const stats = calculateDashboardStats(normalised);
  const equityCurve = buildEquityCurve(normalised);
  const calendarData = buildCalendarPnl(normalised);
  const weekdayPerf = buildPerformanceByWeekday(normalised);
  const setupPerf = buildPerformanceBySetup(normalised);
  const symbolPerf = buildPerformanceBySymbol(normalised);
  const strategyPerf = buildPerformanceByStrategy(normalised);
  const timePerf = buildPerformanceByTimeOfDay(normalised);

  const closed = normalised.filter((t) => t.status === "closed" && t.pnl !== null);
  const winners = closed.filter((t) => (t.pnl ?? 0) > 0);
  const losers = closed.filter((t) => (t.pnl ?? 0) < 0);
  const be = closed.filter((t) => (t.pnl ?? 0) === 0);

  // Best and worst trades
  const sorted = [...closed].sort((a, b) => (b.pnl ?? 0) - (a.pnl ?? 0));
  const bestTrade = sorted[0];
  const worstTrade = sorted[sorted.length - 1];

  // Asset type breakdown
  const byAsset: Record<string, { trades: number; pnl: number; wins: number }> = {};
  for (const t of closed) {
    byAsset[t.asset_type] = byAsset[t.asset_type] ?? { trades: 0, pnl: 0, wins: 0 };
    byAsset[t.asset_type].trades += 1;
    byAsset[t.asset_type].pnl += t.pnl ?? 0;
    if ((t.pnl ?? 0) > 0) byAsset[t.asset_type].wins += 1;
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground">Deep dive into your trading performance</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Key metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard title="Win Rate" value={`${stats.winRate.toFixed(1)}%`} icon={Target}
              trend={stats.winRate >= 50 ? "up" : "down"} />
            <MetricCard title="Profit Factor" value={stats.profitFactor === Infinity ? "∞" : formatNumber(stats.profitFactor)}
              icon={TrendingUp} trend={stats.profitFactor >= 1 ? "up" : "down"} />
            <MetricCard title="Expectancy" value={formatCurrency(stats.expectancy)} icon={Award}
              trend={stats.expectancy > 0 ? "up" : "down"} subValue="Per trade" />
            <MetricCard title="Avg R-Multiple" value={stats.avgRMultiple ? `${formatNumber(stats.avgRMultiple)}R` : "—"}
              icon={BarChart3} trend={stats.avgRMultiple > 0 ? "up" : "down"} />
          </div>

          {/* Equity curve */}
          <EquityCurve data={equityCurve} />

          {/* Win/loss + long/short */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <WinLossPie wins={winners.length} losses={losers.length} breakeven={be.length} />

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Long vs Short Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-500 font-medium">Long</span>
                    <span>{stats.longWinRate.toFixed(1)}% win rate</span>
                  </div>
                  <Progress value={stats.longWinRate} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-orange-500 font-medium">Short</span>
                    <span>{stats.shortWinRate.toFixed(1)}% win rate</span>
                  </div>
                  <Progress value={stats.shortWinRate} className="h-2" />
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="rounded-lg bg-muted/50 p-2.5 text-sm">
                    <p className="text-xs text-muted-foreground">Avg Winner</p>
                    <p className="font-semibold text-profit mt-0.5">{formatCurrency(stats.avgWinner)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2.5 text-sm">
                    <p className="text-xs text-muted-foreground">Avg Loser</p>
                    <p className="font-semibold text-loss mt-0.5">{formatCurrency(-stats.avgLoser)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2.5 text-sm">
                    <p className="text-xs text-muted-foreground">Max Drawdown</p>
                    <p className="font-semibold text-loss mt-0.5">{formatCurrency(stats.largestDrawdown)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2.5 text-sm">
                    <p className="text-xs text-muted-foreground">Avg Hold Time</p>
                    <p className="font-semibold mt-0.5">{formatHoldingTime(Math.round(stats.avgHoldingTime)) ?? "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Best / Worst trade */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bestTrade && (
              <Card className="border-profit/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-profit" /> Best Trade
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="font-bold text-lg">{bestTrade.symbol}</span>
                    <span className="font-bold text-lg text-profit">{formatCurrency(bestTrade.pnl)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{bestTrade.date}</span>
                    <span>{formatPercent(bestTrade.pnl_percentage)}</span>
                  </div>
                </CardContent>
              </Card>
            )}
            {worstTrade && (
              <Card className="border-loss/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-loss" /> Worst Trade
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="font-bold text-lg">{worstTrade.symbol}</span>
                    <span className={cn("font-bold text-lg", getPnlColor(worstTrade.pnl))}>{formatCurrency(worstTrade.pnl)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{worstTrade.date}</span>
                    <span>{formatPercent(worstTrade.pnl_percentage)}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Performance ── */}
        <TabsContent value="performance" className="space-y-4 mt-4">
          <PerformanceBar title="Performance by Weekday" data={weekdayPerf} />
          <PerformanceBar title="Time of Day Performance" data={timePerf} />
          <PerformanceBar title="Win Rate by Weekday" data={weekdayPerf} showWinRate />
        </TabsContent>

        {/* ── Calendar ── */}
        <TabsContent value="calendar" className="space-y-4 mt-4">
          <CalendarPnl data={calendarData} />
        </TabsContent>

        {/* ── Breakdown ── */}
        <TabsContent value="breakdown" className="space-y-4 mt-4">
          <PerformanceBar title="P&L by Symbol" data={symbolPerf} maxItems={10} />
          <PerformanceBar title="P&L by Strategy" data={strategyPerf} />
          <PerformanceBar title="P&L by Setup / Tag" data={setupPerf} maxItems={10} />

          {/* Asset type breakdown */}
          {Object.keys(byAsset).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Asset Type Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(byAsset).map(([assetType, data]) => (
                    <div key={assetType} className="flex items-center gap-3 text-sm">
                      <Badge variant="outline" className="capitalize w-20 justify-center">{assetType}</Badge>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-muted-foreground">{data.trades} trades · {data.wins}W</span>
                          <span className={cn("font-semibold", getPnlColor(data.pnl))}>{formatCurrency(data.pnl)}</span>
                        </div>
                        <Progress
                          value={data.trades > 0 ? (data.wins / data.trades) * 100 : 0}
                          className="h-1.5"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
