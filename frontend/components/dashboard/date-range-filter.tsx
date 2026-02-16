"use client";

import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronDown, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange as DayPickerDateRange } from "react-day-picker";

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "7days"
  | "30days"
  | "3months"
  | "all"
  | "custom";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface DateRangeFilterValue {
  preset: DateRangePreset;
  customRange?: DateRange;
}

interface DateRangeFilterProps {
  value: DateRangeFilterValue;
  onChange: (value: DateRangeFilterValue) => void;
  className?: string;
}

const presetLabels: Record<DateRangePreset, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  "7days": "Últimos 7 dias",
  "30days": "Últimos 30 dias",
  "3months": "Últimos 3 meses",
  all: "Tempo completo",
  custom: "Personalizado",
};

export function getDateRangeFromPreset(preset: DateRangePreset, customRange?: DateRange): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "today":
      return {
        from: today,
        to: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1), // Fim do dia
      };

    case "yesterday":
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        from: yesterday,
        to: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1),
      };

    case "7days":
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return {
        from: sevenDaysAgo,
        to: now,
      };

    case "30days":
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return {
        from: thirtyDaysAgo,
        to: now,
      };

    case "3months":
      const threeMonthsAgo = new Date(today);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      return {
        from: threeMonthsAgo,
        to: now,
      };

    case "all":
      // Define uma data muito antiga (1 ano atrás) como "tempo completo"
      const oneYearAgo = new Date(today);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      return {
        from: oneYearAgo,
        to: now,
      };

    case "custom":
      return customRange || { from: today, to: now };

    default:
      return { from: today, to: now };
  }
}

export function DateRangeFilter({ value, onChange, className }: DateRangeFilterProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DayPickerDateRange | undefined>(
    value.customRange
      ? { from: value.customRange.from, to: value.customRange.to }
      : undefined
  );

  // Atualiza o dateRange quando o value muda
  useEffect(() => {
    if (value.customRange) {
      setDateRange({ from: value.customRange.from, to: value.customRange.to });
    }
  }, [value.customRange]);

  const handlePresetSelect = (preset: DateRangePreset) => {
    if (preset === "custom") {
      // Abre o dialog após um pequeno delay para evitar conflitos
      setTimeout(() => {
        setIsDialogOpen(true);
      }, 100);
    } else {
      onChange({ preset });
    }
  };

  const handleRangeSelect = (range: DayPickerDateRange | undefined) => {
    setDateRange(range);
  };

  const handleApply = () => {
    if (dateRange?.from && dateRange?.to) {
      onChange({
        preset: "custom",
        customRange: { from: dateRange.from, to: dateRange.to },
      });
      setIsDialogOpen(false);
    }
  };

  const handleCancel = () => {
    // Reseta para o valor anterior
    if (value.customRange) {
      setDateRange({ from: value.customRange.from, to: value.customRange.to });
    } else {
      setDateRange(undefined);
    }
    setIsDialogOpen(false);
  };

  const getDisplayText = () => {
    if (value.preset === "custom" && value.customRange) {
      return `${format(value.customRange.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(value.customRange.to, "dd/MM/yyyy", { locale: ptBR })}`;
    }
    return presetLabels[value.preset];
  };

  return (
    <>
      <div className={cn("flex items-center gap-2", className)}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="justify-between min-w-[200px]">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                <span className="text-sm">{getDisplayText()}</span>
              </div>
              <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuLabel>Período</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {(["today", "yesterday", "7days", "30days", "3months", "all"] as DateRangePreset[]).map((preset) => (
              <DropdownMenuItem
                key={preset}
                onClick={() => handlePresetSelect(preset)}
                className={cn(
                  "cursor-pointer",
                  value.preset === preset && "bg-accent"
                )}
              >
                {presetLabels[preset]}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => handlePresetSelect("custom")}
              className="cursor-pointer"
            >
              {presetLabels.custom}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Dialog para seleção personalizada */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Período Personalizado</DialogTitle>
            <DialogDescription>
              Selecione a data inicial e final para filtrar as métricas
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-4">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={handleRangeSelect}
              numberOfMonths={2}
              locale={ptBR}
              disabled={(date) => date > new Date()}
              defaultMonth={dateRange?.from}
            />

            {dateRange?.from && dateRange?.to && (
              <div className="text-sm text-muted-foreground">
                Período selecionado: {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} até{" "}
                {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button
              onClick={handleApply}
              disabled={!dateRange?.from || !dateRange?.to}
            >
              Aplicar Filtro
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
