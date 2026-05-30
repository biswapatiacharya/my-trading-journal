import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const importSchema = z.object({
  trades: z.array(z.object({
    date: z.string(),
    time: z.string().optional().nullable(),
    symbol: z.string(),
    direction: z.enum(["long", "short"]),
    asset_type: z.enum(["stock", "options", "futures", "forex", "crypto"]).default("stock"),
    entry_price: z.number().positive(),
    exit_price: z.number().positive().optional().nullable(),
    quantity: z.number().positive(),
    fees: z.number().min(0).default(0),
    pnl: z.number().optional().nullable(),
    pnl_percentage: z.number().optional().nullable(),
    position_size: z.number().optional().nullable(),
    strategy_id: z.string().optional().nullable(),
    status: z.enum(["open", "closed"]).default("closed"),
  })),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!user || error) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { trades } = importSchema.parse(body);

    const records = trades.map((t) => ({ ...t, user_id: user.id }));

    let imported = 0;
    for (let i = 0; i < records.length; i += 50) {
      const { error: insertError } = await supabase.from("trades").insert(records.slice(i, i + 50));
      if (insertError) throw insertError;
      imported += Math.min(50, records.length - i);
    }

    return NextResponse.json({ imported });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: err.errors }, { status: 422 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
