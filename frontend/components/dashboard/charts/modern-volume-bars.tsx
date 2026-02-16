"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3, TrendingUp } from "lucide-react";

interface MessagesOverTimeData {
  date: string;
  inbound: number;
  outbound: number;
  aiResponses: number;
}

interface ModernVolumeBarsProps {
  data: MessagesOverTimeData[];
}

export function ModernVolumeBars({ data }: ModernVolumeBarsProps) {
  const formattedData = data.map((item) => ({
    ...item,
    dateLabel: format(new Date(item.date), "EEE dd", { locale: ptBR }),
    total: item.inbound + item.outbound,
  }));

  const maxValue = Math.max(...formattedData.map((d) => d.total));
  const avgValue = Math.round(
    formattedData.reduce((acc, curr) => acc + curr.total, 0) / formattedData.length
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Volume Diário
            </h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total de mensagens por dia
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm font-medium">Pico: {maxValue}</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Média: {avgValue}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={formattedData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
          <XAxis
            dataKey="dateLabel"
            stroke="#9CA3AF"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#9CA3AF"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              border: "1px solid #E5E7EB",
              borderRadius: "12px",
              padding: "12px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            }}
            cursor={{ fill: "rgba(59, 130, 246, 0.1)" }}
          />
          <Bar
            dataKey="total"
            fill="url(#barGradient)"
            radius={[8, 8, 0, 0]}
            maxBarSize={60}
            name="Total de Mensagens"
          />
        </BarChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <div className="h-4 w-4 bg-green-500 rounded"></div>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Dia mais ativo</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {formattedData.find((d) => d.total === maxValue)?.dateLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <div className="h-4 w-4 bg-blue-500 rounded"></div>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total período</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {formattedData.reduce((acc, curr) => acc + curr.total, 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
