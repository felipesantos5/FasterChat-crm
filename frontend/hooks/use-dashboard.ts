import useSWR from 'swr'
import { dashboardApi } from '@/lib/dashboard'

export function useDashboardStats(period: 'today' | 'week' | 'month' = 'week') {
  const { data, error, isLoading, mutate } = useSWR(
    `/dashboard/stats/${period}`,
    () => dashboardApi.getStats(period),
    {
      dedupingInterval: 30000,
      refreshInterval: 60000,
    }
  )

  return {
    stats: data,
    isLoading,
    isError: error,
    mutate,
  }
}

export function useDashboardCharts(period: 'week' | 'month' | 'quarter' = 'month') {
  const { data, error, isLoading, mutate } = useSWR(
    `/dashboard/charts/${period}`,
    () => dashboardApi.getChartsData(period),
    {
      dedupingInterval: 30000,
      refreshInterval: 120000,
    }
  )

  return {
    chartsData: data,
    isLoading,
    isError: error,
    mutate,
  }
}
