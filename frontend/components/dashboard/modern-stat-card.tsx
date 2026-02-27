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
  colorName?: "blue" | "green" | "orange" | "purple" | "default";
}

// Generate smooth, deterministic SVG paths to prevent hydration errors but provide variety
function getSparklinePath(trend: "up" | "down" | "neutral", variant: number) {
  if (trend === "up") {
    switch (variant % 3) {
      case 0: return "M 0 35 C 10 35, 20 25, 30 25 C 45 25, 55 20, 70 15 C 80 12, 90 5, 100 5";
      case 1: return "M 0 32 C 15 32, 20 20, 35 22 C 50 24, 55 12, 70 15 C 85 18, 90 4, 100 4";
      case 2: return "M 0 36 C 20 36, 30 28, 45 22 C 60 16, 75 14, 85 8 C 92 5, 96 4, 100 2";
    }
  } else if (trend === "down") {
    switch (variant % 3) {
      case 0: return "M 0 5 C 10 5, 20 15, 30 15 C 45 15, 55 20, 70 25 C 80 28, 90 35, 100 35";
      case 1: return "M 0 4 C 15 4, 20 16, 35 14 C 50 12, 55 24, 70 21 C 85 18, 90 32, 100 32";
      case 2: return "M 0 2 C 20 2, 30 10, 45 16 C 60 22, 75 24, 85 30 C 92 33, 96 34, 100 36";
    }
  }
  return "M 0 20 C 20 20, 30 15, 50 20 C 70 25, 80 20, 100 20";
}

const colorMap = {
  blue: { stroke: "#3b82f6", from: "rgba(59, 130, 246, 0.4)", to: "rgba(59, 130, 246, 0)" },
  green: { stroke: "#22c55e", from: "rgba(34, 197, 94, 0.4)", to: "rgba(34, 197, 94, 0)" },
  orange: { stroke: "#f97316", from: "rgba(249, 115, 22, 0.4)", to: "rgba(249, 115, 22, 0)" },
  purple: { stroke: "#a855f7", from: "rgba(168, 85, 247, 0.4)", to: "rgba(168, 85, 247, 0)" },
  default: { stroke: "#6b7280", from: "rgba(107, 114, 128, 0.4)", to: "rgba(107, 114, 128, 0)" },
};

export function ModernStatCard({
  title,
  value,
  percentageChange = 0,
  icon: Icon,
  gradient,
  description,
  trend,
  colorName = "default",
}: ModernStatCardProps) {
  const isPositive = percentageChange > 0;
  const isNegative = percentageChange < 0;

  // Auto-detect trend if not provided
  const finalTrend = trend || (isPositive ? "up" : isNegative ? "down" : "neutral");

  const numValue = typeof value === "number" ? value : 0;
  const path = getSparklinePath(finalTrend, numValue + Math.abs(percentageChange));
  const fillPath = `${path} L 100 40 L 0 40 Z`;
  const colors = colorMap[colorName] || colorMap.default;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700
      hover:shadow-md transition-all duration-300 relative overflow-hidden group">

      {/* Icon Badge Top Right */}
      <div className="absolute top-5 right-5 z-10">
        <div className={`p-2.5 rounded-lg ${gradient} shadow-sm group-hover:shadow-md transition-shadow`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>

      <div className="relative z-10 flex flex-col h-full justify-between gap-4">
        {/* Title */}
        <p className="text-[15px] font-medium text-gray-600 dark:text-gray-400 max-w-[70%]">
          {title}
        </p>

        {/* Value and Sparkline Row */}
        <div className="flex items-end justify-between -mt-1">
          <h3 className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
            {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
          </h3>

          {/* Sparkline Graph */}
          <div className="w-[80px] h-[35px] mb-1">
            <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full">
              <defs>
                <linearGradient id={`gradient-${title.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.from} />
                  <stop offset="100%" stopColor={colors.to} />
                </linearGradient>
              </defs>
              <path d={fillPath} fill={`url(#gradient-${title.replace(/\s+/g, '')})`} />
              <path d={path} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" stroke={colors.stroke} />
            </svg>
          </div>
        </div>

        {/* Bottom Stats */}
        <div className="flex items-center justify-end gap-2 mt-1">
          <div
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold shrink-0",
              finalTrend === "up" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
              finalTrend === "down" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
              finalTrend === "neutral" && "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
            )}
          >
            {finalTrend === "up" && <TrendingUp className="h-[14px] w-[14px]" />}
            {finalTrend === "down" && <TrendingDown className="h-[14px] w-[14px]" />}
            {finalTrend === "neutral" && <Minus className="h-[14px] w-[14px]" />}
            <span>
              {isPositive && "+"}
              {percentageChange}%
            </span>
          </div>
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
