-- ============================================================
-- Demo Seed Data (run after creating a demo user in Supabase Auth)
-- Replace DEMO_USER_ID with the actual UUID from auth.users
-- ============================================================

DO $$
DECLARE
  demo_user_id UUID;
  strat_momentum UUID;
  strat_breakout UUID;
  strat_reversal UUID;
  tag_breakout UUID;
  tag_scalp UUID;
  tag_swing UUID;
  tag_fomo UUID;
  tag_revenge UUID;
  tag_news UUID;
BEGIN
  -- Create a demo profile (the trigger handles this for real sign-ups)
  -- For seeding, use: SELECT id FROM auth.users WHERE email = 'demo@tradingjournal.com'
  -- demo_user_id := '<replace-with-actual-uuid>';
  -- RETURN; -- Remove this line when you have a real demo user ID
  RETURN; -- Skip seed if no demo user

  -- Strategies
  INSERT INTO public.strategies (id, user_id, name, description, color) VALUES
    (gen_random_uuid(), demo_user_id, 'Momentum', 'Ride strong momentum moves', '#6366f1'),
    (gen_random_uuid(), demo_user_id, 'Breakout', 'Key level breakouts with volume', '#22c55e'),
    (gen_random_uuid(), demo_user_id, 'Reversal', 'Mean reversion at extremes', '#f59e0b')
  RETURNING id INTO strat_momentum;

  -- Tags
  INSERT INTO public.tags (id, user_id, name, color) VALUES
    (gen_random_uuid(), demo_user_id, 'breakout',     '#6366f1'),
    (gen_random_uuid(), demo_user_id, 'scalp',        '#22c55e'),
    (gen_random_uuid(), demo_user_id, 'swing',        '#3b82f6'),
    (gen_random_uuid(), demo_user_id, 'fomo',         '#f59e0b'),
    (gen_random_uuid(), demo_user_id, 'revenge trade','#ef4444'),
    (gen_random_uuid(), demo_user_id, 'news play',    '#8b5cf6');

END $$;
