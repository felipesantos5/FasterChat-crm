"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { AppointmentsOverTimeData } from "@/lib/dashboard"
import { Calendar } from "lucide-react"

interface AppointmentsChartProps {
  data: AppointmentsOverTimeData[]
}

const chartConfig = {
  scheduled: {
    label: "Agendado",
    color: "#3B82F6",
  },
  confirmed: {
    label: "Confirmado",
    color: "#8B5CF6",
  },
  completed: {
    label: "Concluído",
    color: "#22C55E",
  },
  cancelled: {
    label: "Cancelado",
    color: "#EF4444",
  },
}

export function AppointmentsChart({ data }: AppointmentsChartProps) {
  const formattedData = data.map(item => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
  }))

  const totals = data.reduce((acc, item) => ({
    scheduled: acc.scheduled + item.scheduled,
    confirmed: acc.confirmed + item.confirmed,
    completed: acc.completed + item.completed,
    cancelled: acc.cancelled + item.cancelled,
  }), { scheduled: 0, confirmed: 0, completed: 0, cancelled: 0 })

  const total = totals.scheduled + totals.confirmed + totals.completed + totals.cancelled

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-green-600" />
            Agendamentos ao Longo do Tempo
          </CardTitle>
          <CardDescription>
            Status dos agendamentos por período
          </CardDescription>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{total}</p>
          <p className="text-xs text-muted-foreground">Total de agendamentos</p>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={formattedData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
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
              <Bar
                dataKey="completed"
                stackId="a"
                fill="#22C55E"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="confirmed"
                stackId="a"
                fill="#8B5CF6"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="scheduled"
                stackId="a"
                fill="#3B82F6"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="cancelled"
                stackId="a"
                fill="#EF4444"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
