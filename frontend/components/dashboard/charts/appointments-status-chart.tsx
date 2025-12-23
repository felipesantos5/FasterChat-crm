"use client"

import { Pie, PieChart, Cell, ResponsiveContainer, Label } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { AppointmentsByStatusData } from "@/lib/dashboard"
import { PieChartIcon } from "lucide-react"

interface AppointmentsStatusChartProps {
  data: AppointmentsByStatusData[]
}

export function AppointmentsStatusChart({ data }: AppointmentsStatusChartProps) {
  const chartConfig = data.reduce((acc, item) => {
    acc[item.status] = {
      label: item.label,
      color: item.color,
    }
    return acc
  }, {} as Record<string, { label: string; color: string }>)

  const total = data.reduce((sum, item) => sum + item.count, 0)
  const dataWithLabels = data.map(item => ({
    ...item,
    name: item.label,
    value: item.count,
  }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <PieChartIcon className="h-4 w-4 text-green-600" />
          Agendamentos por Status
        </CardTitle>
        <CardDescription>
          Distribuição dos últimos 30 dias
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={dataWithLabels}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
              >
                {dataWithLabels.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
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
                            {total}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 24}
                            className="fill-muted-foreground text-sm"
                          >
                            Total
                          </tspan>
                        </text>
                      )
                    }
                    return null
                  }}
                />
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
