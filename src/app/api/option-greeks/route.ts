import { NextResponse } from "next/server";

// Build OCC option symbol: O:AAPL250620C00150000
function buildOccSymbol(symbol: string, expiryDate: string, type: "call" | "put", strike: number): string {
  const [year, month, day] = expiryDate.split("-");
  const dateStr = `${year.slice(2)}${month}${day}`;
  const typeChar = type === "call" ? "C" : "P";
  const strikePadded = Math.round(strike * 1000).toString().padStart(8, "0");
  return `O:${symbol.toUpperCase()}${dateStr}${typeChar}${strikePadded}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();
  const expiry = searchParams.get("expiry");        // YYYY-MM-DD
  const strike = parseFloat(searchParams.get("strike") ?? "");
  const type = searchParams.get("type") as "call" | "put" | null;

  if (!symbol || !expiry || isNaN(strike) || !type) {
    return NextResponse.json({ error: "symbol, expiry, strike, and type are required" }, { status: 400 });
  }

  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "POLYGON_API_KEY not configured" }, { status: 500 });
  }

  const occSymbol = buildOccSymbol(symbol, expiry, type, strike);

  try {
    const res = await fetch(
      `https://api.polygon.io/v3/snapshot/options/${encodeURIComponent(symbol)}/${encodeURIComponent(occSymbol)}?apiKey=${apiKey}`,
      { next: { revalidate: 60 } }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `Polygon returned ${res.status}`);
    }

    const data = await res.json();
    const result = data.results;

    if (!result) throw new Error("No data for this contract");

    const greeks = result.greeks ?? {};
    const iv = result.implied_volatility;
    const lastPrice =
      result.last_quote?.midpoint ??
      result.day?.close ??
      result.day?.last;

    return NextResponse.json({
      occSymbol,
      delta: greeks.delta ?? null,
      gamma: greeks.gamma ?? null,
      theta: greeks.theta ?? null,
      vega: greeks.vega ?? null,
      iv: iv != null ? Number((iv * 100).toFixed(2)) : null, // convert 0.35 → 35.00%
      lastPrice: lastPrice ? Number(lastPrice.toFixed(4)) : null,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch option Greeks" },
      { status: 500 }
    );
  }
}
