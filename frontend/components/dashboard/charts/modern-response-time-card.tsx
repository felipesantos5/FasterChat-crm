"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  Cell,
} from "recharts";
import { Clock, TrendingUp, TrendingDown, CheckCircle2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AvgResponseTimeData, HourlyMessageData } from "@/lib/dashboard";

interface ModernResponseTimeCardProps {
  data: AvgResponseTimeData;
  hourlyData?: HourlyMessageData[];
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export function ModernResponseTimeCard({ data, hourlyData }: ModernResponseTimeCardProps) {
  const chartData = useMemo(() => {
    if (!hourlyData || hourlyData.length === 0) return [];
    return hourlyData.slice(0, 12).map((h) => ({
      hour: h.hour,
      count: h.count,
    }));
  }, [hourlyData]);

  const peakHour = useMemo(() => {
    if (!chartData.length) return null;
    return chartData.reduce((max, d) => (d.count > max.count ? d : max), chartData[0]);
  }, [chartData]);

  const isPositive = data.percentageChange <= 0; // lower response time = positive
  const TrendIcon = isPositive ? TrendingDown : TrendingUp;

  return (
    <Card className="flex flex-col h-full shadow-lg border-gray-100 dark:border-gray-800">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#d6ffe4] dark:bg-[#0f311c]/30">
            <Clock className="h-4 w-4 text-[#1a753a] dark:text-[#4ed479]" />
          </div>
          <CardTitle className="text-sm font-semibold">Tempo Médio de Resposta</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 px-4 pb-3">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-2xl font-bold tracking-tight">{formatTime(data.avgSeconds)}</span>
          {data.percentageChange !== 0 && (
            <span className={`flex items-center gap-0.5 text-xs font-medium ${isPositive ? "text-[#1a753a] dark:text-[#4ed479]" : "text-gray-900 dark:text-gray-100"}`}>
              <TrendIcon className="h-3 w-3" />
              {Math.abs(data.percentageChange).toFixed(0)}%
            </span>
          )}
          {isPositive && data.avgSeconds > 0 && (
            <CheckCircle2 className="h-4 w-4 text-[#26bc58]" />
          )}
        </div>

        {chartData.length > 0 && (
          <div className="h-[80px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="hour" hide />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.hour === peakHour?.hour
                          ? "#1a753a"
                          : "rgba(26, 117, 58, 0.3)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {peakHour && (
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {chartData[0]?.hour || "00:00"}
            </span>
            <span className="flex items-center gap-1">
              Pico: {peakHour.hour}
            </span>
            <span>+{peakHour.hour}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
