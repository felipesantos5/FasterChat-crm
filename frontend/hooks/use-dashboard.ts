import useSWR from 'swr'
import { dashboardApi } from '@/lib/dashboard'
import { DateRangePreset, DateRange } from '@/components/dashboard/date-range-filter'

export function useDashboardStats(preset: DateRangePreset = '7days', customRange?: DateRange) {
  const cacheKey = preset === 'custom' && customRange
    ? `/dashboard/stats/${preset}/${customRange.from.toISOString()}/${customRange.to.toISOString()}`
    : `/dashboard/stats/${preset}`;

  const { data, error, isLoading, mutate } = useSWR(
    cacheKey,
    () => dashboardApi.getStats(preset, customRange),
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

export function useDashboardCharts(preset: DateRangePreset = '30days', customRange?: DateRange) {
  const cacheKey = preset === 'custom' && customRange
    ? `/dashboard/charts/${preset}/${customRange.from.toISOString()}/${customRange.to.toISOString()}`
    : `/dashboard/charts/${preset}`;

  const { data, error, isLoading, mutate } = useSWR(
    cacheKey,
    () => dashboardApi.getChartsData(preset, customRange),
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
