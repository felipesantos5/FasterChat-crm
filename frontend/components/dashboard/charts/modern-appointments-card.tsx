"use client";

import { CalendarCheck, TrendingUp, TrendingDown, Clock, CheckCircle2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ActiveAppointmentsData } from "@/lib/dashboard";

interface ModernAppointmentsCardProps {
  data: ActiveAppointmentsData;
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m ${Math.round((minutes % 1) * 60)}s`;
  return `${h}h ${m}m`;
}

export function ModernAppointmentsCard({ data }: ModernAppointmentsCardProps) {
  const isPositive = data.percentageChange >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <Card className="flex flex-col h-full shadow-lg border-gray-100 dark:border-gray-800">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <CalendarCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-sm font-semibold">Agendamentos Ativos</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 px-4 pb-3">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-bold tracking-tight">{data.active}</span>
          {data.percentageChange !== 0 && (
            <span className={`flex items-center gap-0.5 text-xs font-medium ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
              <TrendIcon className="h-3 w-3" />
              {Math.abs(data.percentageChange).toFixed(0)}%
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mb-4">
          +{data.active} esta semana
        </p>

        <div className="space-y-3">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Tempo Médio</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-bold">{formatDuration(data.avgDurationMinutes)}</span>
                {data.percentageChange !== 0 && (
                  <span className={`text-[10px] font-medium ${isPositive ? "text-emerald-600" : "text-red-500"}`}>
                    {isPositive ? "↗" : "↘"} {Math.abs(data.percentageChange).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Atendimentos Concluídos</p>
              <span className="text-sm font-bold">{data.completed}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
