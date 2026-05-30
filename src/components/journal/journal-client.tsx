"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Plus, Edit2, Star, CalendarDays, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn, formatCurrency, getPnlColor } from "@/lib/utils";
import type { JournalEntry, Trade } from "@/types";

const entrySchema = z.object({
  date: z.string().min(1),
  market_conditions: z.string().optional(),
  pre_market_notes: z.string().optional(),
  post_market_notes: z.string().optional(),
  lessons_learned: z.string().optional(),
  psychological_state: z.string().optional(),
  overall_rating: z.number().min(1).max(5).optional(),
});

type EntryFormData = z.infer<typeof entrySchema>;

interface JournalClientProps {
  entries: JournalEntry[];
  trades: Trade[];
}

export function JournalClient({ entries: initialEntries, trades }: JournalClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [entries, setEntries] = useState(initialEntries);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [rating, setRating] = useState(0);

  const form = useForm<EntryFormData>({
    resolver: zodResolver(entrySchema),
    defaultValues: { date: format(new Date(), "yyyy-MM-dd") },
  });

  // Group trades by date for sidebar
  const tradesByDate = trades.reduce<Record<string, Trade[]>>((acc, t) => {
    acc[t.date] = acc[t.date] ?? [];
    acc[t.date].push(t);
    return acc;
  }, {});

  function openNew() {
    setEditing(null);
    setRating(0);
    form.reset({ date: format(new Date(), "yyyy-MM-dd") });
    setIsOpen(true);
  }

  function openEdit(entry: JournalEntry) {
    setEditing(entry);
    setRating(entry.overall_rating ?? 0);
    form.reset({
      date: entry.date,
      market_conditions: entry.market_conditions ?? "",
      pre_market_notes: entry.pre_market_notes ?? "",
      post_market_notes: entry.post_market_notes ?? "",
      lessons_learned: entry.lessons_learned ?? "",
      psychological_state: entry.psychological_state ?? "",
      overall_rating: entry.overall_rating ?? undefined,
    });
    setIsOpen(true);
  }

  async function onSubmit(data: EntryFormData) {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const payload = {
        user_id: user.id,
        date: data.date,
        market_conditions: data.market_conditions || null,
        pre_market_notes: data.pre_market_notes || null,
        post_market_notes: data.post_market_notes || null,
        lessons_learned: data.lessons_learned || null,
        psychological_state: data.psychological_state || null,
        overall_rating: rating || null,
      };

      if (editing) {
        const { data: updated, error } = await supabase
          .from("journal_entries")
          .update(payload)
          .eq("id", editing.id)
          .select()
          .single();
        if (error) throw error;
        setEntries((prev) => prev.map((e) => (e.id === editing.id ? (updated as JournalEntry) : e)));
      } else {
        const { data: newEntry, error } = await supabase
          .from("journal_entries")
          .upsert(payload, { onConflict: "user_id,date" })
          .select()
          .single();
        if (error) throw error;
        setEntries((prev) => [newEntry as JournalEntry, ...prev.filter((e) => e.date !== data.date)]);
      }

      toast.success(editing ? "Entry updated" : "Entry saved");
      setIsOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save entry");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus className="w-4 h-4" />
          New Entry
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16 border rounded-xl bg-muted/20 space-y-3">
          <CalendarDays className="w-10 h-10 text-muted-foreground mx-auto" />
          <div>
            <p className="font-semibold">No journal entries yet</p>
            <p className="text-sm text-muted-foreground">Document your daily trading observations</p>
          </div>
          <Button onClick={openNew}>Write first entry</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => {
            const dayTrades = tradesByDate[entry.date] ?? [];
            const dayPnl = dayTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);

            return (
              <Card key={entry.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">
                        {format(parseISO(entry.date), "EEEE, MMMM d, yyyy")}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {dayTrades.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {dayTrades.length} trade{dayTrades.length !== 1 ? "s" : ""}
                          </Badge>
                        )}
                        {dayPnl !== 0 && (
                          <Badge variant="outline" className={cn("text-xs", getPnlColor(dayPnl))}>
                            {formatCurrency(dayPnl)}
                          </Badge>
                        )}
                        {entry.overall_rating && (
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={cn("w-3.5 h-3.5", i < entry.overall_rating! ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground")}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(entry)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {entry.market_conditions && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Market Conditions</p>
                      <p className="text-sm">{entry.market_conditions}</p>
                    </div>
                  )}
                  {entry.pre_market_notes && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Pre-Market</p>
                      <p className="text-sm whitespace-pre-wrap">{entry.pre_market_notes}</p>
                    </div>
                  )}
                  {entry.post_market_notes && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Post-Market</p>
                      <p className="text-sm whitespace-pre-wrap">{entry.post_market_notes}</p>
                    </div>
                  )}
                  {entry.lessons_learned && (
                    <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
                      <p className="text-xs font-medium text-primary mb-1">📝 Lessons Learned</p>
                      <p className="text-sm whitespace-pre-wrap">{entry.lessons_learned}</p>
                    </div>
                  )}
                  {entry.psychological_state && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Psychological State</p>
                      <p className="text-sm">{entry.psychological_state}</p>
                    </div>
                  )}

                  {/* Day's trades mini list */}
                  {dayTrades.length > 0 && (
                    <div>
                      <Separator className="my-2" />
                      <p className="text-xs font-medium text-muted-foreground mb-2">Trades This Day</p>
                      <div className="space-y-1">
                        {dayTrades.slice(0, 3).map((t) => (
                          <div key={t.id} className="flex justify-between text-xs">
                            <span className="font-medium">{t.symbol}
                              <span className={cn("ml-1 text-[10px]", t.direction === "long" ? "text-blue-500" : "text-orange-500")}>
                                {t.direction}
                              </span>
                            </span>
                            <span className={cn("font-semibold", getPnlColor(t.pnl))}>{t.pnl !== null ? formatCurrency(t.pnl) : "—"}</span>
                          </div>
                        ))}
                        {dayTrades.length > 3 && (
                          <p className="text-xs text-muted-foreground">+{dayTrades.length - 3} more trades</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Entry form dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Journal Entry" : "New Journal Entry"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="j-date">Date</Label>
              <Input id="j-date" type="date" {...form.register("date")} />
            </div>

            <div className="space-y-1.5">
              <Label>Day Rating</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRating(r)}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star className={cn("w-6 h-6", r <= rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground")} />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="market_conditions">Market Conditions</Label>
              <Input id="market_conditions" placeholder="Bullish, high volatility, FOMC day..." {...form.register("market_conditions")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pre_market_notes">Pre-Market Notes</Label>
              <Textarea id="pre_market_notes" placeholder="Game plan for today, watchlist, key levels..." {...form.register("pre_market_notes")} rows={3} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="post_market_notes">Post-Market Notes</Label>
              <Textarea id="post_market_notes" placeholder="What happened? How did the market behave?" {...form.register("post_market_notes")} rows={3} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lessons_learned">Lessons Learned</Label>
              <Textarea id="lessons_learned" placeholder="Key takeaways from today's session..." {...form.register("lessons_learned")} rows={3} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="psychological_state">Psychological State</Label>
              <Input id="psychological_state" placeholder="Calm, focused, stressed, overconfident..." {...form.register("psychological_state")} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Save Entry
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
