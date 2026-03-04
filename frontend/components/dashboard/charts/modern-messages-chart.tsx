"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDownLeft, ArrowUpRight, MessageSquare, Calendar } from "lucide-react";

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
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";

interface MessagesOverTimeData {
  date: string;
  inbound: number;
  outbound: number;
  aiResponses: number;
}

interface ModernMessagesChartProps {
  data: MessagesOverTimeData[];
}

const chartConfig = {
  inbound: {
    label: "Recebidas",
    color: "#44ba6c", // brand base
  },
  outbound: {
    label: "Enviadas",
    color: "#1a6b38", // brand dark
  },
  aiResponses: {
    label: "IA",
    color: "#7dd0a0", // brand light
  },
} satisfies ChartConfig;

export function ModernMessagesChart({ data }: ModernMessagesChartProps) {
  const formattedData = data.map((item) => {
    const [y, m, d] = item.date.split("-").map(Number);
    return {
      ...item,
      dateLabel: format(new Date(y, m - 1, d), "d MMM", { locale: ptBR }),
      total: item.inbound + item.outbound,
    };
  });

  const miniStats = useMemo(() => {
    const totalInbound = data.reduce((acc, d) => acc + d.inbound, 0);
    const totalOutbound = data.reduce((acc, d) => acc + d.outbound, 0);
    const totalAI = data.reduce((acc, d) => acc + d.aiResponses, 0);
    const peakDay = data.length > 0
      ? data.reduce((max, d) => (d.inbound + d.outbound > max.inbound + max.outbound ? d : max), data[0])
      : null;
    let peakDayLabel = "";
    if (peakDay) {
      const [y, m, d] = peakDay.date.split("-").map(Number);
      peakDayLabel = format(new Date(y, m - 1, d), "d MMM", { locale: ptBR });
    }
    return { totalInbound, totalOutbound, totalAI, peakDayLabel, peakDayTotal: peakDay ? peakDay.inbound + peakDay.outbound : 0 };
  }, [data]);

  return (
    <Card className="flex flex-col h-full shadow-lg border-gray-100 dark:border-gray-800">
      <CardHeader className="items-start pb-2 pt-4 px-4">
        <CardTitle className="text-base">Visão Geral de Mensagens</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-0 px-4">
        <ChartContainer config={chartConfig} className="h-[270px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={formattedData}
              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="fillInbound" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-inbound)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-inbound)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillOutbound" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-outbound)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-outbound)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillAI" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-aiResponses)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-aiResponses)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.5} />
              <XAxis
                dataKey="dateLabel"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                fontSize={11}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}`}
                width={35}
                fontSize={11}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                type="monotone"
                dataKey="inbound"
                stackId="1"
                stroke="var(--color-inbound)"
                fill="url(#fillInbound)"
              />
              <Area
                type="monotone"
                dataKey="outbound"
                stackId="1"
                stroke="var(--color-outbound)"
                fill="url(#fillOutbound)"
              />
              <Area
                type="monotone"
                dataKey="aiResponses"
                stackId="1"
                stroke="var(--color-aiResponses)"
                fill="url(#fillAI)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Mini Stats Bar */}
        <div className="grid grid-cols-4 gap-2 py-3 border-t border-gray-100 dark:border-gray-800 mt-1">
          <div className="flex items-center gap-1.5">
            <ArrowDownLeft className="h-3.5 w-3.5 text-[#209849]" />
            <div>
              <p className="text-xs text-muted-foreground">Recebidas</p>
              <p className="text-sm font-semibold">{miniStats.totalInbound}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowUpRight className="h-3.5 w-3.5 text-[#14522b]" />
            <div>
              <p className="text-xs text-muted-foreground">Enviadas</p>
              <p className="text-sm font-semibold">{miniStats.totalOutbound}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-[#4ed479]" />
            <div>
              <p className="text-xs text-muted-foreground">Respostas IA</p>
              <p className="text-sm font-semibold">{miniStats.totalAI}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-gray-700 dark:text-gray-300" />
            <div>
              <p className="text-xs text-muted-foreground">Maior volume</p>
              <p className="text-sm font-semibold">{miniStats.peakDayLabel} ({miniStats.peakDayTotal})</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
