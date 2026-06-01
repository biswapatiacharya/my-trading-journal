"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload, X, Plus, RefreshCw, Sparkles } from "lucide-react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  calculatePnl, calculatePnlPercentage, calculateRiskReward,
  calculateRMultiple, calculatePositionSize,
} from "@/lib/trade-calculations";
import { EMOTION_OPTIONS, formatCurrency, formatPercent, cn } from "@/lib/utils";
import type { Trade, Strategy, Tag } from "@/types";
import { format } from "date-fns";

// ── Schemas ──────────────────────────────────────────────────
const exitLegSchema = z.object({
  quantity: z.coerce.number().positive("Required"),
  exit_price: z.coerce.number().positive("Required"),
  date: z.string().min(1, "Required"),
  time: z.string().optional().default(""),
  fees: z.coerce.number().min(0).default(0),
});

const tradeSchema = z.object({
  date: z.string().min(1, "Date is required"),
  time: z.string().optional(),
  symbol: z.string().min(1, "Symbol is required").transform((v) => v.toUpperCase()),
  direction: z.enum(["long", "short"]),
  asset_type: z.enum(["stock", "options", "futures", "forex", "crypto"]),
  status: z.enum(["open", "closed", "partial"]),
  entry_price: z.coerce.number().positive("Entry price must be positive"),
  exit_price: z.coerce.number().positive().optional().nullable(),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  fees: z.coerce.number().min(0).default(0),
  stop_loss: z.coerce.number().positive().optional().nullable(),
  take_profit: z.coerce.number().positive().optional().nullable(),
  strategy_id: z.string().optional().nullable(),
  notes: z.string().optional(),
  setup_notes: z.string().optional(),
  emotions: z.array(z.string()).default([]),
  confidence_score: z.number().min(1).max(10).default(5),
  first_breakout_of_day: z.boolean().default(false),
  a_plus_score: z.coerce.number().min(1).max(10).optional().nullable(),
  trade_quality_score: z.coerce.number().min(0).max(100).optional().nullable(),
  r_multiple: z.coerce.number().optional().nullable(),
  spy_correlation: z.coerce.number().min(-1).max(1).optional().nullable(),
  gex_level: z.string().optional(),
  // Options
  option_type: z.enum(["call", "put"]).optional().nullable(),
  option_expiry_date: z.string().optional().nullable(),
  option_delta: z.coerce.number().optional().nullable(),
  option_theta: z.coerce.number().optional().nullable(),
  option_iv: z.coerce.number().min(0).optional().nullable(),
  option_dte: z.coerce.number().int().min(0).optional().nullable(),
  option_strike: z.coerce.number().positive().optional().nullable(),
  option_premium: z.coerce.number().positive().optional().nullable(),
  // Tags
  tag_ids: z.array(z.string()).default([]),
  // Exit legs for partial exits
  exit_legs: z.array(exitLegSchema).default([]),
});

type FormData = z.infer<typeof tradeSchema>;

interface TradeFormProps {
  trade?: Trade;
  strategies: Strategy[];
  tags: Tag[];
}

export function TradeForm({ trade, strategies, tags }: TradeFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const isEdit = !!trade;

  const [saving, setSaving] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState<"entry" | "exit" | null>(null);
  const [fetchingGreeks, setFetchingGreeks] = useState(false);
  const [images, setImages] = useState<{ type: "entry" | "exit" | "notes"; file?: File; url: string; existing?: boolean; id?: string }[]>(
    trade?.images?.map((img) => ({ type: img.image_type, url: img.public_url, existing: true, id: img.id })) ?? []
  );
  const [, setShowOptions] = useState(trade?.asset_type === "options");

  // Seed exit legs: if editing a legacy trade with exit_price but no legs, create one leg
  const seedLegs = useMemo(() => {
    if (trade?.exit_legs && trade.exit_legs.length > 0) return trade.exit_legs;
    if (trade?.exit_price) {
      return [{
        quantity: trade.quantity,
        exit_price: trade.exit_price,
        date: trade.date,
        time: trade.time ?? "",
        fees: 0,
      }];
    }
    return [];
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const form = useForm<FormData>({
    resolver: zodResolver(tradeSchema),
    defaultValues: {
      date: trade?.date ?? "",
      time: trade?.time ?? "",
      symbol: trade?.symbol ?? "",
      direction: trade?.direction ?? "long",
      asset_type: trade?.asset_type ?? "stock",
      status: trade?.status ?? "closed",
      entry_price: trade?.entry_price ?? (undefined as unknown as number),
      exit_price: seedLegs.length > 0 ? null : (trade?.exit_price ?? null),
      quantity: trade?.quantity ?? (undefined as unknown as number),
      fees: trade?.fees ?? 0,
      stop_loss: trade?.stop_loss ?? null,
      take_profit: trade?.take_profit ?? null,
      strategy_id: trade?.strategy_id ?? null,
      notes: trade?.notes ?? "",
      setup_notes: trade?.setup_notes ?? "",
      emotions: trade?.emotions ?? [],
      confidence_score: trade?.confidence_score ?? 5,
      first_breakout_of_day: trade?.first_breakout_of_day ?? false,
      a_plus_score: trade?.a_plus_score ?? null,
      trade_quality_score: trade?.trade_quality_score ?? null,
      r_multiple: trade?.r_multiple ?? null,
      spy_correlation: trade?.spy_correlation ?? null,
      gex_level: trade?.gex_level ?? "",
      option_type: trade?.option_type ?? null,
      option_expiry_date: trade?.option_expiry_date ?? null,
      option_delta: trade?.option_delta ?? null,
      option_theta: trade?.option_theta ?? null,
      option_iv: trade?.option_iv ?? null,
      option_dte: trade?.option_dte ?? null,
      option_strike: trade?.option_strike ?? null,
      option_premium: trade?.option_premium ?? null,
      tag_ids: trade?.tags?.map((t) => t.id) ?? [],
      exit_legs: seedLegs,
    },
  });

  // Set date/time on mount for new trades
  useEffect(() => {
    if (!trade) {
      form.setValue("date", format(new Date(), "yyyy-MM-dd"));
      form.setValue("time", format(new Date(), "HH:mm"));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Exit legs field array
  const { fields: exitFields, append: appendExit, remove: removeExit } = useFieldArray({
    control: form.control,
    name: "exit_legs",
  });

  const watchedValues = form.watch(["direction", "entry_price", "exit_price", "quantity", "fees", "stop_loss", "take_profit", "asset_type"]);
  const [direction, entryPrice, exitPrice, quantity, fees, stopLoss, takeProfit, assetType] = watchedValues;
  const exitLegs = form.watch("exit_legs");
  const watchedExpiry = form.watch("option_expiry_date");

  // Auto-calculate DTE when expiry date changes
  useEffect(() => {
    if (!watchedExpiry) return;
    const tradeDate = form.getValues("date") || new Date().toISOString().split("T")[0];
    const dte = Math.max(0, Math.round(
      (new Date(watchedExpiry).getTime() - new Date(tradeDate).getTime()) / 86_400_000
    ));
    form.setValue("option_dte", dte);
  }, [watchedExpiry]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show/hide options section based on asset type
  useEffect(() => {
    setShowOptions(assetType === "options");
  }, [assetType]);

  // Compute remaining quantity and per-leg P&L
  const totalExited = useMemo(
    () => exitLegs.reduce((s, l) => s + (Number(l.quantity) || 0), 0),
    [exitLegs]
  );
  const remaining = (Number(quantity) || 0) - totalExited;

  const legPnls = useMemo(() => {
    if (!entryPrice) return exitLegs.map(() => null);
    const ep = Number(entryPrice);
    return exitLegs.map((l) => {
      if (!l.exit_price || !l.quantity) return null;
      const legFees = Number(l.fees) || 0;
      return direction === "long"
        ? (Number(l.exit_price) - ep) * Number(l.quantity) - legFees
        : (ep - Number(l.exit_price)) * Number(l.quantity) - legFees;
    });
  }, [exitLegs, entryPrice, direction]);

  const totalLegPnl = useMemo(
    () => legPnls.reduce<number>((s, p) => s + (p ?? 0), 0),
    [legPnls]
  );

  // Live P&L preview (single exit mode)
  const liveCalc = useCallback(() => {
    if (!entryPrice || !quantity) return null;
    const ep = Number(entryPrice);
    const xp = exitPrice ? Number(exitPrice) : null;
    const qty = Number(quantity);
    const f = Number(fees) || 0;
    const sl = stopLoss ? Number(stopLoss) : null;
    const tp = takeProfit ? Number(takeProfit) : null;

    const pnl = xp !== null ? calculatePnl(direction, ep, xp, qty, f) : null;
    const pnlPct = xp !== null ? calculatePnlPercentage(direction, ep, xp) : null;
    const rr = calculateRiskReward(direction, ep, sl, tp);
    const posSize = calculatePositionSize(ep, qty);
    const rm = pnl !== null ? calculateRMultiple(pnl, ep, sl, qty) : null;

    return { pnl, pnlPct, rr, posSize, rm };
  }, [direction, entryPrice, exitPrice, quantity, fees, stopLoss, takeProfit]);

  const calc = exitLegs.length === 0 ? liveCalc() : null;

  async function fetchGreeks() {
    const symbol = form.getValues("symbol");
    const expiry = form.getValues("option_expiry_date");
    const strike = form.getValues("option_strike");
    const optionType = form.getValues("option_type");
    if (!symbol) { toast.error("Enter a symbol first (Core tab)"); return; }
    if (!expiry) { toast.error("Select an expiry date first"); return; }
    if (!strike) { toast.error("Enter a strike price first"); return; }
    if (!optionType) { toast.error("Select CALL or PUT first"); return; }
    setFetchingGreeks(true);
    try {
      const res = await fetch(
        `/api/option-greeks?symbol=${encodeURIComponent(symbol)}&expiry=${expiry}&strike=${strike}&type=${optionType}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      if (json.delta != null) form.setValue("option_delta", json.delta);
      if (json.theta != null) form.setValue("option_theta", json.theta);
      if (json.iv != null) form.setValue("option_iv", json.iv);
      if (json.lastPrice != null) form.setValue("option_premium", json.lastPrice);
      toast.success(`Greeks fetched for ${json.occSymbol}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not fetch Greeks");
    } finally {
      setFetchingGreeks(false);
    }
  }

  async function fetchPrice(field: "entry" | "exit") {
    const symbol = form.getValues("symbol");
    if (!symbol) { toast.error("Enter a symbol first"); return; }
    setFetchingPrice(field);
    try {
      const res = await fetch(`/api/market-price?symbol=${encodeURIComponent(symbol)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      if (field === "entry") form.setValue("entry_price", json.price);
      else form.setValue("exit_price", json.price);
      toast.success(`${symbol} price: $${json.price}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Price unavailable");
    } finally {
      setFetchingPrice(null);
    }
  }

  async function uploadImage(file: File, tradeId: string, imageType: string): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    const path = `${user!.id}/${tradeId}/${imageType}-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("trade-images").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("trade-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const ep = Number(data.entry_price);
      const qty = Number(data.quantity);
      const f = Number(data.fees) || 0;
      const sl = data.stop_loss ? Number(data.stop_loss) : null;
      const tp = data.take_profit ? Number(data.take_profit) : null;
      const legs = data.exit_legs ?? [];

      let xp: number | null;
      let pnl: number | null;
      let pnlPct: number | null;
      let autoStatus = data.status;

      if (legs.length > 0) {
        // Partial/multi exit — compute weighted avg exit price
        const totalExitedQty = legs.reduce((s, l) => s + Number(l.quantity), 0);
        xp = legs.reduce((s, l) => s + Number(l.exit_price) * Number(l.quantity), 0) / totalExitedQty;
        pnl = legs.reduce((s, l) => {
          const legFees = Number(l.fees) || 0;
          return s + (data.direction === "long"
            ? (Number(l.exit_price) - ep) * Number(l.quantity) - legFees
            : (ep - Number(l.exit_price)) * Number(l.quantity) - legFees);
        }, 0) - f;
        pnlPct = calculatePnlPercentage(data.direction, ep, xp);
        const leftover = qty - totalExitedQty;
        autoStatus = leftover <= 0 ? "closed" : leftover < qty ? "partial" : "open";
      } else {
        xp = data.exit_price ? Number(data.exit_price) : null;
        pnl = xp !== null && data.status === "closed" ? calculatePnl(data.direction, ep, xp, qty, f) : null;
        pnlPct = xp !== null ? calculatePnlPercentage(data.direction, ep, xp) : null;
      }

      const rr = calculateRiskReward(data.direction, ep, sl, tp);
      const posSize = calculatePositionSize(ep, qty);
      const rm = pnl !== null ? calculateRMultiple(pnl, ep, sl, qty) : data.r_multiple;

      const payload = {
        user_id: user.id,
        date: data.date,
        time: data.time || null,
        symbol: data.symbol,
        direction: data.direction,
        asset_type: data.asset_type,
        status: autoStatus,
        entry_price: ep,
        exit_price: xp,
        quantity: qty,
        fees: f,
        stop_loss: sl,
        take_profit: tp,
        pnl,
        pnl_percentage: pnlPct,
        risk_reward_ratio: rr,
        position_size: posSize,
        r_multiple: rm,
        strategy_id: data.strategy_id || null,
        notes: data.notes || null,
        setup_notes: data.setup_notes || null,
        emotions: data.emotions.length > 0 ? data.emotions : null,
        confidence_score: data.confidence_score,
        first_breakout_of_day: data.first_breakout_of_day,
        a_plus_score: data.a_plus_score || null,
        trade_quality_score: data.trade_quality_score || null,
        spy_correlation: data.spy_correlation || null,
        gex_level: data.gex_level || null,
        option_type: data.option_type || null,
        option_expiry_date: data.option_expiry_date || null,
        option_delta: data.option_delta || null,
        option_theta: data.option_theta || null,
        option_iv: data.option_iv || null,
        option_dte: data.option_dte || null,
        option_strike: data.option_strike || null,
        option_premium: data.option_premium || null,
        exit_legs: legs.length > 0 ? legs : null,
      };

      let tradeId: string;
      if (isEdit) {
        const { error } = await supabase.from("trades").update(payload).eq("id", trade.id);
        if (error) throw error;
        tradeId = trade.id;
      } else {
        const { data: newTrade, error } = await supabase.from("trades").insert(payload).select("id").single();
        if (error) throw error;
        tradeId = newTrade.id;
      }

      // Update tags
      if (isEdit) {
        await supabase.from("trade_tags").delete().eq("trade_id", tradeId);
      }
      if (data.tag_ids.length > 0) {
        await supabase.from("trade_tags").insert(data.tag_ids.map((tid) => ({ trade_id: tradeId, tag_id: tid })));
      }

      // Upload new images
      for (const img of images) {
        if (img.file && !img.existing) {
          const url = await uploadImage(img.file, tradeId, img.type);
          await supabase.from("trade_images").insert({
            trade_id: tradeId,
            user_id: user.id,
            image_type: img.type,
            storage_path: `${user.id}/${tradeId}/${img.type}`,
            public_url: url,
          });
        }
      }

      toast.success(isEdit ? "Trade updated" : "Trade added");
      router.push(`/trades/${tradeId}`);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save trade");
    } finally {
      setSaving(false);
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>, type: "entry" | "exit" | "notes") {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImages((prev) => [...prev.filter((i) => i.type !== type), { type, file, url, existing: false }]);
  }

  function removeImage(type: string) {
    setImages((prev) => prev.filter((i) => i.type !== type));
  }

  function toggleEmotion(emotion: string) {
    const current = form.getValues("emotions");
    form.setValue("emotions", current.includes(emotion)
      ? current.filter((e) => e !== emotion)
      : [...current, emotion]);
  }

  function toggleTag(tagId: string) {
    const current = form.getValues("tag_ids");
    form.setValue("tag_ids", current.includes(tagId)
      ? current.filter((t) => t !== tagId)
      : [...current, tagId]);
  }

  function addExitLeg() {
    appendExit({
      quantity: Math.max(remaining, 1),
      exit_price: 0 as unknown as number,
      date: form.getValues("date") || format(new Date(), "yyyy-MM-dd"),
      time: format(new Date(), "HH:mm"),
      fees: 0,
    });
  }

  const selectedEmotions = form.watch("emotions");
  const selectedTagIds = form.watch("tag_ids");
  const confidenceScore = form.watch("confidence_score");
  const watchedOptionType = form.watch("option_type");

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Tabs defaultValue="core">
        <TabsList className="w-full">
          <TabsTrigger value="core" className="flex-1">Core</TabsTrigger>
          <TabsTrigger value="options" className="flex-1">Options</TabsTrigger>
          <TabsTrigger value="psychology" className="flex-1">Psychology</TabsTrigger>
          <TabsTrigger value="advanced" className="flex-1">Advanced</TabsTrigger>
        </TabsList>

        {/* ── Core Tab ── */}
        <TabsContent value="core" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Trade Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" type="date" {...form.register("date")} />
                  {form.formState.errors.date && <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="time">Time (optional)</Label>
                  <Input id="time" type="time" {...form.register("time")} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="symbol">Symbol</Label>
                  <Input
                    id="symbol"
                    placeholder="AAPL"
                    {...form.register("symbol")}
                    className={cn("uppercase", form.formState.errors.symbol && "border-destructive")}
                  />
                  {form.formState.errors.symbol && <p className="text-xs text-destructive">{form.formState.errors.symbol.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Asset Type</Label>
                  <Controller
                    control={form.control}
                    name="asset_type"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="stock">Stock</SelectItem>
                          <SelectItem value="options">Options</SelectItem>
                          <SelectItem value="futures">Futures</SelectItem>
                          <SelectItem value="forex">Forex</SelectItem>
                          <SelectItem value="crypto">Crypto</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              {/* Direction toggle */}
              <div className="space-y-1.5">
                <Label>Direction</Label>
                <div className="flex gap-2">
                  {(["long", "short"] as const).map((d) => (
                    <Button
                      key={d}
                      type="button"
                      variant={form.watch("direction") === d ? (d === "long" ? "profit" : "loss") : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => form.setValue("direction", d)}
                    >
                      {d === "long" ? "↑ Long" : "↓ Short"}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="status">Status</Label>
                  <Controller
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="closed">Closed</SelectItem>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="partial">Partial</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="strategy">Strategy</Label>
                  <Controller
                    control={form.control}
                    name="strategy_id"
                    render={({ field }) => (
                      <Select value={field.value ?? "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}>
                        <SelectTrigger><SelectValue placeholder="No strategy" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No strategy</SelectItem>
                          {strategies.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Prices */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Entry</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="entry_price">Entry Price *</Label>
                  <div className="flex gap-1.5">
                    <Input id="entry_price" type="number" step="0.0001" placeholder="0.00" {...form.register("entry_price")} />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Fetch current price from Polygon"
                      onClick={() => fetchPrice("entry")}
                      disabled={fetchingPrice !== null}
                    >
                      {fetchingPrice === "entry" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </Button>
                  </div>
                  {form.formState.errors.entry_price && <p className="text-xs text-destructive">{form.formState.errors.entry_price.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quantity">Qty / Contracts *</Label>
                  <Input id="quantity" type="number" step="0.001" placeholder="100" {...form.register("quantity")} />
                  {form.formState.errors.quantity && <p className="text-xs text-destructive">{form.formState.errors.quantity.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fees">Fees / Commission</Label>
                  <Input id="fees" type="number" step="0.01" placeholder="0.00" {...form.register("fees")} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="stop_loss">Stop Loss</Label>
                  <Input id="stop_loss" type="number" step="0.0001" placeholder="Optional" {...form.register("stop_loss")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="take_profit">Take Profit</Label>
                  <Input id="take_profit" type="number" step="0.0001" placeholder="Optional" {...form.register("take_profit")} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Exit legs */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Exits</CardTitle>
                  {exitFields.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {totalExited} of {Number(quantity) || 0} exited
                      {remaining > 0 && ` · ${remaining} remaining`}
                    </p>
                  )}
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addExitLeg}>
                  <Plus className="w-4 h-4 mr-1" /> Add Exit
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {exitFields.length === 0 ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="exit_price">Exit Price</Label>
                    <div className="flex gap-1.5">
                      <Input id="exit_price" type="number" step="0.0001" placeholder="0.00" {...form.register("exit_price")} />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        title="Fetch current price from Polygon"
                        onClick={() => fetchPrice("exit")}
                        disabled={fetchingPrice !== null}
                      >
                        {fetchingPrice === "exit" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Use "Add Exit" above to record partial exits separately</p>
                  </div>

                  {/* Single-exit live calc */}
                  {calc && (
                    <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Live Preview</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">P&L</p>
                          <p className={cn("font-bold", calc.pnl !== null && (calc.pnl >= 0 ? "text-profit" : "text-loss"))}>
                            {calc.pnl !== null ? formatCurrency(calc.pnl) : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">P&L %</p>
                          <p className={cn("font-semibold", calc.pnlPct !== null && (calc.pnlPct >= 0 ? "text-profit" : "text-loss"))}>
                            {calc.pnlPct !== null ? formatPercent(calc.pnlPct) : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">R/R</p>
                          <p className="font-semibold">{calc.rr ? `${calc.rr.toFixed(2)}:1` : "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Position</p>
                          <p className="font-semibold">{formatCurrency(calc.posSize)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {exitFields.map((field, i) => (
                    <div key={field.id} className="rounded-lg border p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">Exit {i + 1}</span>
                        <div className="flex items-center gap-2">
                          {legPnls[i] !== null && (
                            <span className={cn("text-xs font-semibold", (legPnls[i] ?? 0) >= 0 ? "text-profit" : "text-loss")}>
                              {formatCurrency(legPnls[i] ?? 0)}
                            </span>
                          )}
                          <Button type="button" size="icon-sm" variant="ghost" onClick={() => removeExit(i)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Qty</Label>
                          <Input type="number" step="1" placeholder="2" className="h-8" {...form.register(`exit_legs.${i}.quantity`)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Exit Price</Label>
                          <Input type="number" step="0.0001" placeholder="0.00" className="h-8" {...form.register(`exit_legs.${i}.exit_price`)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Date</Label>
                          <Input type="date" className="h-8" {...form.register(`exit_legs.${i}.date`)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Fees</Label>
                          <Input type="number" step="0.01" placeholder="0.00" className="h-8" {...form.register(`exit_legs.${i}.fees`)} />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Multi-exit summary */}
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total P&L (all exits)</span>
                      <span className={cn("font-bold", totalLegPnl >= 0 ? "text-profit" : "text-loss")}>
                        {formatCurrency(totalLegPnl)}
                      </span>
                    </div>
                    {remaining > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">{remaining} contracts still open</p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tags</CardTitle>
            </CardHeader>
            <CardContent>
              {tags.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tags yet. Create tags in Settings.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant={selectedTagIds.includes(tag.id) ? "default" : "outline"}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => toggleTag(tag.id)}
                      style={selectedTagIds.includes(tag.id) ? { backgroundColor: tag.color, color: "white", borderColor: tag.color } : {}}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="setup_notes">Setup Notes</Label>
                <Textarea id="setup_notes" placeholder="Describe the trade setup..." {...form.register("setup_notes")} rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Post-Trade Notes</Label>
                <Textarea id="notes" placeholder="What happened? What did you learn?" {...form.register("notes")} rows={3} />
              </div>
            </CardContent>
          </Card>

          {/* Screenshot uploads */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Screenshots</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(["entry", "exit", "notes"] as const).map((type) => {
                  const img = images.find((i) => i.type === type);
                  return (
                    <div key={type} className="space-y-1.5">
                      <Label className="capitalize">{type} Chart</Label>
                      {img ? (
                        <div className="relative rounded-lg overflow-hidden border aspect-video bg-muted">
                          <Image src={img.url} alt={`${type} chart`} fill className="object-cover" unoptimized />
                          <button
                            type="button"
                            onClick={() => removeImage(type)}
                            className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg aspect-video cursor-pointer hover:bg-muted/50 transition-colors">
                          <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                          <span className="text-xs text-muted-foreground">Upload {type}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => handleImageSelect(e, type)}
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Options Tab ── */}
        <TabsContent value="options" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Options Contract Details</CardTitle>
                  {form.watch("symbol") && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Underlying: <span className="font-semibold text-foreground">{form.watch("symbol")}</span>
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* CALL / PUT */}
              <div className="space-y-1.5">
                <Label>Contract Type</Label>
                <div className="flex gap-2">
                  {(["call", "put"] as const).map((t) => (
                    <Button
                      key={t}
                      type="button"
                      variant={watchedOptionType === t ? (t === "call" ? "profit" : "loss") : "outline"}
                      size="sm"
                      className="flex-1 uppercase font-bold tracking-wide"
                      onClick={() => form.setValue("option_type", watchedOptionType === t ? null : t)}
                    >
                      {t === "call" ? "📈 CALL" : "📉 PUT"}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="option_strike">Strike Price</Label>
                  <Input id="option_strike" type="number" step="0.5" placeholder="150.00" {...form.register("option_strike")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="option_expiry_date">Expiry Date</Label>
                  <Input id="option_expiry_date" type="date" {...form.register("option_expiry_date")} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="option_dte">
                    DTE
                    <span className="text-xs text-muted-foreground ml-1">(auto-calculated)</span>
                  </Label>
                  <Input
                    id="option_dte"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="—"
                    readOnly
                    className="bg-muted/50 text-muted-foreground"
                    {...form.register("option_dte")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="option_premium">Premium (per contract)</Label>
                  <Input id="option_premium" type="number" step="0.01" placeholder="2.50" {...form.register("option_premium")} />
                </div>
              </div>

              <Separator />

              {/* Greeks — auto-fetched from Polygon */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Greeks at Entry</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={fetchGreeks}
                  disabled={fetchingGreeks}
                  title="Requires symbol, strike, expiry, and CALL/PUT to be set"
                >
                  {fetchingGreeks
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                  Fetch from Polygon
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="option_delta">Delta</Label>
                  <Input id="option_delta" type="number" step="0.001" min="-1" max="1" placeholder="auto" {...form.register("option_delta")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="option_theta">Theta (daily)</Label>
                  <Input id="option_theta" type="number" step="0.001" placeholder="auto" {...form.register("option_theta")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="option_iv">IV %</Label>
                  <Input id="option_iv" type="number" step="0.1" min="0" placeholder="auto" {...form.register("option_iv")} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Fill in Strike, Expiry, and CALL/PUT above, then click "Fetch from Polygon" to auto-populate.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Psychology Tab ── */}
        <TabsContent value="psychology" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Confidence Score</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Low confidence</span>
                  <span className="font-semibold text-lg">{confidenceScore}/10</span>
                  <span className="text-muted-foreground">High confidence</span>
                </div>
                <Controller
                  control={form.control}
                  name="confidence_score"
                  render={({ field }) => (
                    <Slider
                      min={1}
                      max={10}
                      step={1}
                      value={[field.value]}
                      onValueChange={([v]) => field.onChange(v)}
                    />
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Emotions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {EMOTION_OPTIONS.map((emotion) => (
                  <Badge
                    key={emotion}
                    variant={selectedEmotions.includes(emotion) ? "default" : "outline"}
                    className="cursor-pointer hover:opacity-80 transition-opacity capitalize"
                    onClick={() => toggleEmotion(emotion)}
                  >
                    {emotion}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Advanced Tab ── */}
        <TabsContent value="advanced" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Trading Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>First Breakout of Day</Label>
                  <p className="text-xs text-muted-foreground">Was this the first breakout setup of the session?</p>
                </div>
                <Controller
                  control={form.control}
                  name="first_breakout_of_day"
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="a_plus_score">A+ Setup Score (1-10)</Label>
                  <Input id="a_plus_score" type="number" min="1" max="10" step="1" placeholder="8" {...form.register("a_plus_score")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="trade_quality_score">Trade Quality Score (0-100)</Label>
                  <Input id="trade_quality_score" type="number" min="0" max="100" step="1" placeholder="75" {...form.register("trade_quality_score")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r_multiple">R-Multiple (manual override)</Label>
                  <Input id="r_multiple" type="number" step="0.01" placeholder="2.5" {...form.register("r_multiple")} />
                  <p className="text-xs text-muted-foreground">Auto-calculated when stop loss set</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="spy_correlation">SPY Correlation (-1 to 1)</Label>
                  <Input id="spy_correlation" type="number" min="-1" max="1" step="0.01" placeholder="0.75" {...form.register("spy_correlation")} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gex_level">GEX Level Tag</Label>
                <Input id="gex_level" placeholder="e.g. positive, negative, flip zone" {...form.register("gex_level")} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Submit */}
      <div className="flex gap-3 sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t -mx-4 px-4 md:mx-0 md:px-0 md:static md:border-0 md:bg-transparent md:py-0">
        <Button type="button" variant="outline" onClick={() => router.back()} className="flex-1 md:flex-none">
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="flex-1">
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
          {isEdit ? "Update Trade" : "Save Trade"}
        </Button>
      </div>
    </form>
  );
}
