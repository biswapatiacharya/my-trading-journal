-- ============================================================
-- Row-Level Security Policies
-- ============================================================

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- STRATEGIES
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own strategies" ON public.strategies
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- TAGS
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own tags" ON public.tags
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- TRADES
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own trades" ON public.trades
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- TRADE IMAGES
ALTER TABLE public.trade_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own trade images" ON public.trade_images
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- TRADE TAGS
ALTER TABLE public.trade_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage trade tags for own trades" ON public.trade_tags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.trades WHERE id = trade_id AND user_id = auth.uid())
  );

-- JOURNAL ENTRIES
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own journal entries" ON public.journal_entries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- AI INSIGHTS
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own AI insights" ON public.ai_insights
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert AI insights" ON public.ai_insights
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── Supabase Storage Bucket ──────────────────────────────────
-- Run in Supabase dashboard: Storage > New Bucket > trade-images (public: false)
-- Or via SQL:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trade-images',
  'trade-images',
  false,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT DO NOTHING;

CREATE POLICY "Users can upload own trade images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'trade-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own trade images" ON storage.objects
  FOR SELECT USING (bucket_id = 'trade-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own trade images" ON storage.objects
  FOR DELETE USING (bucket_id = 'trade-images' AND auth.uid()::text = (storage.foldername(name))[1]);
