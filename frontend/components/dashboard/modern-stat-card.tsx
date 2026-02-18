"use client";

import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModernStatCardProps {
  title: string;
  value: number | string;
  percentageChange?: number;
  icon: LucideIcon;
  gradient: string;
  description?: string;
  trend?: "up" | "down" | "neutral";
}

export function ModernStatCard({
  title,
  value,
  percentageChange = 0,
  icon: Icon,
  gradient,
  description,
  trend,
}: ModernStatCardProps) {
  const isPositive = percentageChange > 0;
  const isNegative = percentageChange < 0;

  // Auto-detect trend if not provided
  const finalTrend = trend || (isPositive ? "up" : isNegative ? "down" : "neutral");

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700
      hover:shadow-xl transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              {title}
            </p>
            <div className={`p-3 rounded-xl ${gradient} shadow-lg`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
          </h3>
          <div className="flex items-center justify-between">
            {description && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {description}
              </p>
            )}
            <div
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
                finalTrend === "up" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                finalTrend === "down" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                finalTrend === "neutral" && "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400"
              )}
            >
              {finalTrend === "up" && <TrendingUp className="h-3 w-3" />}
              {finalTrend === "down" && <TrendingDown className="h-3 w-3" />}
              {finalTrend === "neutral" && <Minus className="h-3 w-3" />}
              <span>
                {isPositive && "+"}
                {percentageChange}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
