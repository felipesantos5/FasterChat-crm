"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { MessagesOverTimeData } from "@/lib/dashboard"
import { MessageSquare } from "lucide-react"

interface MessagesChartProps {
  data: MessagesOverTimeData[]
}

const chartConfig = {
  inbound: {
    label: "Recebidas",
    color: "hsl(var(--chart-1))",
  },
  outbound: {
    label: "Enviadas",
    color: "hsl(var(--chart-2))",
  },
  aiResponses: {
    label: "IA",
    color: "hsl(var(--chart-3))",
  },
}

export function MessagesChart({ data }: MessagesChartProps) {
  const formattedData = data.map(item => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
  }))

  const totalInbound = data.reduce((sum, item) => sum + item.inbound, 0)
  const totalOutbound = data.reduce((sum, item) => sum + item.outbound, 0)
  const totalAI = data.reduce((sum, item) => sum + item.aiResponses, 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600" />
            Mensagens ao Longo do Tempo
          </CardTitle>
          <CardDescription>
            Volume de mensagens recebidas, enviadas e respondidas pela IA
          </CardDescription>
        </div>
        <div className="flex gap-4 text-center">
          <div>
            <p className="text-lg font-bold text-[hsl(var(--chart-1))]">{totalInbound}</p>
            <p className="text-xs text-muted-foreground">Recebidas</p>
          </div>
          <div>
            <p className="text-lg font-bold text-[hsl(var(--chart-2))]">{totalOutbound}</p>
            <p className="text-xs text-muted-foreground">Enviadas</p>
          </div>
          <div>
            <p className="text-lg font-bold text-[hsl(var(--chart-3))]">{totalAI}</p>
            <p className="text-xs text-muted-foreground">IA</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={formattedData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorOutbound" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorAI" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                tickMargin={8}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                type="monotone"
                dataKey="inbound"
                stroke="hsl(var(--chart-1))"
                fillOpacity={1}
                fill="url(#colorInbound)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="outbound"
                stroke="hsl(var(--chart-2))"
                fillOpacity={1}
                fill="url(#colorOutbound)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="aiResponses"
                stroke="hsl(var(--chart-3))"
                fillOpacity={1}
                fill="url(#colorAI)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
