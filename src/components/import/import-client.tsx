"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle, AlertTriangle, Loader2, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parseCsvFile } from "@/lib/csv-parsers";
import { calculatePnl, calculatePositionSize, calculatePnlPercentage } from "@/lib/trade-calculations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, getPnlColor, cn } from "@/lib/utils";
import type { Strategy, Tag, ImportedTrade, BrokerFormat } from "@/types";

const BROKER_OPTIONS: { value: BrokerFormat; label: string }[] = [
  { value: "webull", label: "Webull" },
  { value: "interactive_brokers", label: "Interactive Brokers" },
  { value: "robinhood", label: "Robinhood" },
  { value: "thinkorswim", label: "ThinkOrSwim (TOS)" },
  { value: "tradestation", label: "TradeStation" },
  { value: "tastytrade", label: "Tastytrade" },
  { value: "moomoo", label: "Moomoo" },
  { value: "public", label: "Public" },
  { value: "generic", label: "Generic CSV" },
];

interface ImportClientProps {
  strategies: Strategy[];
  tags: Tag[];
}

export function ImportClient({ strategies }: ImportClientProps) {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [broker, setBroker] = useState<BrokerFormat>("generic");
  const [trades, setTrades] = useState<ImportedTrade[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [detectedFormat, setDetectedFormat] = useState<BrokerFormat>("generic");
  const [fileName, setFileName] = useState("");
  const [selectedStrategy, setSelectedStrategy] = useState<string>("");
  const [importCount, setImportCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback((file: File, selectedBroker: BrokerFormat) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const { trades: parsed, errors: errs, detectedFormat: fmt } = parseCsvFile(content, selectedBroker);
      setTrades(parsed);
      setErrors(errs);
      setDetectedFormat(fmt);
      if (parsed.length > 0) {
        setStep("preview");
      } else {
        toast.error("No trades found in file");
      }
    };
    reader.readAsText(file);
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file, broker);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) {
      processFile(file, broker);
    } else {
      toast.error("Please drop a CSV file");
    }
  }

  async function importTrades() {
    setStep("importing");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const records = trades.map((t) => {
        const pnl = t.exit_price && t.exit_price > 0
          ? t.pnl ?? calculatePnl(t.direction, t.entry_price, t.exit_price, t.quantity, t.fees)
          : null;
        const pnlPct = t.exit_price ? calculatePnlPercentage(t.direction, t.entry_price, t.exit_price) : null;
        const posSize = calculatePositionSize(t.entry_price, t.quantity);

        return {
          user_id: user.id,
          date: t.date,
          time: t.time ?? null,
          symbol: t.symbol,
          direction: t.direction,
          asset_type: t.asset_type,
          status: t.exit_price ? "closed" : "open",
          entry_price: t.entry_price,
          exit_price: t.exit_price ?? null,
          quantity: t.quantity,
          fees: t.fees,
          pnl,
          pnl_percentage: pnlPct,
          position_size: posSize,
          strategy_id: selectedStrategy || null,
        };
      });

      // Batch insert in chunks of 50
      let count = 0;
      for (let i = 0; i < records.length; i += 50) {
        const chunk = records.slice(i, i + 50);
        const { error } = await supabase.from("trades").insert(chunk);
        if (error) throw error;
        count += chunk.length;
      }

      setImportCount(count);
      setStep("done");
      toast.success(`${count} trades imported successfully`);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Import failed");
      setStep("preview");
    }
  }

  return (
    <div className="space-y-4">
      {/* Supported formats info */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium mb-2">Supported Brokers</p>
          <div className="flex flex-wrap gap-2">
            {BROKER_OPTIONS.map((b) => (
              <Badge key={b.value} variant="secondary">{b.label}</Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Use Generic CSV format if your broker is not listed. Required columns: date, symbol, direction/side, entry_price, quantity.
          </p>
        </CardContent>
      </Card>

      {/* Step 1: Upload */}
      {(step === "upload" || step === "preview") && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">1. Select Broker & Upload File</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Broker Format</Label>
              <Select value={broker} onValueChange={(v) => setBroker(v as BrokerFormat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BROKER_OPTIONS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <label className="cursor-pointer">
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="font-medium text-sm">
                  {fileName || "Drop CSV file here or click to browse"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Supports .csv files</p>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={handleFileChange}
                />
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview */}
      {step === "preview" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">2. Preview ({trades.length} trades detected)</CardTitle>
              {detectedFormat !== "generic" && (
                <Badge variant="secondary">Auto-detected: {BROKER_OPTIONS.find((b) => b.value === detectedFormat)?.label}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {errors.length > 0 && (
              <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3">
                <div className="flex items-center gap-2 text-yellow-500 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">{errors.length} parse warning{errors.length > 1 ? "s" : ""}</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {errors.slice(0, 5).map((err, i) => <li key={i}>• {err}</li>)}
                  {errors.length > 5 && <li>...and {errors.length - 5} more</li>}
                </ul>
              </div>
            )}

            {strategies.length > 0 && (
              <div className="space-y-1.5">
                <Label>Assign Strategy (optional)</Label>
                <Select value={selectedStrategy} onValueChange={setSelectedStrategy}>
                  <SelectTrigger>
                    <SelectValue placeholder="No strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No strategy</SelectItem>
                    {strategies.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Entry</TableHead>
                    <TableHead>Exit</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades.slice(0, 20).map((t, i) => {
                    const pnl = t.exit_price ? calculatePnl(t.direction, t.entry_price, t.exit_price, t.quantity, t.fees) : null;
                    return (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{t.date}</TableCell>
                        <TableCell className="font-semibold">{t.symbol}</TableCell>
                        <TableCell>
                          <Badge variant={t.direction === "long" ? "long" : "short"} className="text-xs">
                            {t.direction}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{formatCurrency(t.entry_price)}</TableCell>
                        <TableCell className="text-xs">
                          {t.exit_price ? formatCurrency(t.exit_price) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs">{t.quantity}</TableCell>
                        <TableCell>
                          {pnl !== null ? (
                            <span className={cn("text-xs font-semibold", getPnlColor(pnl))}>{formatCurrency(pnl)}</span>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {trades.length > 20 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-2">
                        +{trades.length - 20} more trades...
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button onClick={importTrades} className="flex-1">
                Import {trades.length} Trades
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Importing... */}
      {step === "importing" && (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <p className="font-semibold">Importing trades...</p>
            <p className="text-sm text-muted-foreground">This may take a moment</p>
          </CardContent>
        </Card>
      )}

      {/* Done */}
      {step === "done" && (
        <Card className="border-profit/30 bg-profit/5">
          <CardContent className="p-8 text-center space-y-3">
            <CheckCircle className="w-10 h-10 text-profit mx-auto" />
            <p className="font-semibold text-lg">Import complete!</p>
            <p className="text-sm text-muted-foreground">{importCount} trades imported successfully</p>
            <div className="flex gap-3 justify-center pt-2">
              <Button onClick={() => router.push("/trades")}>View Trades</Button>
              <Button variant="outline" onClick={() => { setStep("upload"); setTrades([]); setErrors([]); setFileName(""); }}>
                Import More
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
