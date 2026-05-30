export type Direction = "long" | "short";
export type AssetType = "stock" | "options" | "futures" | "forex" | "crypto";
export type TradeStatus = "open" | "closed" | "partial";
export type InsightType = "pattern" | "behavioral" | "emotional" | "performance" | "recommendation";
export type InsightSeverity = "info" | "warning" | "success" | "critical";
export type ImageType = "entry" | "exit" | "notes";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  timezone: string;
  default_currency: string;
  created_at: string;
  updated_at: string;
}

export interface Strategy {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Trade {
  id: string;
  user_id: string;

  // Core
  date: string;
  time: string | null;
  symbol: string;
  direction: Direction;
  asset_type: AssetType;
  status: TradeStatus;

  // Prices
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  fees: number;
  stop_loss: number | null;
  take_profit: number | null;

  // Calculated
  pnl: number | null;
  pnl_percentage: number | null;
  risk_reward_ratio: number | null;
  position_size: number | null;
  holding_time_minutes: number | null;

  // Relations
  strategy_id: string | null;
  strategy?: Strategy;
  tags?: Tag[];
  images?: TradeImage[];

  // Notes
  notes: string | null;
  setup_notes: string | null;

  // Psychological
  emotions: string[] | null;
  confidence_score: number | null;

  // Trading-specific
  first_breakout_of_day: boolean;
  a_plus_score: number | null;
  trade_quality_score: number | null;
  r_multiple: number | null;
  spy_correlation: number | null;
  gex_level: string | null;

  // Options-specific
  option_delta: number | null;
  option_theta: number | null;
  option_iv: number | null;
  option_dte: number | null;
  option_strike: number | null;
  option_premium: number | null;
  option_greeks: Record<string, number> | null;

  created_at: string;
  updated_at: string;
}

export interface TradeImage {
  id: string;
  trade_id: string;
  user_id: string;
  image_type: ImageType;
  storage_path: string;
  public_url: string;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  date: string;
  market_conditions: string | null;
  pre_market_notes: string | null;
  post_market_notes: string | null;
  lessons_learned: string | null;
  psychological_state: string | null;
  overall_rating: number | null;
  created_at: string;
  updated_at: string;
}

export interface AIInsight {
  id: string;
  user_id: string;
  insight_type: InsightType;
  title: string;
  content: string;
  severity: InsightSeverity;
  metadata: Record<string, unknown> | null;
  generated_at: string;
}

// ── Form types ──────────────────────────────────────────────
export interface TradeFormData {
  date: string;
  time: string;
  symbol: string;
  direction: Direction;
  asset_type: AssetType;
  status: TradeStatus;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  fees: number;
  stop_loss: number | null;
  take_profit: number | null;
  strategy_id: string | null;
  notes: string;
  setup_notes: string;
  emotions: string[];
  confidence_score: number;
  first_breakout_of_day: boolean;
  a_plus_score: number | null;
  trade_quality_score: number | null;
  r_multiple: number | null;
  spy_correlation: number | null;
  gex_level: string;
  // Options
  option_delta: number | null;
  option_theta: number | null;
  option_iv: number | null;
  option_dte: number | null;
  option_strike: number | null;
  option_premium: number | null;
  // Tags
  tag_ids: string[];
}

// ── Dashboard / analytics types ──────────────────────────────
export interface DashboardStats {
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  dailyPnl: number;
  weeklyPnl: number;
  monthlyPnl: number;
  avgWinner: number;
  avgLoser: number;
  profitFactor: number;
  largestDrawdown: number;
  currentStreak: number;
  expectancy: number;
  avgRMultiple: number;
  avgHoldingTime: number;
  longWinRate: number;
  shortWinRate: number;
}

export interface EquityCurvePoint {
  date: string;
  equity: number;
  pnl: number;
  tradeCount: number;
}

export interface CalendarPnlData {
  [date: string]: {
    pnl: number;
    trades: number;
  };
}

export interface PerformanceBreakdown {
  name: string;
  pnl: number;
  trades: number;
  winRate: number;
  avgPnl: number;
}

// ── CSV import types ──────────────────────────────────────────
export type BrokerFormat =
  | "webull"
  | "interactive_brokers"
  | "robinhood"
  | "thinkorswim"
  | "tradestation"
  | "public"
  | "generic";

export interface CsvColumnMapping {
  date: string;
  time?: string;
  symbol: string;
  direction: string;
  entry_price: string;
  exit_price?: string;
  quantity: string;
  fees?: string;
  pnl?: string;
}

export interface ImportedTrade {
  date: string;
  time?: string;
  symbol: string;
  direction: Direction;
  entry_price: number;
  exit_price?: number;
  quantity: number;
  fees: number;
  pnl?: number;
  asset_type: AssetType;
}
