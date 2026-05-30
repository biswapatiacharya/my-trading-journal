"use client";

import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, parse } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import type { CalendarPnlData } from "@/types";

interface CalendarPnlProps {
  data: CalendarPnlData;
  month?: Date;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarPnl({ data, month = new Date() }: CalendarPnlProps) {
  const days = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    return eachDayOfInterval({ start, end });
  }, [month]);

  const startOffset = getDay(startOfMonth(month));
  const maxAbsValue = useMemo(() => {
    return Math.max(1, ...Object.values(data).map((d) => Math.abs(d.pnl)));
  }, [data]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          P&L Calendar — {format(month, "MMMM yyyy")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-xs font-medium text-muted-foreground py-1">{d}</div>
          ))}
          {/* Start offset blank cells */}
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const entry = data[key];
            const pnl = entry?.pnl ?? 0;
            const isToday = key === format(new Date(), "yyyy-MM-dd");
            const intensity = entry ? Math.min(0.9, Math.abs(pnl) / maxAbsValue) : 0;

            let bg = "transparent";
            if (entry) {
              bg = pnl >= 0
                ? `rgba(34, 197, 94, ${0.15 + intensity * 0.6})`
                : `rgba(239, 68, 68, ${0.15 + intensity * 0.6})`;
            }

            return (
              <div
                key={key}
                title={entry ? `${format(day, "MMM d")}: ${formatCurrency(pnl)} (${entry.trades} trades)` : format(day, "MMM d")}
                className={cn(
                  "rounded text-xs py-1.5 px-0.5 text-center cursor-default transition-all hover:scale-105",
                  isToday && "ring-1 ring-primary",
                  !entry && "text-muted-foreground/50"
                )}
                style={{ backgroundColor: bg }}
              >
                <div className={cn("font-medium", entry && (pnl >= 0 ? "text-profit" : "text-loss"))}>
                  {format(day, "d")}
                </div>
                {entry && (
                  <div className={cn("text-[9px] leading-tight font-medium truncate", pnl >= 0 ? "text-profit" : "text-loss")}>
                    {pnl >= 0 ? "+" : ""}{pnl >= 1000 ? `${(pnl / 1000).toFixed(1)}k` : pnl.toFixed(0)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
