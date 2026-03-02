"use client";

import { PieChart, Pie, Label, Cell } from "recharts";
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

interface PipelineFunnelData {
  stageId: string;
  stageName: string;
  stageColor: string;
  count: number;
  order: number;
}

interface ModernFunnelDonutProps {
  data: PipelineFunnelData[];
}

const COLORS = [
  "#44ba6c", // brand (base)
  "#7dd0a0", // brand-300
  "#2d9a53", // brand-600
  "#1a6b38", // brand-700
  "#0f4524", // brand-900
  "#c5ecda", // brand-100
  "#44ba6c", // brand (repeat)
  "#2d9a53", // brand-600 (repeat)
];

export function ModernFunnelDonut({ data }: ModernFunnelDonutProps) {
  // Filtra apenas estágios com contagem > 0
  const filteredData = data.filter((item) => item.count > 0);

  const chartData = filteredData.map((item, index) => ({
    name: item.stageName,
    value: item.count,
    fill: COLORS[index % COLORS.length],
  }));

  const chartConfig = chartData.reduce((acc, curr, index) => {
    acc[`stage_${index}`] = {
      label: curr.name,
      color: curr.fill,
    };
    return acc;
  }, {} as ChartConfig);

  const total = chartData.reduce((acc, curr) => acc + curr.value, 0);
  const isEmpty = total === 0;

  return (
    <Card className="flex flex-col h-full shadow-lg border-gray-100 dark:border-gray-800">
      <CardHeader className="items-start pb-0 pt-4 px-4">
        <CardTitle className="text-base">Funil de Vendas</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-0 flex flex-col">

        {isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-6 px-4 text-center">
            {/* Funil ilustrativo */}
            <svg viewBox="0 0 120 130" className="w-28 h-28 opacity-30 dark:opacity-20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="8" y="8" width="104" height="20" rx="5" fill="currentColor" className="text-gray-400" />
              <rect x="20" y="34" width="80" height="20" rx="5" fill="currentColor" className="text-gray-400" />
              <rect x="34" y="60" width="52" height="20" rx="5" fill="currentColor" className="text-gray-400" />
              <rect x="46" y="86" width="28" height="20" rx="5" fill="currentColor" className="text-gray-400" />
              <rect x="52" y="110" width="16" height="14" rx="4" fill="currentColor" className="text-gray-400" />
            </svg>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Funil vazio
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed max-w-[180px]">
                Adicione clientes ao pipeline para visualizar as métricas do funil
              </p>
            </div>
          </div>
        ) : (
          <>
            <ChartContainer
              config={chartConfig}
              className="mx-auto h-[220px] w-full"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={80}
                  strokeWidth={2}
                  stroke="var(--background)"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text
                            x={viewBox.cx}
                            y={viewBox.cy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            <tspan
                              x={viewBox.cx}
                              y={viewBox.cy}
                              className="fill-foreground text-3xl font-bold"
                            >
                              {total.toLocaleString()}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 24}
                              className="fill-muted-foreground text-xs"
                            >
                              Total
                            </tspan>
                          </text>
                        );
                      }
                      return null;
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>

            <div className="space-y-2 mt-2 mb-3 px-1">
              {chartData.map((item, index) => {
                const percentage = ((item.value / total) * 100).toFixed(1);
                return (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.fill }}
                      ></div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[120px]">
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {item.value}
                      </span>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {percentage}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
