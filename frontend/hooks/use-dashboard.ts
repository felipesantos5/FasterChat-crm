import useSWR from 'swr'
import { dashboardApi, TeamPerformanceData } from '@/lib/dashboard'
import { pipelineApi, DealValueStats } from '@/lib/pipeline'
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

export function useTeamPerformance(preset: DateRangePreset = '7days', customRange?: DateRange) {
  const cacheKey = preset === 'custom' && customRange
    ? `/dashboard/team-performance/${preset}/${customRange.from.toISOString()}/${customRange.to.toISOString()}`
    : `/dashboard/team-performance/${preset}`;

  const { data, error, isLoading } = useSWR<TeamPerformanceData>(
    cacheKey,
    () => dashboardApi.getTeamPerformance(preset, customRange),
    { dedupingInterval: 60000, refreshInterval: 120000 }
  );

  return { teamData: data, isLoading, isError: error };
}

export function useDealValueStats(preset: DateRangePreset = '30days', customRange?: DateRange) {
  const cacheKey = preset === 'custom' && customRange
    ? `/pipeline/deal-values/stats/${preset}/${customRange.from.toISOString()}/${customRange.to.toISOString()}`
    : `/pipeline/deal-values/stats/${preset}`;

  const { data, error, isLoading, mutate } = useSWR<DealValueStats>(
    cacheKey,
    () => pipelineApi.getDealValueStats(preset, customRange),
    {
      dedupingInterval: 30000,
      refreshInterval: 120000,
    }
  );

  return {
    dealStats: data,
    isLoading,
    isError: error,
    mutate,
  };
}
