-- ============================================================
-- RESET + FULL SETUP — paste this entire file into the
-- Supabase SQL Editor and click Run.
-- Safe to run multiple times (idempotent).
-- ============================================================

-- ── 1. Drop everything in reverse dependency order ───────────
DROP TRIGGER IF EXISTS set_profiles_updated_at   ON public.profiles;
DROP TRIGGER IF EXISTS set_trades_updated_at      ON public.trades;
DROP TRIGGER IF EXISTS set_journal_updated_at     ON public.journal_entries;
DROP TRIGGER IF EXISTS on_auth_user_created       ON auth.users;

DROP FUNCTION IF EXISTS public.set_updated_at()   CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user()  CASCADE;

DROP TABLE IF EXISTS public.ai_insights      CASCADE;
DROP TABLE IF EXISTS public.journal_entries  CASCADE;
DROP TABLE IF EXISTS public.trade_tags       CASCADE;
DROP TABLE IF EXISTS public.trade_images     CASCADE;
DROP TABLE IF EXISTS public.trades           CASCADE;
DROP TABLE IF EXISTS public.tags             CASCADE;
DROP TABLE IF EXISTS public.strategies       CASCADE;
DROP TABLE IF EXISTS public.profiles         CASCADE;

-- ── 2. Extensions ────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 3. Tables ────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id               UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email            TEXT,
  full_name        TEXT,
  avatar_url       TEXT,
  timezone         TEXT DEFAULT 'America/New_York',
  default_currency TEXT DEFAULT 'USD',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.strategies (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT DEFAULT '#6366f1',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE TABLE public.tags (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  color      TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE TABLE public.trades (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date          DATE NOT NULL,
  time          TIME,
  symbol        TEXT NOT NULL,
  direction     TEXT NOT NULL CHECK (direction IN ('long', 'short')),
  asset_type    TEXT NOT NULL DEFAULT 'stock'
                  CHECK (asset_type IN ('stock', 'options', 'futures', 'forex', 'crypto')),
  status        TEXT DEFAULT 'closed' CHECK (status IN ('open', 'closed', 'partial')),
  entry_price   DECIMAL(20, 8) NOT NULL,
  exit_price    DECIMAL(20, 8),
  quantity      DECIMAL(20, 8) NOT NULL,
  fees          DECIMAL(20, 8) DEFAULT 0,
  stop_loss     DECIMAL(20, 8),
  take_profit   DECIMAL(20, 8),
  pnl               DECIMAL(20, 8),
  pnl_percentage    DECIMAL(10, 4),
  risk_reward_ratio DECIMAL(10, 4),
  position_size     DECIMAL(20, 8),
  holding_time_minutes INTEGER,
  strategy_id   UUID REFERENCES public.strategies(id) ON DELETE SET NULL,
  notes         TEXT,
  setup_notes   TEXT,
  emotions      TEXT[],
  confidence_score INTEGER CHECK (confidence_score BETWEEN 1 AND 10),
  first_breakout_of_day BOOLEAN DEFAULT FALSE,
  a_plus_score          INTEGER CHECK (a_plus_score BETWEEN 1 AND 10),
  trade_quality_score   DECIMAL(5, 2),
  r_multiple            DECIMAL(10, 4),
  spy_correlation       DECIMAL(5, 4),
  gex_level             TEXT,
  option_delta   DECIMAL(10, 6),
  option_theta   DECIMAL(10, 6),
  option_iv      DECIMAL(10, 4),
  option_dte     INTEGER,
  option_strike  DECIMAL(20, 8),
  option_premium DECIMAL(20, 8),
  option_greeks  JSONB,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.trade_images (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id     UUID REFERENCES public.trades(id) ON DELETE CASCADE NOT NULL,
  user_id      UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  image_type   TEXT NOT NULL CHECK (image_type IN ('entry', 'exit', 'notes')),
  storage_path TEXT NOT NULL,
  public_url   TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.trade_tags (
  trade_id UUID REFERENCES public.trades(id) ON DELETE CASCADE,
  tag_id   UUID REFERENCES public.tags(id)   ON DELETE CASCADE,
  PRIMARY KEY (trade_id, tag_id)
);

CREATE TABLE public.journal_entries (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date                DATE NOT NULL,
  market_conditions   TEXT,
  pre_market_notes    TEXT,
  post_market_notes   TEXT,
  lessons_learned     TEXT,
  psychological_state TEXT,
  overall_rating      INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE TABLE public.ai_insights (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('pattern','behavioral','emotional','performance','recommendation')),
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  severity     TEXT DEFAULT 'info' CHECK (severity IN ('info','warning','success','critical')),
  metadata     JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. Indexes ───────────────────────────────────────────────
CREATE INDEX idx_trades_user_id    ON public.trades(user_id);
CREATE INDEX idx_trades_date       ON public.trades(date DESC);
CREATE INDEX idx_trades_symbol     ON public.trades(symbol);
CREATE INDEX idx_trades_user_date  ON public.trades(user_id, date DESC);
CREATE INDEX idx_trades_status     ON public.trades(user_id, status);
CREATE INDEX idx_journal_user_date ON public.journal_entries(user_id, date DESC);
CREATE INDEX idx_ai_insights_user  ON public.ai_insights(user_id, generated_at DESC);
CREATE INDEX idx_trade_images_trade ON public.trade_images(trade_id);

-- ── 5. Functions & Triggers ──────────────────────────────────
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

-- ── 6. Row-Level Security ────────────────────────────────────
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_images   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_tags     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can CRUD own strategies"
  ON public.strategies FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own tags"
  ON public.tags FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own trades"
  ON public.trades FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own trade images"
  ON public.trade_images FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage trade tags for own trades"
  ON public.trade_tags FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.trades WHERE id = trade_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can CRUD own journal entries"
  ON public.journal_entries FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own AI insights"
  ON public.ai_insights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own AI insights"
  ON public.ai_insights FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── 7. Storage bucket ────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trade-images', 'trade-images', false, 5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own trade images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own trade images"  ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own trade images" ON storage.objects;

CREATE POLICY "Users can upload own trade images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'trade-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Users can view own trade images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'trade-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Users can delete own trade images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'trade-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── Done ─────────────────────────────────────────────────────
SELECT 'Database setup complete ✓' AS status;
