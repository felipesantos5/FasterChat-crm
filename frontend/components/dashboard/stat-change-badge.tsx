import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { DateRangePreset } from "./date-range-filter";

interface StatChangeBadgeProps {
  percentageChange: number;
  period?: DateRangePreset;
}

export function StatChangeBadge({ percentageChange, period = "today" }: StatChangeBadgeProps) {
  const isPositive = percentageChange > 0;
  const isNegative = percentageChange < 0;
  const isNeutral = percentageChange === 0;

  const getPeriodText = () => {
    switch (period) {
      case "today":
        return "vs ontem";
      case "yesterday":
        return "vs anterior";
      case "7days":
        return "vs 7 dias anteriores";
      case "30days":
        return "vs 30 dias anteriores";
      case "3months":
        return "vs período anterior";
      case "all":
        return "total";
      case "custom":
        return "vs período anterior";
      default:
        return "";
    }
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        isPositive && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        isNegative && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        isNeutral && "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
      )}
    >
      {isPositive && <TrendingUp className="h-3 w-3" />}
      {isNegative && <TrendingDown className="h-3 w-3" />}
      {isNeutral && <Minus className="h-3 w-3" />}
      <span>
        {isPositive && "+"}
        {percentageChange}%
      </span>
      <span className="text-[10px] opacity-70">{getPeriodText()}</span>
    </div>
  );
}
