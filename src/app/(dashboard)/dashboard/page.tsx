import { createClient } from "@/lib/supabase/server";
import {
  calculateDashboardStats, buildEquityCurve, buildCalendarPnl,
  buildPerformanceByWeekday, buildPerformanceBySetup,
} from "@/lib/trade-calculations";
import { MetricCard } from "@/components/dashboard/metric-card";
import { EquityCurve } from "@/components/charts/equity-curve";
import { WinLossPie } from "@/components/charts/win-loss-pie";
import { PerformanceBar } from "@/components/charts/performance-bar";
import { CalendarPnl } from "@/components/charts/calendar-pnl";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent, formatHoldingTime, formatNumber } from "@/lib/utils";
import {
  DollarSign, TrendingUp, TrendingDown, Target, BarChart2,
  Activity, Flame, Trophy, Clock, AlertTriangle, Plus,
} from "lucide-react";
import Link from "next/link";
import type { Trade } from "@/types";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: trades = [] } = await supabase
    .from("trades")
    .select(`*, strategy:strategies(id, name, color), tags:trade_tags(tag:tags(id, name, color))`)
    .eq("user_id", user!.id)
    .order("date", { ascending: false });

  // Normalise nested tags
  const normalised = (trades as Record<string, unknown>[]).map((t) => ({
    ...t,
    tags: (t.tags as { tag: unknown }[] | null)?.map((tt) => tt.tag) ?? [],
  })) as Trade[];

  const stats = calculateDashboardStats(normalised);
  const equityCurve = buildEquityCurve(normalised);
  const calendarData = buildCalendarPnl(normalised);
  const weekdayPerf = buildPerformanceByWeekday(normalised);
  const setupPerf = buildPerformanceBySetup(normalised);

  const winners = normalised.filter((t) => t.status === "closed" && (t.pnl ?? 0) > 0).length;
  const losers  = normalised.filter((t) => t.status === "closed" && (t.pnl ?? 0) < 0).length;
  const be      = normalised.filter((t) => t.status === "closed" && (t.pnl ?? 0) === 0).length;

  const hasTrades = normalised.length > 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {hasTrades ? `${stats.totalTrades} total trades` : "Start by adding your first trade"}
          </p>
        </div>
        <Button asChild>
          <Link href="/trades/new">
            <Plus className="w-4 h-4" />
            New Trade
          </Link>
        </Button>
      </div>

      {/* P&L Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          title="Today's P&L"
          value={formatCurrency(stats.dailyPnl)}
          icon={DollarSign}
          trend={stats.dailyPnl > 0 ? "up" : stats.dailyPnl < 0 ? "down" : "neutral"}
          highlight={stats.dailyPnl !== 0}
        />
        <MetricCard
          title="Weekly P&L"
          value={formatCurrency(stats.weeklyPnl)}
          icon={BarChart2}
          trend={stats.weeklyPnl > 0 ? "up" : stats.weeklyPnl < 0 ? "down" : "neutral"}
        />
        <MetricCard
          title="Monthly P&L"
          value={formatCurrency(stats.monthlyPnl)}
          icon={TrendingUp}
          trend={stats.monthlyPnl > 0 ? "up" : stats.monthlyPnl < 0 ? "down" : "neutral"}
        />
        <MetricCard
          title="Total P&L"
          value={formatCurrency(stats.totalPnl)}
          icon={Activity}
          trend={stats.totalPnl > 0 ? "up" : stats.totalPnl < 0 ? "down" : "neutral"}
        />
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <MetricCard
          title="Win Rate"
          value={formatPercent(stats.winRate, 1).replace("+", "")}
          subValue={`${stats.totalTrades} trades`}
          icon={Target}
          trend={stats.winRate >= 50 ? "up" : "down"}
        />
        <MetricCard
          title="Profit Factor"
          value={stats.profitFactor === Infinity ? "∞" : formatNumber(stats.profitFactor)}
          subValue="Gross profit / loss"
          icon={TrendingUp}
          trend={stats.profitFactor >= 1 ? "up" : "down"}
        />
        <MetricCard
          title="Avg Winner"
          value={formatCurrency(stats.avgWinner)}
          icon={TrendingUp}
          trend="up"
        />
        <MetricCard
          title="Avg Loser"
          value={formatCurrency(-stats.avgLoser)}
          icon={TrendingDown}
          trend="down"
        />
        <MetricCard
          title="Expectancy"
          value={formatCurrency(stats.expectancy)}
          subValue="Per trade"
          icon={Trophy}
          trend={stats.expectancy > 0 ? "up" : "down"}
        />
        <MetricCard
          title="Avg R-Multiple"
          value={stats.avgRMultiple ? formatNumber(stats.avgRMultiple, 2) + "R" : "—"}
          subValue="Risk-adjusted return"
          icon={BarChart2}
          trend={stats.avgRMultiple > 0 ? "up" : "down"}
        />
      </div>

      {/* Second metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        <MetricCard
          title="Max Drawdown"
          value={formatCurrency(stats.largestDrawdown)}
          icon={AlertTriangle}
          trend="down"
        />
        <MetricCard
          title="Current Streak"
          value={`${stats.currentStreak > 0 ? "+" : ""}${stats.currentStreak}`}
          subValue={stats.currentStreak > 0 ? "Winning" : stats.currentStreak < 0 ? "Losing" : "Neutral"}
          icon={Flame}
          trend={stats.currentStreak > 0 ? "up" : stats.currentStreak < 0 ? "down" : "neutral"}
        />
        <MetricCard
          title="Avg Hold Time"
          value={formatHoldingTime(Math.round(stats.avgHoldingTime)) ?? "—"}
          icon={Clock}
          trend="neutral"
        />
        <MetricCard
          title="Total Trades"
          value={stats.totalTrades.toString()}
          subValue={`${winners}W / ${losers}L`}
          icon={Activity}
          trend="neutral"
        />
      </div>

      {/* Main charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <EquityCurve data={equityCurve} />
        </div>
        <WinLossPie wins={winners} losses={losers} breakeven={be} />
      </div>

      {/* Calendar + Weekday */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CalendarPnl data={calendarData} />
        <PerformanceBar title="Performance by Weekday" data={weekdayPerf} />
      </div>

      {/* Setup breakdown */}
      <PerformanceBar title="Performance by Setup / Tag" data={setupPerf} maxItems={10} />

      {/* Empty state CTA */}
      {!hasTrades && (
        <div className="text-center py-16 space-y-4 border rounded-xl bg-muted/20">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <TrendingUp className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">No trades yet</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Add your first trade manually or import from a broker CSV
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button asChild>
              <Link href="/trades/new">
                <Plus className="w-4 h-4" />
                Add Trade
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/import">Import CSV</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
