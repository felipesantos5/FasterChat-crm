"use client"

import { Pie, PieChart, Cell, ResponsiveContainer, Label } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { CustomerActivityData } from "@/lib/dashboard"
import { Activity } from "lucide-react"

interface CustomerActivityChartProps {
  data: CustomerActivityData
}

const chartConfig = {
  active: {
    label: "Ativos",
    color: "#22C55E",
  },
  inactive: {
    label: "Inativos",
    color: "#9CA3AF",
  },
}

export function CustomerActivityChart({ data }: CustomerActivityChartProps) {
  const chartData = [
    { name: "Ativos", value: data.active, fill: "#22C55E" },
    { name: "Inativos", value: data.inactive, fill: "#9CA3AF" },
  ]

  const activePercentage = data.total > 0
    ? Math.round((data.active / data.total) * 100)
    : 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Activity className="h-4 w-4 text-green-600" />
          Atividade de Clientes
        </CardTitle>
        <CardDescription>
          Clientes com interação nos últimos 30 dias
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
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                startAngle={90}
                endAngle={-270}
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
                            {activePercentage}%
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 24}
                            className="fill-muted-foreground text-sm"
                          >
                            Ativos
                          </tspan>
                        </text>
                      )
                    }
                    return null
                  }}
                />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
        <div className="flex justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm text-muted-foreground">
              Ativos: <span className="font-medium text-foreground">{data.active}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-400" />
            <span className="text-sm text-muted-foreground">
              Inativos: <span className="font-medium text-foreground">{data.inactive}</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
