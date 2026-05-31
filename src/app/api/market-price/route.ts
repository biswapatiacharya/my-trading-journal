import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();

  if (!symbol) {
    return NextResponse.json({ error: "Symbol required" }, { status: 400 });
  }

  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "POLYGON_API_KEY not configured" }, { status: 500 });
  }

  try {
    // Snapshot gives real-time quote (or last available on free tier)
    const res = await fetch(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(symbol)}?apiKey=${apiKey}`,
      { next: { revalidate: 30 } }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `Polygon returned ${res.status}`);
    }

    const data = await res.json();
    const ticker = data.ticker;

    // Prefer last trade price → day close → previous day close
    const price =
      ticker?.lastTrade?.p ??
      ticker?.day?.c ??
      ticker?.prevDay?.c;

    if (!price) {
      throw new Error("Price unavailable for this symbol");
    }

    return NextResponse.json({ symbol, price: Number(price.toFixed(4)) });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch price" },
      { status: 500 }
    );
  }
}
