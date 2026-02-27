"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AgentStatsData } from "@/lib/dashboard";

interface ModernAgentStatsCardProps {
  data: AgentStatsData[];
}

export function ModernAgentStatsCard({ data }: ModernAgentStatsCardProps) {
  const chartData = useMemo(() => {
    return data.slice(0, 5).map((agent) => ({
      name: agent.agentName.length > 10 ? agent.agentName.slice(0, 10) + "…" : agent.agentName,
      fullName: agent.agentName,
      humano: agent.humanCount,
      ia: agent.aiCount,
    }));
  }, [data]);

  return (
    <Card className="flex flex-col h-full shadow-lg border-gray-100 dark:border-gray-800">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/30">
            <Users className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </div>
          <CardTitle className="text-sm font-semibold">Atendimentos por Agente</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 px-4 pb-3">
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Sem dados de agentes
          </div>
        ) : (
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={60}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [value, name === "humano" ? "Humano" : "IA"]}
                  labelFormatter={(label: string, payload) => {
                    if (payload && payload.length > 0) {
                      return (payload[0].payload as { fullName: string }).fullName;
                    }
                    return label;
                  }}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--background))",
                    fontSize: "12px",
                  }}
                />
                <Legend
                  formatter={(value: string) => (
                    <span className="text-xs">{value === "humano" ? "Humano" : "IA"}</span>
                  )}
                />
                <Bar
                  dataKey="humano"
                  stackId="a"
                  fill="hsl(var(--chart-1))"
                  radius={[0, 0, 0, 0]}
                  barSize={20}
                />
                <Bar
                  dataKey="ia"
                  stackId="a"
                  fill="hsl(var(--chart-3))"
                  radius={[0, 4, 4, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
