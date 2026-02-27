"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { HourlyMessageData } from "@/lib/dashboard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface ModernPeakHoursChartProps {
  data: HourlyMessageData[];
}

const chartConfig = {
  count: {
    label: "Mensagens",
    color: "hsl(var(--chart-1))", // We will override color directly with Cell if needed... actually we can just use the config color
  },
} satisfies ChartConfig;

export function ModernPeakHoursChart({ data }: ModernPeakHoursChartProps) {
  // Agrupa os dados de 2 em 2 horas
  const groupedData = data.reduce((acc, curr) => {
    const hourInt = parseInt(curr.hour.split(':')[0], 10);
    // Cria blocos de 2 horas: 0-1 -> 00H, 2-3 -> 02H, etc.
    const groupHour = Math.floor(hourInt / 2) * 2;
    // Formata o label para mostrar o intervalo, ex: "00:00 - 02:00" ou apenas a hora de início
    const groupKey = `${groupHour.toString().padStart(2, '0')}:00`;

    const existingGroup = acc.find((item) => item.hour === groupKey);
    if (existingGroup) {
      existingGroup.count += curr.count;
    } else {
      acc.push({ hour: groupKey, count: curr.count });
    }
    return acc;
  }, [] as HourlyMessageData[]);

  // Encontra o horário de pico para destaque com base nos dados agrupados
  const peakHour = [...groupedData].sort((a, b) => b.count - a.count)[0];

  return (
    <Card className="flex flex-col h-full shadow-lg border-gray-100 dark:border-gray-800">
      <CardHeader className="items-start pb-2 pt-4 px-4">
        <div className="flex w-full justify-between items-start">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/30">
              <TrendingUp className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <CardTitle className="text-sm font-semibold">Pico de Mensagens</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-3 px-4">
        {peakHour && peakHour.count > 0 && (
          <div className="text-center mb-2">
            <span className="text-2xl font-bold">{peakHour.hour.replace(':00', ':00')}</span>
            <p className="text-[11px] text-muted-foreground">Maior volume de mensagens</p>
          </div>
        )}
        <ChartContainer config={chartConfig} className="h-[140px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={groupedData}
              margin={{ top: 10, right: 0, left: -25, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                opacity={0.4}
              />
              <XAxis
                dataKey="hour"
                tickLine={false}
                axisLine={false}
                interval={0}
                tickFormatter={(val) => val.replace(':00', 'h')}
                tickMargin={8}
                fontSize={12}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                fontSize={12}
                width={40}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel={false} />}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Mensagens">
                {groupedData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.hour === peakHour?.hour
                        ? "hsl(var(--chart-1))"
                        : "hsl(var(--chart-1) / 0.4)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
