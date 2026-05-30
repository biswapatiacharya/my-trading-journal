"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BrainCircuit, Sparkles, TrendingUp, AlertTriangle, CheckCircle,
  Info, Loader2, RefreshCw, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatRelativeTime, cn } from "@/lib/utils";
import type { Trade, AIInsight } from "@/types";

interface AIInsightsClientProps {
  trades: Trade[];
  insights: AIInsight[];
}

const SEVERITY_CONFIG = {
  info:     { icon: Info,         color: "text-blue-500",   bg: "bg-blue-500/10 border-blue-500/20" },
  success:  { icon: CheckCircle,  color: "text-profit",     bg: "bg-profit/10 border-profit/20" },
  warning:  { icon: AlertTriangle,color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/20" },
  critical: { icon: AlertTriangle,color: "text-loss",       bg: "bg-loss/10 border-loss/20" },
};

const TYPE_LABEL = {
  pattern:       "Pattern",
  behavioral:    "Behavioral",
  emotional:     "Emotional",
  performance:   "Performance",
  recommendation:"Recommendation",
};

export function AIInsightsClient({ trades, insights: initialInsights }: AIInsightsClientProps) {
  const router = useRouter();
  const [insights, setInsights] = useState(initialInsights);
  const [generating, setGenerating] = useState(false);

  const hasTrades = trades.length >= 5;

  async function generateInsights() {
    if (!hasTrades) {
      toast.error("Add at least 5 trades before generating insights");
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeCount: trades.length }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to generate insights");
      }

      const { insights: newInsights } = await res.json();
      setInsights(newInsights);
      toast.success("New insights generated");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to generate insights");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <BrainCircuit className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Claude AI Trading Analysis</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                AI analyses your last {trades.length} trades to find patterns, behavioral biases, and growth opportunities.
              </p>
              {!hasTrades && (
                <p className="text-xs text-yellow-500 mt-1">
                  Add at least 5 trades to unlock AI insights.
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              onClick={generateInsights}
              disabled={generating || !hasTrades}
              className="gap-2"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {generating ? "Analysing..." : insights.length > 0 ? "Re-analyse" : "Generate Insights"}
            </Button>
            {insights.length > 0 && (
              <Button variant="outline" size="icon" onClick={generateInsights} disabled={generating}>
                <RefreshCw className={cn("w-4 h-4", generating && "animate-spin")} />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Insights list */}
      {insights.length > 0 ? (
        <div className="space-y-3">
          {insights.map((insight) => {
            const config = SEVERITY_CONFIG[insight.severity];
            const IconComponent = config.icon;
            return (
              <Card key={insight.id} className={cn("border", config.bg)}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <IconComponent className={cn("w-5 h-5 mt-0.5 shrink-0", config.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-sm">{insight.title}</h4>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {TYPE_LABEL[insight.insight_type]}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(insight.generated_at)}
                        </div>
                      </div>
                      <p className="text-sm text-foreground/80 mt-1.5 leading-relaxed">
                        {insight.content}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        !generating && (
          <div className="text-center py-16 border rounded-xl bg-muted/20 space-y-3">
            <BrainCircuit className="w-10 h-10 text-muted-foreground mx-auto" />
            <div>
              <p className="font-semibold">No insights yet</p>
              <p className="text-sm text-muted-foreground">
                {hasTrades
                  ? "Click \"Generate Insights\" to get your first AI analysis"
                  : "Add more trades to enable AI analysis"}
              </p>
            </div>
          </div>
        )
      )}

      {generating && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-muted animate-pulse shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
                    <div className="h-3 bg-muted animate-pulse rounded w-full" />
                    <div className="h-3 bg-muted animate-pulse rounded w-5/6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
