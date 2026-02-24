"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Clock, TrendingUp } from "lucide-react";
import { HourlyMessageData } from "@/lib/dashboard";

interface ModernPeakHoursChartProps {
  data: HourlyMessageData[];
}

export function ModernPeakHoursChart({ data }: ModernPeakHoursChartProps) {
  // Encontra o horário de pico para destaque
  const peakHour = [...data].sort((a, b) => b.count - a.count)[0];
  const totalMessages = data.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700 h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Pico de Mensagens
            </h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Horários com maior volume de recebimento
          </p>
        </div>
        {peakHour && peakHour.count > 0 && (
          <div className="text-right">
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 justify-end">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">{peakHour.hour}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Horário de maior fluxo
            </p>
          </div>
        )}
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
            <XAxis
              dataKey="hour"
              stroke="#9CA3AF"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              interval={2} // Mostra as horas de 3 em 3 para não poluir (0, 3, 6, ...)
            />
            <YAxis
              stroke="#9CA3AF"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(229, 231, 235, 0.4)' }}
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                border: "1px solid #E5E7EB",
                borderRadius: "12px",
                padding: "12px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
              labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
            />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              name="Mensagens"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.hour === peakHour?.hour ? "#10B981" : "#34D399"}
                  fillOpacity={entry.hour === peakHour?.hour ? 1 : 0.7}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">Total no período</span>
          <span className="text-lg font-bold text-gray-900 dark:text-white">{totalMessages} msg</span>
        </div>
      </div>
    </div>
  );
}
