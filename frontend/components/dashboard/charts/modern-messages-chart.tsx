"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, TrendingUp } from "lucide-react";

interface MessagesOverTimeData {
  date: string;
  inbound: number;
  outbound: number;
  aiResponses: number;
}

interface ModernMessagesChartProps {
  data: MessagesOverTimeData[];
}

export function ModernMessagesChart({ data }: ModernMessagesChartProps) {
  console.log('[ModernMessagesChart] Received data:', data);

  const formattedData = data.map((item) => ({
    ...item,
    dateLabel: format(new Date(item.date), "dd/MM", { locale: ptBR }),
    total: item.inbound + item.outbound,
  }));

  console.log('[ModernMessagesChart] Formatted data:', formattedData);

  const totalMessages = formattedData.reduce((acc, curr) => acc + curr.total, 0);
  const avgDaily = Math.round(totalMessages / formattedData.length);

  console.log('[ModernMessagesChart] Total messages:', totalMessages, 'Average daily:', avgDaily);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Gráfico de Mensagens
            </h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Histórico de interações
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm font-medium">+12.5%</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {avgDaily} msg/dia
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={formattedData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorOutbound" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorAI" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
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
          />
          <Legend
            wrapperStyle={{ paddingTop: "20px" }}
            iconType="circle"
            iconSize={8}
          />
          <Area
            type="monotone"
            dataKey="inbound"
            stroke="#3B82F6"
            strokeWidth={2}
            fill="url(#colorInbound)"
            name="Recebidas"
          />
          <Area
            type="monotone"
            dataKey="outbound"
            stroke="#10B981"
            strokeWidth={2}
            fill="url(#colorOutbound)"
            name="Enviadas"
          />
          <Area
            type="monotone"
            dataKey="aiResponses"
            stroke="#8B5CF6"
            strokeWidth={2}
            fill="url(#colorAI)"
            name="Atendimento Automático"
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="h-2 w-2 rounded-full bg-blue-500"></div>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Recebidas
            </span>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {formattedData.reduce((acc, curr) => acc + curr.inbound, 0)}
          </p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Enviadas
            </span>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {formattedData.reduce((acc, curr) => acc + curr.outbound, 0)}
          </p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="h-2 w-2 rounded-full bg-purple-500"></div>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              IA
            </span>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {formattedData.reduce((acc, curr) => acc + curr.aiResponses, 0)}
          </p>
        </div>
      </div>
    </div>
  );
}
