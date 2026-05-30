import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(500).default(100),
  offset: z.coerce.number().min(0).default(0),
  status: z.enum(["open", "closed", "partial"]).optional(),
  symbol: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!user || error) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const params = querySchema.parse(Object.fromEntries(searchParams));

    let query = supabase
      .from("trades")
      .select(`*, strategy:strategies(id, name, color), tags:trade_tags(tag:tags(id, name, color)), images:trade_images(*)`, { count: "exact" })
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .range(params.offset, params.offset + params.limit - 1);

    if (params.status) query = query.eq("status", params.status);
    if (params.symbol) query = query.ilike("symbol", `%${params.symbol}%`);
    if (params.from) query = query.gte("date", params.from);
    if (params.to) query = query.lte("date", params.to);

    const { data, error: dbError, count } = await query;
    if (dbError) throw dbError;

    return NextResponse.json({ trades: data, count });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
