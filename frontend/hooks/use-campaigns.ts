import useSWR from 'swr'
import { campaignApi } from '@/lib/campaign'
import type { Campaign } from '@/types/campaign'

export function useCampaigns(companyId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Campaign[]>(
    companyId ? `/campaigns?companyId=${companyId}` : null,
    async () => {
      const response = await campaignApi.getAll(companyId!)
      return response.campaigns
    },
  )

  return {
    campaigns: data || [],
    isLoading,
    isError: error,
    mutate,
  }
}

export function useCampaign(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Campaign>(
    id ? `/campaigns/${id}` : null,
    () => campaignApi.getById(id!),
  )

  return {
    campaign: data,
    isLoading,
    isError: error,
    mutate,
  }
}
