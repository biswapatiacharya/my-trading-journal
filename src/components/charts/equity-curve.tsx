"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateShort } from "@/lib/utils";
import type { EquityCurvePoint } from "@/types";

interface EquityCurveProps {
  data: EquityCurvePoint[];
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const equity = payload[0]?.value ?? 0;
  const pnl = payload[1]?.value ?? 0;

  return (
    <div className="bg-popover border rounded-lg p-3 shadow-lg text-sm space-y-1">
      <p className="font-medium">{label}</p>
      <p>Equity: <span className={equity >= 0 ? "text-profit" : "text-loss"}>{formatCurrency(equity)}</span></p>
      <p>Day P&L: <span className={pnl >= 0 ? "text-profit" : "text-loss"}>{formatCurrency(pnl)}</span></p>
    </div>
  );
}

export function EquityCurve({ data }: EquityCurveProps) {
  const isPositive = data.length > 0 && data[data.length - 1].equity >= 0;
  const color = isPositive ? "#22c55e" : "#ef4444";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Equity Curve</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            No trade data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateShort}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => formatCurrency(v, "USD").replace("$", "$")}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 4" />
              <Area
                type="monotone"
                dataKey="equity"
                stroke={color}
                strokeWidth={2}
                fill="url(#equityGradient)"
                dot={false}
                activeDot={{ r: 4, fill: color }}
              />
              <Area
                type="monotone"
                dataKey="pnl"
                stroke="transparent"
                fill="transparent"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
