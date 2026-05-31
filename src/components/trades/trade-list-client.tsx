"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus, Search, Filter, TrendingUp, TrendingDown, Trash2,
  ChevronDown, ChevronUp, MoreHorizontal, ArrowUpDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatPercent, formatDate, getPnlColor, cn } from "@/lib/utils";
import type { Trade, Strategy, Tag } from "@/types";

interface TradeListClientProps {
  trades: Trade[];
  strategies: Strategy[];
  tags: Tag[];
}

type SortField = "date" | "symbol" | "pnl" | "pnl_percentage" | "quantity";
type SortDir = "asc" | "desc";

export function TradeListClient({ trades: initialTrades, strategies, tags }: TradeListClientProps) {
  const router = useRouter();
  const supabase = createClient();

  const [trades, setTrades] = useState(initialTrades);
  const [search, setSearch] = useState("");
  const [filterDirection, setFilterDirection] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterAssetType, setFilterAssetType] = useState<string>("all");
  const [filterStrategy, setFilterStrategy] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [filterResult, setFilterResult] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    return trades
      .filter((t) => {
        const q = search.toLowerCase();
        if (q && !t.symbol.toLowerCase().includes(q) && !(t.notes ?? "").toLowerCase().includes(q)) return false;
        if (filterDirection !== "all" && t.direction !== filterDirection) return false;
        if (filterStatus !== "all" && t.status !== filterStatus) return false;
        if (filterAssetType !== "all" && t.asset_type !== filterAssetType) return false;
        if (filterStrategy !== "all" && t.strategy_id !== filterStrategy) return false;
        if (filterTag !== "all" && !t.tags?.some((tag) => tag.id === filterTag)) return false;
        if (filterResult === "win" && (t.pnl ?? 0) <= 0) return false;
        if (filterResult === "loss" && (t.pnl ?? 0) >= 0) return false;
        if (dateFrom && t.date < dateFrom) return false;
        if (dateTo && t.date > dateTo) return false;
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === "date") cmp = a.date.localeCompare(b.date);
        else if (sortField === "symbol") cmp = a.symbol.localeCompare(b.symbol);
        else if (sortField === "pnl") cmp = (a.pnl ?? -Infinity) - (b.pnl ?? -Infinity);
        else if (sortField === "pnl_percentage") cmp = (a.pnl_percentage ?? -Infinity) - (b.pnl_percentage ?? -Infinity);
        else if (sortField === "quantity") cmp = a.quantity - b.quantity;
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [trades, search, filterDirection, filterStatus, filterAssetType, filterStrategy, filterTag, filterResult, dateFrom, dateTo, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  async function deleteTrade() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("trades").delete().eq("id", deleteId);
      if (error) throw error;
      setTrades((prev) => prev.filter((t) => t.id !== deleteId));
      toast.success("Trade deleted");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete trade");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  const totalPnl = filtered.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const closedFiltered = filtered.filter((t) => t.status === "closed");
  const winRate = closedFiltered.length > 0
    ? (closedFiltered.filter((t) => (t.pnl ?? 0) > 0).length / closedFiltered.length) * 100
    : 0;

  function SortButton({ field, label }: { field: SortField; label: string }) {
    return (
      <button
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => toggleSort(field)}
      >
        {label}
        {sortField === field
          ? sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
          : <ArrowUpDown className="w-3 h-3 opacity-40" />}
      </button>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trades</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {trades.length} trades
            {filtered.length > 0 && ` · Total P&L: `}
            {filtered.length > 0 && (
              <span className={getPnlColor(totalPnl)}>{formatCurrency(totalPnl)}</span>
            )}
            {closedFiltered.length > 0 && ` · Win rate: ${winRate.toFixed(0)}%`}
          </p>
        </div>
        <Button asChild>
          <Link href="/trades/new">
            <Plus className="w-4 h-4" />
            New Trade
          </Link>
        </Button>
      </div>

      {/* Search and filters */}
      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search symbol, notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(showFilters && "bg-primary/10 border-primary/40")}
            >
              <Filter className="w-4 h-4" />
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              <Select value={filterDirection} onValueChange={setFilterDirection}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Direction" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All directions</SelectItem>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterAssetType} onValueChange={setFilterAssetType}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Asset" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All assets</SelectItem>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="options">Options</SelectItem>
                  <SelectItem value="futures">Futures</SelectItem>
                  <SelectItem value="forex">Forex</SelectItem>
                  <SelectItem value="crypto">Crypto</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterResult} onValueChange={setFilterResult}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Result" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All results</SelectItem>
                  <SelectItem value="win">Winners</SelectItem>
                  <SelectItem value="loss">Losers</SelectItem>
                </SelectContent>
              </Select>
              {strategies.length > 0 && (
                <Select value={filterStrategy} onValueChange={setFilterStrategy}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Strategy" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All strategies</SelectItem>
                    {strategies.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {tags.length > 0 && (
                <Select value={filterTag} onValueChange={setFilterTag}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tag" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tags</SelectItem>
                    {tags.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 text-xs"
                placeholder="From date"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 text-xs"
                placeholder="To date"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trade table (desktop) */}
      <div className="hidden md:block">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortButton field="date" label="Date" /></TableHead>
                <TableHead><SortButton field="symbol" label="Symbol" /></TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead><SortButton field="quantity" label="Qty" /></TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>Exit</TableHead>
                <TableHead><SortButton field="pnl" label="P&L" /></TableHead>
                <TableHead><SortButton field="pnl_percentage" label="%" /></TableHead>
                <TableHead>R</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                    {trades.length === 0 ? "No trades yet. Add your first trade!" : "No trades match your filters."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((trade) => (
                  <TableRow
                    key={trade.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/trades/${trade.id}`)}
                  >
                    <TableCell className="text-sm">{formatDate(trade.date)}</TableCell>
                    <TableCell className="font-semibold">{trade.symbol}</TableCell>
                    <TableCell>
                      <Badge variant={trade.direction === "long" ? "long" : "short"} className="gap-1">
                        {trade.direction === "long" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {trade.direction}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <span className="capitalize">{trade.asset_type}</span>
                      {trade.asset_type === "options" && trade.option_type && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "ml-1 text-[10px] px-1 py-0 font-bold",
                            trade.option_type === "call" ? "border-profit/50 text-profit" : "border-loss/50 text-loss"
                          )}
                        >
                          {trade.option_type.toUpperCase()}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{trade.quantity}</TableCell>
                    <TableCell>{formatCurrency(trade.entry_price)}</TableCell>
                    <TableCell>{trade.exit_price ? formatCurrency(trade.exit_price) : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      {trade.pnl !== null ? (
                        <span className={cn("font-semibold", getPnlColor(trade.pnl))}>
                          {formatCurrency(trade.pnl)}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {trade.pnl_percentage !== null ? (
                        <span className={cn("text-sm", getPnlColor(trade.pnl_percentage))}>
                          {formatPercent(trade.pnl_percentage)}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {trade.r_multiple !== null ? (
                        <span className={cn("text-sm font-medium", getPnlColor(trade.r_multiple))}>
                          {trade.r_multiple.toFixed(1)}R
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap max-w-[120px]">
                        {trade.tags?.slice(0, 2).map((tag) => (
                          <Badge key={tag.id} variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: tag.color, color: tag.color }}>
                            {tag.name}
                          </Badge>
                        ))}
                        {(trade.tags?.length ?? 0) > 2 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{(trade.tags?.length ?? 0) - 2}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/trades/${trade.id}?edit=1`}>Edit</Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(trade.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {trades.length === 0 ? "No trades yet." : "No trades match your filters."}
          </div>
        ) : (
          filtered.map((trade) => (
            <Card
              key={trade.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`/trades/${trade.id}`)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{trade.symbol}</span>
                      <Badge variant={trade.direction === "long" ? "long" : "short"} className="text-xs px-1.5 py-0">
                        {trade.direction}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(trade.date)}</p>
                    {trade.tags && trade.tags.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {trade.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag.id} variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: tag.color, color: tag.color }}>
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {trade.pnl !== null && (
                      <p className={cn("font-bold text-base", getPnlColor(trade.pnl))}>
                        {formatCurrency(trade.pnl)}
                      </p>
                    )}
                    {trade.pnl_percentage !== null && (
                      <p className={cn("text-xs", getPnlColor(trade.pnl_percentage))}>
                        {formatPercent(trade.pnl_percentage)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete trade?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The trade and all associated screenshots will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteTrade} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
