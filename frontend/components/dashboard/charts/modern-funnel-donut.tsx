"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

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
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#14B8A6", // teal
];

export function ModernFunnelDonut({ data }: ModernFunnelDonutProps) {
  // Filtra apenas estágios com contagem > 0
  const filteredData = data.filter((item) => item.count > 0);

  const chartData = filteredData.map((item, index) => ({
    name: item.stageName,
    value: item.count,
    color: COLORS[index % COLORS.length],
  }));

  const total = chartData.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700 h-full w-full">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            {/* <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
              <Filter className="h-5 w-5 text-white" />
            </div> */}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Funil de Vendas
            </h3>
          </div>
          {/* <p className="text-sm text-gray-500 dark:text-gray-400">
            Distribuição por estágio
          </p> */}
        </div>
      </div>

      <div className="relative">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  className="stroke-white dark:stroke-gray-800"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                border: "1px solid #E5E7EB",
                borderRadius: "12px",
                padding: "8px 12px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Label central customizado */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {total}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Total
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 mt-6">
        {chartData.map((item, index) => {
          const percentage = ((item.value / total) * 100).toFixed(1);
          return (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                ></div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {item.value}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right">
                  {percentage}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
