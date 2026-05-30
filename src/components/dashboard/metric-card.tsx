import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  subValue?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  className?: string;
  highlight?: boolean;
}

export function MetricCard({
  title,
  value,
  subValue,
  icon: Icon,
  trend,
  className,
  highlight,
}: MetricCardProps) {
  return (
    <Card className={cn(
      "relative overflow-hidden",
      highlight && "ring-1 ring-primary/20 bg-primary/5",
      className
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate">{title}</p>
            <p className={cn(
              "text-2xl font-bold mt-0.5",
              trend === "up" && "text-profit",
              trend === "down" && "text-loss",
            )}>
              {value}
            </p>
            {subValue && (
              <p className="text-xs text-muted-foreground mt-0.5">{subValue}</p>
            )}
          </div>
          {Icon && (
            <div className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
              trend === "up" ? "bg-profit/10" : trend === "down" ? "bg-loss/10" : "bg-muted",
            )}>
              <Icon className={cn(
                "w-4.5 h-4.5",
                trend === "up" ? "text-profit" : trend === "down" ? "text-loss" : "text-muted-foreground",
              )} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
