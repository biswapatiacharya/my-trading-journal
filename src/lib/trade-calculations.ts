import type { Trade, DashboardStats, EquityCurvePoint, CalendarPnlData, PerformanceBreakdown } from "@/types";
import { format, parseISO, differenceInMinutes, parse } from "date-fns";

export function calculatePnl(
  direction: "long" | "short",
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  fees: number = 0
): number {
  const raw =
    direction === "long"
      ? (exitPrice - entryPrice) * quantity
      : (entryPrice - exitPrice) * quantity;
  return raw - fees;
}

export function calculatePnlPercentage(
  direction: "long" | "short",
  entryPrice: number,
  exitPrice: number
): number {
  if (direction === "long") {
    return ((exitPrice - entryPrice) / entryPrice) * 100;
  }
  return ((entryPrice - exitPrice) / entryPrice) * 100;
}

export function calculateRiskReward(
  direction: "long" | "short",
  entryPrice: number,
  stopLoss: number | null,
  takeProfit: number | null
): number | null {
  if (!stopLoss || !takeProfit) return null;
  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(takeProfit - entryPrice);
  if (risk === 0) return null;
  return reward / risk;
}

export function calculateRMultiple(
  pnl: number,
  entryPrice: number,
  stopLoss: number | null,
  quantity: number
): number | null {
  if (!stopLoss) return null;
  const riskPerShare = Math.abs(entryPrice - stopLoss);
  if (riskPerShare === 0) return null;
  const riskAmount = riskPerShare * quantity;
  return pnl / riskAmount;
}

export function calculateHoldingTime(
  date: string,
  entryTime: string | null,
  exitTime: string | null
): number | null {
  if (!entryTime || !exitTime) return null;
  try {
    const entryDt = parse(`${date} ${entryTime}`, "yyyy-MM-dd HH:mm", new Date());
    const exitDt = parse(`${date} ${exitTime}`, "yyyy-MM-dd HH:mm", new Date());
    return differenceInMinutes(exitDt, entryDt);
  } catch {
    return null;
  }
}

export function calculatePositionSize(entryPrice: number, quantity: number): number {
  return entryPrice * quantity;
}

// ── Dashboard Stats ──────────────────────────────────────────

export function calculateDashboardStats(
  trades: Trade[],
  period: "daily" | "weekly" | "monthly" = "daily"
): DashboardStats {
  const closedTrades = trades.filter((t) => t.status === "closed" && t.pnl !== null);
  const winners = closedTrades.filter((t) => (t.pnl ?? 0) > 0);
  const losers = closedTrades.filter((t) => (t.pnl ?? 0) < 0);

  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const grossProfit = winners.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const grossLoss = Math.abs(losers.reduce((sum, t) => sum + (t.pnl ?? 0), 0));

  const winRate = closedTrades.length > 0 ? (winners.length / closedTrades.length) * 100 : 0;
  const avgWinner = winners.length > 0 ? grossProfit / winners.length : 0;
  const avgLoser = losers.length > 0 ? grossLoss / losers.length : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const expectancy = closedTrades.length > 0 ? totalPnl / closedTrades.length : 0;

  // Streak
  const sorted = [...closedTrades].sort((a, b) => a.date.localeCompare(b.date));
  let currentStreak = 0;
  if (sorted.length > 0) {
    const lastPnl = sorted[sorted.length - 1].pnl ?? 0;
    const isWin = lastPnl > 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const pnl = sorted[i].pnl ?? 0;
      if (isWin ? pnl > 0 : pnl <= 0) {
        currentStreak += isWin ? 1 : -1;
      } else {
        break;
      }
    }
  }

  // Drawdown
  let peak = 0;
  let equity = 0;
  let maxDrawdown = 0;
  for (const t of sorted) {
    equity += t.pnl ?? 0;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Average R-multiple
  const rMultiples = closedTrades.filter((t) => t.r_multiple !== null).map((t) => t.r_multiple!);
  const avgRMultiple = rMultiples.length > 0 ? rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length : 0;

  // Avg holding time
  const holdingTimes = closedTrades.filter((t) => t.holding_time_minutes !== null).map((t) => t.holding_time_minutes!);
  const avgHoldingTime = holdingTimes.length > 0 ? holdingTimes.reduce((a, b) => a + b, 0) / holdingTimes.length : 0;

  // Long/Short win rates
  const longTrades = closedTrades.filter((t) => t.direction === "long");
  const shortTrades = closedTrades.filter((t) => t.direction === "short");
  const longWinRate =
    longTrades.length > 0 ? (longTrades.filter((t) => (t.pnl ?? 0) > 0).length / longTrades.length) * 100 : 0;
  const shortWinRate =
    shortTrades.length > 0 ? (shortTrades.filter((t) => (t.pnl ?? 0) > 0).length / shortTrades.length) * 100 : 0;

  // Periodic P&L (simplified — caller should filter by period)
  const today = format(new Date(), "yyyy-MM-dd");
  const dailyPnl = closedTrades.filter((t) => t.date === today).reduce((sum, t) => sum + (t.pnl ?? 0), 0);

  const weekStart = format(
    new Date(new Date().setDate(new Date().getDate() - new Date().getDay())),
    "yyyy-MM-dd"
  );
  const weeklyPnl = closedTrades.filter((t) => t.date >= weekStart).reduce((sum, t) => sum + (t.pnl ?? 0), 0);

  const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");
  const monthlyPnl = closedTrades.filter((t) => t.date >= monthStart).reduce((sum, t) => sum + (t.pnl ?? 0), 0);

  return {
    totalTrades: closedTrades.length,
    winRate,
    totalPnl,
    dailyPnl,
    weeklyPnl,
    monthlyPnl,
    avgWinner,
    avgLoser,
    profitFactor,
    largestDrawdown: maxDrawdown,
    currentStreak,
    expectancy,
    avgRMultiple,
    avgHoldingTime,
    longWinRate,
    shortWinRate,
  };
}

export function buildEquityCurve(trades: Trade[]): EquityCurvePoint[] {
  const closed = trades
    .filter((t) => t.status === "closed" && t.pnl !== null)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));

  let cumulative = 0;
  const points: EquityCurvePoint[] = [];

  const byDate: Record<string, Trade[]> = {};
  for (const t of closed) {
    byDate[t.date] = byDate[t.date] ?? [];
    byDate[t.date].push(t);
  }

  for (const [date, dayTrades] of Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b))) {
    const dayPnl = dayTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    cumulative += dayPnl;
    points.push({
      date,
      equity: cumulative,
      pnl: dayPnl,
      tradeCount: dayTrades.length,
    });
  }

  return points;
}

export function buildCalendarPnl(trades: Trade[]): CalendarPnlData {
  const result: CalendarPnlData = {};
  for (const t of trades) {
    if (t.status !== "closed" || t.pnl === null) continue;
    result[t.date] = result[t.date] ?? { pnl: 0, trades: 0 };
    result[t.date].pnl += t.pnl;
    result[t.date].trades += 1;
  }
  return result;
}

export function buildPerformanceBySetup(trades: Trade[]): PerformanceBreakdown[] {
  const closed = trades.filter((t) => t.status === "closed" && t.pnl !== null);
  const bySetup: Record<string, Trade[]> = {};

  for (const t of closed) {
    const tags = t.tags?.map((tag) => tag.name) ?? ["untagged"];
    for (const tag of tags) {
      bySetup[tag] = bySetup[tag] ?? [];
      bySetup[tag].push(t);
    }
  }

  return Object.entries(bySetup).map(([name, grpTrades]) => {
    const pnl = grpTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const winners = grpTrades.filter((t) => (t.pnl ?? 0) > 0).length;
    return {
      name,
      pnl,
      trades: grpTrades.length,
      winRate: grpTrades.length > 0 ? (winners / grpTrades.length) * 100 : 0,
      avgPnl: grpTrades.length > 0 ? pnl / grpTrades.length : 0,
    };
  }).sort((a, b) => b.pnl - a.pnl);
}

export function buildPerformanceBySymbol(trades: Trade[]): PerformanceBreakdown[] {
  const closed = trades.filter((t) => t.status === "closed" && t.pnl !== null);
  const bySymbol: Record<string, Trade[]> = {};

  for (const t of closed) {
    bySymbol[t.symbol] = bySymbol[t.symbol] ?? [];
    bySymbol[t.symbol].push(t);
  }

  return Object.entries(bySymbol).map(([name, grpTrades]) => {
    const pnl = grpTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const winners = grpTrades.filter((t) => (t.pnl ?? 0) > 0).length;
    return {
      name,
      pnl,
      trades: grpTrades.length,
      winRate: grpTrades.length > 0 ? (winners / grpTrades.length) * 100 : 0,
      avgPnl: grpTrades.length > 0 ? pnl / grpTrades.length : 0,
    };
  }).sort((a, b) => b.trades - a.trades);
}

export function buildPerformanceByWeekday(trades: Trade[]): PerformanceBreakdown[] {
  const closed = trades.filter((t) => t.status === "closed" && t.pnl !== null);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const byDay: Record<number, Trade[]> = {};

  for (const t of closed) {
    const day = parseISO(t.date).getDay();
    byDay[day] = byDay[day] ?? [];
    byDay[day].push(t);
  }

  return days.map((name, idx) => {
    const grpTrades = byDay[idx] ?? [];
    const pnl = grpTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const winners = grpTrades.filter((t) => (t.pnl ?? 0) > 0).length;
    return {
      name,
      pnl,
      trades: grpTrades.length,
      winRate: grpTrades.length > 0 ? (winners / grpTrades.length) * 100 : 0,
      avgPnl: grpTrades.length > 0 ? pnl / grpTrades.length : 0,
    };
  });
}

export function buildPerformanceByStrategy(trades: Trade[]): PerformanceBreakdown[] {
  const closed = trades.filter((t) => t.status === "closed" && t.pnl !== null);
  const byStrategy: Record<string, Trade[]> = {};

  for (const t of closed) {
    const name = t.strategy?.name ?? "No Strategy";
    byStrategy[name] = byStrategy[name] ?? [];
    byStrategy[name].push(t);
  }

  return Object.entries(byStrategy).map(([name, grpTrades]) => {
    const pnl = grpTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const winners = grpTrades.filter((t) => (t.pnl ?? 0) > 0).length;
    return {
      name,
      pnl,
      trades: grpTrades.length,
      winRate: grpTrades.length > 0 ? (winners / grpTrades.length) * 100 : 0,
      avgPnl: grpTrades.length > 0 ? pnl / grpTrades.length : 0,
    };
  }).sort((a, b) => b.pnl - a.pnl);
}

export function buildPerformanceByTimeOfDay(trades: Trade[]): PerformanceBreakdown[] {
  const closed = trades.filter((t) => t.status === "closed" && t.pnl !== null && t.time);
  const buckets: Record<string, Trade[]> = {
    "Pre-Market (4-9:30)": [],
    "Open (9:30-10)": [],
    "Mid-Morning (10-12)": [],
    "Lunch (12-14)": [],
    "Afternoon (14-15:30)": [],
    "Close (15:30-16)": [],
    "After Hours (16+)": [],
  };

  for (const t of closed) {
    if (!t.time) continue;
    const [h, m] = t.time.split(":").map(Number);
    const mins = h * 60 + m;
    if (mins < 9 * 60 + 30) buckets["Pre-Market (4-9:30)"].push(t);
    else if (mins < 10 * 60) buckets["Open (9:30-10)"].push(t);
    else if (mins < 12 * 60) buckets["Mid-Morning (10-12)"].push(t);
    else if (mins < 14 * 60) buckets["Lunch (12-14)"].push(t);
    else if (mins < 15 * 60 + 30) buckets["Afternoon (14-15:30)"].push(t);
    else if (mins < 16 * 60) buckets["Close (15:30-16)"].push(t);
    else buckets["After Hours (16+)"].push(t);
  }

  return Object.entries(buckets).map(([name, grpTrades]) => {
    const pnl = grpTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const winners = grpTrades.filter((t) => (t.pnl ?? 0) > 0).length;
    return {
      name,
      pnl,
      trades: grpTrades.length,
      winRate: grpTrades.length > 0 ? (winners / grpTrades.length) * 100 : 0,
      avgPnl: grpTrades.length > 0 ? pnl / grpTrades.length : 0,
    };
  });
}
