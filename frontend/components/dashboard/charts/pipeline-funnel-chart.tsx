"use client"

import { Bar, BarChart, XAxis, YAxis, Cell, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { PipelineFunnelData } from "@/lib/dashboard"
import { Users } from "lucide-react"

interface PipelineFunnelChartProps {
  data: PipelineFunnelData[]
}

export function PipelineFunnelChart({ data }: PipelineFunnelChartProps) {
  const chartConfig = data.reduce((acc, item) => {
    acc[item.stageName] = {
      label: item.stageName,
      color: item.stageColor,
    }
    return acc
  }, {} as Record<string, { label: string; color: string }>)

  const totalCustomers = data.reduce((sum, item) => sum + item.count, 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-600" />
            Funil de Clientes
          </CardTitle>
          <CardDescription>
            Distribuição por estágio do pipeline
          </CardDescription>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{totalCustomers}</p>
          <p className="text-xs text-muted-foreground">Total de clientes</p>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="stageName"
                width={100}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip
                cursor={{ fill: 'rgba(0, 0, 0, 0.1)' }}
                content={<ChartTooltipContent />}
              />
              <Bar
                dataKey="count"
                radius={[0, 4, 4, 0]}
                barSize={24}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.stageColor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
