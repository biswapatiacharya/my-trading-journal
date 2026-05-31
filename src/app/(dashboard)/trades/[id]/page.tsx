import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TradeForm } from "@/components/trades/trade-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatPercent, formatDate, formatHoldingTime, getPnlColor } from "@/lib/utils";
import { ArrowLeft, Edit, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import { TradeScreenshots } from "@/components/trades/trade-screenshots";
import type { Trade, Strategy, Tag } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `Trade ${id.slice(0, 8)}` };
}

export default async function TradeDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { edit } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: trade } = await supabase
    .from("trades")
    .select(`
      *,
      strategy:strategies(id, name, color),
      tags:trade_tags(tag:tags(id, name, color)),
      images:trade_images(*)
    `)
    .eq("id", id)
    .eq("user_id", user!.id)
    .single();

  if (!trade) notFound();

  const normalised = {
    ...trade,
    tags: (trade.tags as { tag: Tag }[] | null)?.map((tt) => tt.tag) ?? [],
  } as Trade;

  const [{ data: strategies }, { data: tags }] = await Promise.all([
    supabase.from("strategies").select("*").eq("user_id", user!.id).order("name"),
    supabase.from("tags").select("*").eq("user_id", user!.id).order("name"),
  ]);

  if (edit === "1") {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={`/trades/${id}`}>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Edit Trade</h1>
            <p className="text-sm text-muted-foreground">{normalised.symbol} — {formatDate(normalised.date)}</p>
          </div>
        </div>
        <TradeForm
          trade={normalised}
          strategies={(strategies ?? []) as Strategy[]}
          tags={(tags ?? []) as Tag[]}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/trades"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{normalised.symbol}</h1>
              <Badge variant={normalised.direction === "long" ? "long" : "short"}>
                {normalised.direction === "long" ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                {normalised.direction}
              </Badge>
              <Badge variant="outline">{normalised.asset_type}</Badge>
              <Badge variant={normalised.status === "closed" ? "secondary" : "default"}>
                {normalised.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{formatDate(normalised.date)}{normalised.time && ` at ${normalised.time}`}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/trades/${id}?edit=1`}>
            <Edit className="w-4 h-4 mr-1" /> Edit
          </Link>
        </Button>
      </div>

      {/* P&L highlight */}
      {normalised.pnl !== null && (
        <Card className={normalised.pnl >= 0 ? "border-profit/30 bg-profit/5" : "border-loss/30 bg-loss/5"}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Net P&L</p>
              <div className="text-right">
                <p className={`text-3xl font-bold ${getPnlColor(normalised.pnl)}`}>
                  {formatCurrency(normalised.pnl)}
                </p>
                {normalised.pnl_percentage !== null && (
                  <p className={`text-sm ${getPnlColor(normalised.pnl_percentage)}`}>
                    {formatPercent(normalised.pnl_percentage)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Trade details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Trade Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ["Entry Price", formatCurrency(normalised.entry_price)],
              ["Exit Price", normalised.exit_price ? formatCurrency(normalised.exit_price) : "Open"],
              ["Quantity", normalised.quantity.toString()],
              ["Fees", formatCurrency(normalised.fees)],
              ["Position Size", normalised.position_size ? formatCurrency(normalised.position_size) : "—"],
              ["Holding Time", formatHoldingTime(normalised.holding_time_minutes)],
              ["Stop Loss", normalised.stop_loss ? formatCurrency(normalised.stop_loss) : "—"],
              ["Take Profit", normalised.take_profit ? formatCurrency(normalised.take_profit) : "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Performance metrics */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ["R/R Ratio", normalised.risk_reward_ratio ? `${normalised.risk_reward_ratio.toFixed(2)}:1` : "—"],
              ["R-Multiple", normalised.r_multiple ? `${normalised.r_multiple.toFixed(2)}R` : "—"],
              ["Strategy", normalised.strategy?.name ?? "—"],
              ["Confidence", normalised.confidence_score ? `${normalised.confidence_score}/10` : "—"],
              ["A+ Score", normalised.a_plus_score ? `${normalised.a_plus_score}/10` : "—"],
              ["Quality Score", normalised.trade_quality_score ? `${normalised.trade_quality_score}/100` : "—"],
              ["SPY Correlation", normalised.spy_correlation != null ? normalised.spy_correlation.toFixed(2) : "—"],
              ["GEX Level", normalised.gex_level ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Options details */}
      {normalised.asset_type === "options" && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <CardTitle className="text-base">Options Details</CardTitle>
              {normalised.option_type && (
                <Badge
                  variant="outline"
                  className={normalised.option_type === "call"
                    ? "border-profit/50 text-profit font-bold"
                    : "border-loss/50 text-loss font-bold"}
                >
                  {normalised.option_type.toUpperCase()}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {[
                ["Strike", normalised.option_strike ? formatCurrency(normalised.option_strike) : "—"],
                ["Expiry", normalised.option_expiry_date ? formatDate(normalised.option_expiry_date) : "—"],
                ["DTE at Entry", normalised.option_dte != null ? `${normalised.option_dte}d` : "—"],
                ["Premium", normalised.option_premium ? formatCurrency(normalised.option_premium) : "—"],
                ["Delta", normalised.option_delta != null ? normalised.option_delta.toFixed(3) : "—"],
                ["Theta", normalised.option_theta != null ? normalised.option_theta.toFixed(4) : "—"],
                ["IV", normalised.option_iv != null ? `${normalised.option_iv.toFixed(1)}%` : "—"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-semibold mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Exit legs */}
      {(normalised.exit_legs?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Exit Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {normalised.exit_legs!.map((leg, i) => {
                const legPnl = normalised.direction === "long"
                  ? (leg.exit_price - normalised.entry_price) * leg.quantity - leg.fees
                  : (normalised.entry_price - leg.exit_price) * leg.quantity - leg.fees;
                return (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="text-sm">
                      <span className="font-medium">Exit {i + 1}</span>
                      <span className="text-muted-foreground ml-2">{formatDate(leg.date)}</span>
                      <span className="text-muted-foreground ml-2">· {leg.quantity} @ {formatCurrency(leg.exit_price)}</span>
                      {leg.fees > 0 && <span className="text-muted-foreground ml-1">(fees: {formatCurrency(leg.fees)})</span>}
                    </div>
                    <span className={`text-sm font-semibold ${legPnl >= 0 ? "text-profit" : "text-loss"}`}>
                      {formatCurrency(legPnl)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tags & Emotions */}
      {((normalised.tags?.length ?? 0) > 0 || (normalised.emotions?.length ?? 0) > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(normalised.tags?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {normalised.tags?.map((tag) => (
                    <Badge key={tag.id} style={{ backgroundColor: tag.color, color: "white" }}>
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {(normalised.emotions?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Emotions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {normalised.emotions?.map((e) => (
                    <Badge key={e} variant="outline" className="capitalize">{e}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Notes */}
      {(normalised.setup_notes || normalised.notes) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {normalised.setup_notes && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Setup</p>
                <p className="text-sm whitespace-pre-wrap">{normalised.setup_notes}</p>
              </div>
            )}
            {normalised.setup_notes && normalised.notes && <Separator />}
            {normalised.notes && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Post-Trade</p>
                <p className="text-sm whitespace-pre-wrap">{normalised.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Screenshots */}
      <TradeScreenshots images={normalised.images ?? []} />
    </div>
  );
}
