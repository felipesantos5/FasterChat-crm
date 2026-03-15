"use client";

import { DollarSign, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { DealValueStats } from "@/lib/pipeline";

interface ModernProfitCardProps {
  data: DealValueStats;
}

/**
 * Gera sparkline SVG a partir do número de vendas e trend.
 * Com poucos pagamentos o gráfico mostra picos visíveis.
 */
function getProfitSparklinePath(trend: "up" | "down" | "neutral", dealsCount: number): string {
  // Poucos deals → picos mais acentuados (gráfico com variação maior)
  if (dealsCount <= 3) {
    if (trend === "up") return "M 0 35 C 8 35, 15 34, 25 30 C 35 10, 40 8, 50 25 C 60 35, 68 32, 78 15 C 88 5, 95 3, 100 5";
    if (trend === "down") return "M 0 8 C 10 6, 18 10, 30 25 C 42 35, 50 30, 60 18 C 70 10, 80 28, 90 32 C 95 34, 98 35, 100 35";
    return "M 0 22 C 15 22, 25 10, 40 18 C 55 30, 65 12, 80 20 C 90 25, 95 20, 100 20";
  }
  // Muitos deals → curva mais suave
  if (trend === "up") return "M 0 35 C 15 33, 25 28, 40 22 C 55 16, 70 12, 85 7 C 92 5, 96 4, 100 3";
  if (trend === "down") return "M 0 5 C 15 7, 25 12, 40 18 C 55 24, 70 28, 85 33 C 92 35, 96 36, 100 36";
  return "M 0 20 C 20 18, 35 22, 50 20 C 65 18, 80 22, 100 20";
}

const profitColors = {
  stroke: "#16a34a",
  from: "rgba(22, 163, 74, 0.4)",
  to: "rgba(22, 163, 74, 0)",
};

export function ModernProfitCard({ data }: ModernProfitCardProps) {
  const isPositive = data.percentageChange > 0;
  const isNegative = data.percentageChange < 0;
  const finalTrend = isPositive ? "up" : isNegative ? "down" : "neutral";

  const formatCurrency = (value: number): string => {
    if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}K`;
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
  };

  const path = getProfitSparklinePath(finalTrend, data.dealsCount);
  const fillPath = `${path} L 100 40 L 0 40 Z`;
  const gradientId = "gradient-LucroVendas";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm px-3 py-3 sm:px-5 sm:py-4 border border-gray-100 dark:border-gray-700
      hover:shadow-md transition-all duration-300 relative overflow-hidden group">

      {/* Icon Badge Top Right */}
      <div className="absolute top-3 right-3 sm:top-5 sm:right-5 z-10">
        <div className="p-1.5 sm:p-2.5 rounded-lg bg-gradient-to-br from-[#44ba6c] to-[#1e713b] shadow-sm group-hover:shadow-md transition-shadow">
          <DollarSign className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-white" />
        </div>
      </div>

      <div className="relative z-10 flex flex-col h-full justify-between gap-1.5 sm:gap-3">
        {/* Title */}
        <p className="text-[11px] sm:text-[15px] font-medium text-gray-600 dark:text-gray-400 max-w-[70%] truncate">
          Lucro em Vendas
        </p>

        {/* Value */}
        <h3 className="text-xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight -mt-0.5 sm:-mt-1">
          {formatCurrency(data.totalRevenue)}
        </h3>

        {/* Bottom: Sparkline + Percentage */}
        <div className="flex items-center justify-between gap-1 sm:gap-2">
          {/* Sparkline Graph */}
          <div className="flex-1 h-[20px] sm:h-[28px]">
            <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full">
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={profitColors.from} />
                  <stop offset="100%" stopColor={profitColors.to} />
                </linearGradient>
              </defs>
              <path d={fillPath} fill={`url(#${gradientId})`} />
              <path d={path} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" stroke={profitColors.stroke} />
            </svg>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <div
              className={cn(
                "inline-flex items-center gap-0.5 sm:gap-1 px-1 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-semibold shrink-0",
                finalTrend === "up" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                finalTrend === "down" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                finalTrend === "neutral" && "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
              )}
            >
              {finalTrend === "up" && <TrendingUp className="h-3 w-3 sm:h-[14px] sm:w-[14px]" />}
              {finalTrend === "down" && <TrendingDown className="h-3 w-3 sm:h-[14px] sm:w-[14px]" />}
              {finalTrend === "neutral" && <Minus className="h-3 w-3 sm:h-[14px] sm:w-[14px]" />}
              <span>
                {isPositive && "+"}
                {data.percentageChange}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
