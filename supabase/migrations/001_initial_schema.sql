-- ============================================================
-- Trading Journal – Initial Schema
-- ============================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────
-- PROFILES (extends auth.users)
-- ─────────────────────────────────────────────
CREATE TABLE public.profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email       TEXT,
  full_name   TEXT,
  avatar_url  TEXT,
  timezone    TEXT DEFAULT 'America/New_York',
  default_currency TEXT DEFAULT 'USD',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────
-- STRATEGIES
-- ─────────────────────────────────────────────
CREATE TABLE public.strategies (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT DEFAULT '#6366f1',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- ─────────────────────────────────────────────
-- TAGS
-- ─────────────────────────────────────────────
CREATE TABLE public.tags (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  color       TEXT DEFAULT '#6366f1',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- ─────────────────────────────────────────────
-- TRADES
-- ─────────────────────────────────────────────
CREATE TABLE public.trades (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

  -- Core trade info
  date          DATE NOT NULL,
  time          TIME,
  symbol        TEXT NOT NULL,
  direction     TEXT NOT NULL CHECK (direction IN ('long', 'short')),
  asset_type    TEXT NOT NULL DEFAULT 'stock'
                  CHECK (asset_type IN ('stock', 'options', 'futures', 'forex', 'crypto')),
  status        TEXT DEFAULT 'closed' CHECK (status IN ('open', 'closed', 'partial')),

  -- Prices & size
  entry_price   DECIMAL(20, 8) NOT NULL,
  exit_price    DECIMAL(20, 8),
  quantity      DECIMAL(20, 8) NOT NULL,
  fees          DECIMAL(20, 8) DEFAULT 0,
  stop_loss     DECIMAL(20, 8),
  take_profit   DECIMAL(20, 8),

  -- Calculated fields (stored for fast querying)
  pnl               DECIMAL(20, 8),
  pnl_percentage    DECIMAL(10, 4),
  risk_reward_ratio DECIMAL(10, 4),
  position_size     DECIMAL(20, 8),
  holding_time_minutes INTEGER,

  -- References
  strategy_id   UUID REFERENCES public.strategies(id) ON DELETE SET NULL,

  -- Notes & metadata
  notes         TEXT,
  setup_notes   TEXT,

  -- Psychological
  emotions      TEXT[],
  confidence_score INTEGER CHECK (confidence_score BETWEEN 1 AND 10),

  -- ── Trading-specific metrics ──
  first_breakout_of_day BOOLEAN DEFAULT FALSE,
  a_plus_score          INTEGER CHECK (a_plus_score BETWEEN 1 AND 10),
  trade_quality_score   DECIMAL(5, 2),
  r_multiple            DECIMAL(10, 4),
  spy_correlation       DECIMAL(5, 4),
  gex_level             TEXT,

  -- ── Options-specific fields ──
  option_delta   DECIMAL(10, 6),
  option_theta   DECIMAL(10, 6),
  option_iv      DECIMAL(10, 4),    -- implied volatility %
  option_dte     INTEGER,            -- days to expiry at entry
  option_strike  DECIMAL(20, 8),
  option_premium DECIMAL(20, 8),    -- premium paid per contract
  option_greeks  JSONB,             -- full greeks snapshot { gamma, vega, rho, ... }

  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TRADE IMAGES
-- ─────────────────────────────────────────────
CREATE TABLE public.trade_images (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id     UUID REFERENCES public.trades(id) ON DELETE CASCADE NOT NULL,
  user_id      UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  image_type   TEXT NOT NULL CHECK (image_type IN ('entry', 'exit', 'notes')),
  storage_path TEXT NOT NULL,
  public_url   TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TRADE TAGS (junction)
-- ─────────────────────────────────────────────
CREATE TABLE public.trade_tags (
  trade_id UUID REFERENCES public.trades(id) ON DELETE CASCADE,
  tag_id   UUID REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (trade_id, tag_id)
);

-- ─────────────────────────────────────────────
-- JOURNAL ENTRIES
-- ─────────────────────────────────────────────
CREATE TABLE public.journal_entries (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date                 DATE NOT NULL,
  market_conditions    TEXT,
  pre_market_notes     TEXT,
  post_market_notes    TEXT,
  lessons_learned      TEXT,
  psychological_state  TEXT,
  overall_rating       INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- ─────────────────────────────────────────────
-- AI INSIGHTS
-- ─────────────────────────────────────────────
CREATE TABLE public.ai_insights (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  insight_type   TEXT NOT NULL CHECK (insight_type IN ('pattern', 'behavioral', 'emotional', 'performance', 'recommendation')),
  title          TEXT NOT NULL,
  content        TEXT NOT NULL,
  severity       TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'success', 'critical')),
  metadata       JSONB,
  generated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────
CREATE INDEX idx_trades_user_id      ON public.trades(user_id);
CREATE INDEX idx_trades_date         ON public.trades(date DESC);
CREATE INDEX idx_trades_symbol       ON public.trades(symbol);
CREATE INDEX idx_trades_user_date    ON public.trades(user_id, date DESC);
CREATE INDEX idx_trades_status       ON public.trades(user_id, status);
CREATE INDEX idx_journal_user_date   ON public.journal_entries(user_id, date DESC);
CREATE INDEX idx_ai_insights_user    ON public.ai_insights(user_id, generated_at DESC);
CREATE INDEX idx_trade_images_trade  ON public.trade_images(trade_id);

-- ─────────────────────────────────────────────
-- UPDATED_AT TRIGGER
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_trades_updated_at
  BEFORE UPDATE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_journal_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
