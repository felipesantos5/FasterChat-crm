"use client";

import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, setMonth, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { DateRangeFilterValue } from "./date-range-filter";

interface MonthFilterProps {
  value: DateRangeFilterValue;
  onChange: (value: DateRangeFilterValue) => void;
}

export function MonthFilter({ value, onChange }: MonthFilterProps) {
  const currentYear = getYear(new Date());

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const date = setMonth(new Date(currentYear, 0, 1), i);
      return {
        value: i.toString(),
        label: format(date, "MMMM", { locale: ptBR }),
      };
    });
  }, [currentYear]);

  const handleMonthChange = (monthIdx: string) => {
    const idx = parseInt(monthIdx);
    const from = startOfMonth(setMonth(new Date(currentYear, 0, 1), idx));
    const to = endOfMonth(from);

    onChange({
      preset: "custom",
      customRange: { from, to }
    });
  };

  // Determina se o filtro atual corresponde a algum mês cheio do ano corrente
  const currentSelectedMonth = useMemo(() => {
    if (value.preset !== "custom" || !value.customRange) return undefined;

    const { from, to } = value.customRange;
    if (getYear(from) !== currentYear) return undefined;

    // Verifica se inicia no dia 1 e termina no último dia do mesmo mês
    const start = startOfMonth(from);
    const end = endOfMonth(from);

    if (from.getTime() === start.getTime() && to.getTime() === end.getTime()) {
      return from.getMonth().toString();
    }

    return undefined;
  }, [value, currentYear]);

  return (
    <div className="flex items-center gap-2">
      <Select value={currentSelectedMonth} onValueChange={handleMonthChange}>
        <SelectTrigger
          className="w-[200px] h-10 bg-white border-gray-200 text-slate-900 data-[placeholder]:text-slate-900 hover:bg-gray-50 transition-colors shadow-sm rounded-lg flex items-center gap-2 px-4 font-semibold text-sm whitespace-nowrap"
        >
          <div className="flex items-center gap-2 truncate">
            <CalendarDays className="h-4 w-4 text-gray-500 shrink-0" />
            <SelectValue placeholder="Selecionar mês" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <div className="p-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b mb-1">
            Meses de {currentYear}
          </div>
          {months.map((month) => (
            <SelectItem key={month.value} value={month.value} className="capitalize">
              {month.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
