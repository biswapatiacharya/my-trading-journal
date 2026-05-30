"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload, X, Plus, ChevronDown, ChevronUp } from "lucide-react";
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
import type { Trade, Strategy, Tag, TradeFormData } from "@/types";
import { format } from "date-fns";

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
  option_delta: z.coerce.number().optional().nullable(),
  option_theta: z.coerce.number().optional().nullable(),
  option_iv: z.coerce.number().min(0).optional().nullable(),
  option_dte: z.coerce.number().int().min(0).optional().nullable(),
  option_strike: z.coerce.number().positive().optional().nullable(),
  option_premium: z.coerce.number().positive().optional().nullable(),
  tag_ids: z.array(z.string()).default([]),
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
  const [images, setImages] = useState<{ type: "entry" | "exit" | "notes"; file?: File; url: string; existing?: boolean; id?: string }[]>(
    trade?.images?.map((img) => ({ type: img.image_type, url: img.public_url, existing: true, id: img.id })) ?? []
  );
  const [showOptions, setShowOptions] = useState(trade?.asset_type === "options");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(tradeSchema),
    defaultValues: {
      date: trade?.date ?? format(new Date(), "yyyy-MM-dd"),
      time: trade?.time ?? format(new Date(), "HH:mm"),
      symbol: trade?.symbol ?? "",
      direction: trade?.direction ?? "long",
      asset_type: trade?.asset_type ?? "stock",
      status: trade?.status ?? "closed",
      entry_price: trade?.entry_price ?? (undefined as unknown as number),
      exit_price: trade?.exit_price ?? null,
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
      option_delta: trade?.option_delta ?? null,
      option_theta: trade?.option_theta ?? null,
      option_iv: trade?.option_iv ?? null,
      option_dte: trade?.option_dte ?? null,
      option_strike: trade?.option_strike ?? null,
      option_premium: trade?.option_premium ?? null,
      tag_ids: trade?.tags?.map((t) => t.id) ?? [],
    },
  });

  const watchedValues = form.watch(["direction", "entry_price", "exit_price", "quantity", "fees", "stop_loss", "take_profit", "asset_type"]);
  const [direction, entryPrice, exitPrice, quantity, fees, stopLoss, takeProfit, assetType] = watchedValues;

  // Live P&L preview
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

  const calc = liveCalc();

  // Show options section when asset type changes
  useEffect(() => {
    setShowOptions(assetType === "options");
  }, [assetType]);

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
      const xp = data.exit_price ? Number(data.exit_price) : null;
      const qty = Number(data.quantity);
      const f = Number(data.fees) || 0;
      const sl = data.stop_loss ? Number(data.stop_loss) : null;
      const tp = data.take_profit ? Number(data.take_profit) : null;

      const pnl = xp !== null && data.status === "closed" ? calculatePnl(data.direction, ep, xp, qty, f) : null;
      const pnlPct = xp !== null ? calculatePnlPercentage(data.direction, ep, xp) : null;
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
        status: data.status,
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
        option_delta: data.option_delta || null,
        option_theta: data.option_theta || null,
        option_iv: data.option_iv || null,
        option_dte: data.option_dte || null,
        option_strike: data.option_strike || null,
        option_premium: data.option_premium || null,
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
    setImages((prev) => {
      const filtered = prev.filter((i) => i.type !== type);
      return [...filtered, { type, file, url, existing: false }];
    });
  }

  function removeImage(type: string) {
    setImages((prev) => prev.filter((i) => i.type !== type));
  }

  function toggleEmotion(emotion: string) {
    const current = form.getValues("emotions");
    if (current.includes(emotion)) {
      form.setValue("emotions", current.filter((e) => e !== emotion));
    } else {
      form.setValue("emotions", [...current, emotion]);
    }
  }

  function toggleTag(tagId: string) {
    const current = form.getValues("tag_ids");
    if (current.includes(tagId)) {
      form.setValue("tag_ids", current.filter((t) => t !== tagId));
    } else {
      form.setValue("tag_ids", [...current, tagId]);
    }
  }

  const selectedEmotions = form.watch("emotions");
  const selectedTagIds = form.watch("tag_ids");
  const confidenceScore = form.watch("confidence_score");

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
                      <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                        <SelectTrigger><SelectValue placeholder="No strategy" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">No strategy</SelectItem>
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
              <CardTitle className="text-base">Prices & Size</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="entry_price">Entry Price *</Label>
                  <Input id="entry_price" type="number" step="0.0001" placeholder="0.00" {...form.register("entry_price")} />
                  {form.formState.errors.entry_price && <p className="text-xs text-destructive">{form.formState.errors.entry_price.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="exit_price">Exit Price</Label>
                  <Input id="exit_price" type="number" step="0.0001" placeholder="0.00" {...form.register("exit_price")} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="quantity">Quantity / Shares *</Label>
                  <Input id="quantity" type="number" step="0.001" placeholder="100" {...form.register("quantity")} />
                  {form.formState.errors.quantity && <p className="text-xs text-destructive">{form.formState.errors.quantity.message}</p>}
                </div>
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

              {/* Live P&L preview */}
              {calc && (
                <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Live Calculations</p>
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
                      <p className="text-xs text-muted-foreground">R/R Ratio</p>
                      <p className="font-semibold">{calc.rr ? `${calc.rr.toFixed(2)}:1` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Position Size</p>
                      <p className="font-semibold">{formatCurrency(calc.posSize)}</p>
                    </div>
                  </div>
                </div>
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
              <CardTitle className="text-base">Options Greeks & Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="option_strike">Strike Price</Label>
                  <Input id="option_strike" type="number" step="0.5" placeholder="150.00" {...form.register("option_strike")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="option_dte">DTE (Days to Expiry)</Label>
                  <Input id="option_dte" type="number" min="0" step="1" placeholder="30" {...form.register("option_dte")} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="option_premium">Premium Paid (per contract)</Label>
                <Input id="option_premium" type="number" step="0.01" placeholder="2.50" {...form.register("option_premium")} />
              </div>

              <Separator />
              <p className="text-sm font-medium">Greeks at Entry</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="option_delta">Delta</Label>
                  <Input id="option_delta" type="number" step="0.001" min="-1" max="1" placeholder="0.45" {...form.register("option_delta")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="option_theta">Theta (daily)</Label>
                  <Input id="option_theta" type="number" step="0.001" placeholder="-0.05" {...form.register("option_theta")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="option_iv">IV %</Label>
                  <Input id="option_iv" type="number" step="0.1" min="0" placeholder="35.5" {...form.register("option_iv")} />
                </div>
              </div>
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
