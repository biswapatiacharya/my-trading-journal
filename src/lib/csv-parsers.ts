import Papa from "papaparse";
import type { BrokerFormat, ImportedTrade, CsvColumnMapping } from "@/types";

type RawRow = Record<string, string>;

// ── Broker column mappings ────────────────────────────────────

const BROKER_MAPPINGS: Record<BrokerFormat, CsvColumnMapping & { directionMap?: Record<string, "long" | "short"> }> = {
  webull: {
    date: "Date/Time",
    symbol: "Symbol",
    direction: "Side",
    entry_price: "Filled Price",
    quantity: "Filled Qty",
    fees: "Commission",
    directionMap: { "BUY": "long", "SELL": "short" },
  },
  interactive_brokers: {
    date: "Date/Time",
    symbol: "Symbol",
    direction: "Buy/Sell",
    entry_price: "T. Price",
    quantity: "Quantity",
    fees: "Comm/Fee",
    directionMap: { "BUY": "long", "SELL": "short" },
  },
  robinhood: {
    date: "Date",
    time: "Time",
    symbol: "Instrument",
    direction: "Side",
    entry_price: "Average Price",
    quantity: "Quantity",
    fees: "Fees",
    directionMap: { "Buy": "long", "Sell": "short" },
  },
  thinkorswim: {
    date: "Exec Time",
    symbol: "Symbol",
    direction: "Side",
    entry_price: "Price",
    quantity: "Qty",
    fees: "Fees & Comm",
    directionMap: { "BUY": "long", "SELL": "short" },
  },
  tradestation: {
    date: "Date",
    time: "Time",
    symbol: "Symbol",
    direction: "Buy/Sell",
    entry_price: "Price",
    quantity: "Quantity",
    fees: "Commission",
    directionMap: { "B": "long", "S": "short" },
  },
  public: {
    date: "Date",
    symbol: "Ticker",
    direction: "Transaction type",
    entry_price: "Price per share",
    quantity: "Shares",
    fees: "Fee",
    directionMap: { "buy": "long", "sell": "short" },
  },
  // Tastytrade: Account History CSV export
  // Columns: Date,Time,Type,Action,Symbol,Instrument Type,Description,Value,Quantity,Average Price,Commissions,Fees,Multiplier,Underlying Symbol,Expiration Date,Strike Price,Call or Put
  tastytrade: {
    date: "Date",
    time: "Time",
    symbol: "Underlying Symbol",
    direction: "Action",
    entry_price: "Average Price",
    quantity: "Quantity",
    fees: "Commissions",
    directionMap: {
      "BUY_TO_OPEN": "long", "BUY TO OPEN": "long",
      "SELL_TO_OPEN": "short", "SELL TO OPEN": "short",
      "BUY_TO_CLOSE": "long", "BUY TO CLOSE": "long",
      "SELL_TO_CLOSE": "short", "SELL TO CLOSE": "short",
      "BUY": "long", "SELL": "short",
    },
  },
  // Moomoo: Order History CSV export
  // Columns: Order No.,Time,Symbol,Side,Type,Qty.,Filled Qty.,Price,Filled Avg. Price,Amount,Status,Commission,Tax,Misc. Fee
  moomoo: {
    date: "Time",
    time: "Time",
    symbol: "Symbol",
    direction: "Side",
    entry_price: "Filled Avg. Price",
    quantity: "Filled Qty.",
    fees: "Commission",
    directionMap: { "Buy": "long", "Sell": "short", "BUY": "long", "SELL": "short" },
  },
  generic: {
    date: "date",
    time: "time",
    symbol: "symbol",
    direction: "direction",
    entry_price: "entry_price",
    exit_price: "exit_price",
    quantity: "quantity",
    fees: "fees",
    pnl: "pnl",
    directionMap: { "long": "long", "short": "short", "buy": "long", "sell": "short" },
  },
};

function parseDate(raw: string): string {
  if (!raw) return new Date().toISOString().split("T")[0];
  // Handle various date formats
  const cleaned = raw.split(" ")[0].split("T")[0];
  // Try yyyy-MM-dd, MM/dd/yyyy, dd/MM/yyyy, MM-dd-yyyy
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/,     // yyyy-MM-dd
    /^(\d{2})\/(\d{2})\/(\d{4})$/,   // MM/dd/yyyy
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // M/d/yyyy
  ];
  for (const re of formats) {
    const m = cleaned.match(re);
    if (m) {
      if (re.source.startsWith("^(\\d{4})")) return cleaned;
      return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    }
  }
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return new Date().toISOString().split("T")[0];
}

function parseNumber(raw: string): number {
  if (!raw) return 0;
  return parseFloat(raw.replace(/[$,%\s,]/g, "")) || 0;
}

function detectBrokerFormat(headers: string[]): BrokerFormat {
  const headerSet = new Set(headers.map((h) => h.toLowerCase().trim()));

  if (headerSet.has("filled price") && headerSet.has("filled qty")) return "webull";
  if (headerSet.has("t. price") && headerSet.has("buy/sell")) return "interactive_brokers";
  if (headerSet.has("instrument") && headerSet.has("average price")) return "robinhood";
  if (headerSet.has("exec time") && headerSet.has("fees & comm")) return "thinkorswim";
  if (headerSet.has("buy/sell") && headerSet.has("commission")) return "tradestation";
  if (headerSet.has("ticker") && headerSet.has("transaction type")) return "public";
  if (headerSet.has("underlying symbol") && headerSet.has("instrument type")) return "tastytrade";
  if (headerSet.has("filled avg. price") && headerSet.has("filled qty.")) return "moomoo";

  return "generic";
}

export function parseCsvFile(
  content: string,
  format?: BrokerFormat,
  customMapping?: CsvColumnMapping
): { trades: ImportedTrade[]; errors: string[]; detectedFormat: BrokerFormat } {
  const errors: string[] = [];

  const parsed = Papa.parse<RawRow>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    errors.push(...parsed.errors.map((e) => e.message));
  }

  const headers = Object.keys(parsed.data[0] ?? {});
  const detectedFormat = format ?? detectBrokerFormat(headers);
  const mapping = customMapping ?? BROKER_MAPPINGS[detectedFormat];
  const directionMap = (BROKER_MAPPINGS[detectedFormat] as { directionMap?: Record<string, "long" | "short"> }).directionMap ?? {};

  const trades: ImportedTrade[] = [];

  parsed.data.forEach((row, i) => {
    try {
      const symbol = (row[mapping.symbol] ?? "").trim().toUpperCase();
      if (!symbol) return;

      const rawDirection = (row[mapping.direction] ?? "").trim();
      const direction: "long" | "short" =
        directionMap[rawDirection] ?? directionMap[rawDirection.toLowerCase()] ?? "long";

      const entryPrice = parseNumber(row[mapping.entry_price] ?? "0");
      const quantity = Math.abs(parseNumber(row[mapping.quantity] ?? "0"));
      // Tastytrade has both Commissions and Fees columns — combine them
      const fees = detectedFormat === "tastytrade"
        ? Math.abs(parseNumber(row["Commissions"] ?? "0")) + Math.abs(parseNumber(row["Fees"] ?? "0"))
        : parseNumber(row[mapping.fees ?? ""] ?? "0");
      const exitPrice = mapping.exit_price ? parseNumber(row[mapping.exit_price] ?? "0") : undefined;
      const pnl = mapping.pnl ? parseNumber(row[mapping.pnl] ?? "") : undefined;

      if (!entryPrice || !quantity) {
        errors.push(`Row ${i + 2}: missing price or quantity for ${symbol}`);
        return;
      }

      const rawDate = row[mapping.date] ?? "";
      const date = parseDate(rawDate);
      const time = mapping.time ? (row[mapping.time] ?? "").split(" ").pop()?.slice(0, 5) : undefined;

      // Detect options: Tastytrade has an "Instrument Type" column; others use OCC symbol pattern
      const instrumentType = (row["Instrument Type"] ?? row["instrument type"] ?? "").toLowerCase();
      const isOptions =
        instrumentType === "equity option" ||
        instrumentType === "future option" ||
        /\d{6}[CP]\d+/.test(symbol) ||
        /\d{6}[CP]\d+/.test(row["Symbol"] ?? "");
      const isFutures = instrumentType.includes("future") && !instrumentType.includes("option");
      const assetType = isOptions ? "options" : isFutures ? "futures" : "stock";

      trades.push({
        date,
        time,
        symbol: symbol.split(" ")[0],
        direction,
        entry_price: entryPrice,
        exit_price: exitPrice && exitPrice > 0 ? exitPrice : undefined,
        quantity,
        fees,
        pnl,
        asset_type: assetType,
      });
    } catch (err) {
      errors.push(`Row ${i + 2}: ${err instanceof Error ? err.message : "parse error"}`);
    }
  });

  return { trades, errors, detectedFormat };
}

export { detectBrokerFormat };
