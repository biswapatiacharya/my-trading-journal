# Trading Journal

An AI-powered personal trading journal — track, review, and improve your trading performance.

## Features

- **Dashboard** — Daily/weekly/monthly P&L, win rate, profit factor, drawdown, streak, expectancy, R-multiple
- **Trade Log** — Full trade entry with options Greeks, A+ score, GEX tagging, SPY correlation
- **Analytics** — Equity curve, calendar P&L, performance by weekday/time/symbol/strategy/setup
- **AI Insights** — Claude AI analyses patterns, behaviors, and gives actionable recommendations
- **Journal** — Daily pre/post market notes with trade correlation
- **CSV Import** — Webull, IBKR, Robinhood, ThinkOrSwim, TradeStation, Public
- **PWA** — Installable on mobile, offline support, bottom nav

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS, ShadCN UI |
| Charts | Recharts |
| Backend | Next.js API Routes + Server Actions |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (Google + Email + Guest) |
| Storage | Supabase Storage (trade screenshots) |
| AI | Anthropic Claude (claude-sonnet-4-6) |
| Hosting | Vercel (free tier) |

---

## Quick Start

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) account (free)
- A [Vercel](https://vercel.com) account (free)
- An [Anthropic](https://anthropic.com) API key (for AI insights)

### 1. Install dependencies

```bash
npm install
```

> You may need to install `tailwindcss-animate` manually:
> ```bash
> npm install tailwindcss-animate
> ```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migrations in order:
   ```
   supabase/migrations/001_initial_schema.sql
   supabase/migrations/002_rls_policies.sql
   ```
3. (Optional) Enable Google OAuth:
   - Go to **Authentication → Providers → Google**
   - Add your Google OAuth credentials
4. Get your project URL and keys from **Settings → API**

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-your-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Generate PWA icons

The app needs PNG icons in `public/icons/`. You can generate them from any SVG/PNG logo:
- `public/icons/icon-192.png` (192×192)
- `public/icons/icon-512.png` (512×512)
- `public/icons/apple-touch-icon.png` (180×180)

Use [pwa-asset-generator](https://github.com/elegantapp/pwa-asset-generator) or any image editor.

---

## Deployment

### Deploy to Vercel

1. Push to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/trading-journal.git
   git push -u origin main
   ```

2. Connect to Vercel:
   - Go to [vercel.com](https://vercel.com) → New Project
   - Import your GitHub repository
   - Add all environment variables from `.env.local`
   - Deploy

3. Update Supabase redirect URLs:
   - Go to **Supabase → Authentication → URL Configuration**
   - Add your Vercel URL to **Redirect URLs**: `https://your-app.vercel.app/auth/callback`
   - Set **Site URL**: `https://your-app.vercel.app`

### Install as Mobile App (PWA)

**iOS:**
1. Open the app in Safari
2. Tap the Share button → "Add to Home Screen"

**Android:**
1. Open in Chrome
2. Tap the menu → "Add to Home Screen"
   or look for the install prompt in the address bar

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/          # Auth page (login + signup + guest)
│   ├── (dashboard)/
│   │   ├── dashboard/         # Main dashboard with all metrics
│   │   ├── trades/            # Trade list, new trade, trade detail
│   │   ├── analytics/         # Charts and performance analysis
│   │   ├── journal/           # Daily journal entries
│   │   ├── ai-insights/       # AI-powered analysis
│   │   ├── import/            # CSV broker import
│   │   └── settings/          # Profile, strategies, tags
│   ├── api/
│   │   ├── ai-insights/       # POST /api/ai-insights
│   │   ├── trades/            # GET /api/trades
│   │   └── import/            # POST /api/import
│   └── auth/callback/         # Supabase OAuth callback
├── components/
│   ├── ui/                    # ShadCN UI components
│   ├── navigation/            # Sidebar, mobile nav, topbar
│   ├── dashboard/             # MetricCard
│   ├── charts/                # EquityCurve, WinLossPie, PerformanceBar, CalendarPnl
│   ├── trades/                # TradeForm, TradeListClient
│   ├── journal/               # JournalClient
│   ├── ai/                    # AIInsightsClient
│   ├── import/                # ImportClient
│   └── providers/             # ThemeProvider, PwaRegister
├── lib/
│   ├── supabase/              # client.ts, server.ts
│   ├── utils.ts               # Formatting, colors, constants
│   ├── trade-calculations.ts  # P&L, stats, chart data builders
│   └── csv-parsers.ts         # Broker CSV parsers
└── types/
    └── index.ts               # All TypeScript types
supabase/
├── migrations/
│   ├── 001_initial_schema.sql # Tables, triggers, indexes
│   └── 002_rls_policies.sql   # Row-level security + storage
└── seed.sql                   # Demo data seed
public/
├── manifest.json              # PWA manifest
├── sw.js                      # Service worker
└── icons/                     # PWA icons (add your own)
```

---

## Adding a Demo Account

1. Create a user in Supabase Auth dashboard with email `demo@tradingjournal.app`
2. Set the password to `demo123456` (or update `NEXT_PUBLIC_DEMO_EMAIL` / `NEXT_PUBLIC_DEMO_PASSWORD`)
3. Add sample trades via the UI or the seed file

---

## CSV Import Format (Generic)

If your broker isn't listed, use Generic CSV with these column headers:

| Column | Required | Description |
|--------|----------|-------------|
| `date` | ✅ | Trade date (YYYY-MM-DD or MM/DD/YYYY) |
| `time` | ❌ | Trade time (HH:MM) |
| `symbol` | ✅ | Ticker symbol |
| `direction` | ✅ | long/short or buy/sell |
| `entry_price` | ✅ | Entry price |
| `exit_price` | ❌ | Exit price |
| `quantity` | ✅ | Number of shares/contracts |
| `fees` | ❌ | Commission/fees |
| `pnl` | ❌ | Net P&L (auto-calculated if not provided) |

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server only) |
| `ANTHROPIC_API_KEY` | For AI | Anthropic Claude API key |
| `NEXT_PUBLIC_APP_URL` | ✅ | Your app URL |
| `NEXT_PUBLIC_DEMO_EMAIL` | ❌ | Demo account email |
| `NEXT_PUBLIC_DEMO_PASSWORD` | ❌ | Demo account password |

---

## License

Personal use. Not for redistribution.
