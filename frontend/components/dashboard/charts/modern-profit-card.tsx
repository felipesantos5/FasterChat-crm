"use client";

import { DollarSign, TrendingUp, TrendingDown, Minus, ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DealValueStats } from "@/lib/pipeline";

interface ModernProfitCardProps {
  data: DealValueStats;
}

export function ModernProfitCard({ data }: ModernProfitCardProps) {
  const isPositive = data.percentageChange > 0;
  const isNegative = data.percentageChange < 0;
  const trend = isPositive ? "up" : isNegative ? "down" : "neutral";

  const formatCurrency = (value: number) => {
    if (value >= 1_000_000) {
      return `R$ ${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `R$ ${(value / 1_000).toFixed(1)}K`;
    }
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    });
  };

  const formatFullCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    });
  };

  return (
    <Card className="flex flex-col h-full shadow-sm sm:shadow-lg border-gray-100 dark:border-gray-800 overflow-hidden relative rounded-2xl">
      {/* Gradient accent top */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500" />

      <CardHeader className="pb-1 sm:pb-2 pt-3 sm:pt-5 px-3 sm:px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="p-1 sm:p-1.5 rounded-lg bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30">
              <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-[11px] sm:text-sm font-semibold truncate">Lucro em Vendas</CardTitle>
          </div>
          <div
            className={cn(
              "inline-flex items-center gap-0.5 sm:gap-1 px-1 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-semibold shrink-0",
              trend === "up" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
              trend === "down" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
              trend === "neutral" && "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
            )}
          >
            {trend === "up" && <TrendingUp className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
            {trend === "down" && <TrendingDown className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
            {trend === "neutral" && <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
            <span>
              {isPositive && "+"}
              {data.percentageChange}%
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 px-3 sm:px-4 pb-3 sm:pb-4">
        <div className="space-y-2 sm:space-y-4">
          {/* Main value */}
          <div className="mt-0.5 sm:mt-1">
            <p className="text-lg sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
              {formatCurrency(data.totalRevenue)}
            </p>
            {data.totalRevenue >= 1_000 && (
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 hidden sm:block">
                {formatFullCurrency(data.totalRevenue)}
              </p>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-1.5 sm:gap-3">
            <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2.5 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/20">
              <div className="p-1 sm:p-1.5 bg-green-100 dark:bg-green-800/50 rounded-md hidden sm:block">
                <ShoppingBag className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] sm:text-[10px] uppercase font-bold text-green-600 dark:text-green-500">
                  Vendas
                </span>
                <span className="text-xs sm:text-sm font-bold text-green-800 dark:text-green-200">
                  {data.dealsCount}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/30">
              <div className="p-1 sm:p-1.5 bg-gray-100 dark:bg-gray-700/50 rounded-md hidden sm:block">
                <DollarSign className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] sm:text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">
                  Ticket
                </span>
                <span className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200">
                  {data.dealsCount > 0
                    ? formatCurrency(data.totalRevenue / data.dealsCount)
                    : "R$ 0"}
                </span>
              </div>
            </div>
          </div>

          {/* Previous period comparison */}
          {data.previousRevenue > 0 && (
            <p className="text-[9px] sm:text-[10px] text-gray-500 text-center mt-1 hidden sm:block">
              Período anterior: {formatFullCurrency(data.previousRevenue)} ({data.previousDealsCount} vendas)
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
