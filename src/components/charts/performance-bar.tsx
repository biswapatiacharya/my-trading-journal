"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { PerformanceBreakdown } from "@/types";

interface PerformanceBarProps {
  title: string;
  data: PerformanceBreakdown[];
  showWinRate?: boolean;
  maxItems?: number;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="bg-popover border rounded-lg p-3 shadow-lg text-sm space-y-1">
      <p className="font-medium">{label}</p>
      <p className={item.value >= 0 ? "text-profit" : "text-loss"}>
        P&L: {formatCurrency(item.value)}
      </p>
    </div>
  );
}

export function PerformanceBar({ title, data, showWinRate = false, maxItems = 8 }: PerformanceBarProps) {
  const displayData = data.slice(0, maxItems).map((d) => ({
    ...d,
    displayValue: showWinRate ? d.winRate : d.pnl,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={displayData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => showWinRate ? `${v.toFixed(0)}%` : formatCurrency(v).replace("$", "$")}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
              {!showWinRate && <ReferenceLine y={0} stroke="hsl(var(--border))" />}
              <Bar dataKey="displayValue" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {displayData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      showWinRate
                        ? entry.winRate >= 50 ? "#22c55e" : "#ef4444"
                        : entry.pnl >= 0 ? "#22c55e" : "#ef4444"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
