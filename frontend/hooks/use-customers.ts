import useSWR from 'swr'
import { customerApi } from '@/lib/customer'
import type { Customer } from '@/types/customer'
import type { Tag } from '@/lib/tag'

export function useCustomers(companyId: string | null, filters?: {
  search?: string
  selectedTags?: string[]
}) {
  const searchParams = new URLSearchParams()
  if (filters?.search) searchParams.set('search', filters.search)
  if (filters?.selectedTags?.length) {
    searchParams.set('tags', filters.selectedTags.join(','))
  }

  const queryString = searchParams.toString()
  const key = companyId ? `/customers${queryString ? `?${queryString}` : ''}` : null

  const { data, error, isLoading, mutate } = useSWR<Customer[]>(
    key,
    async () => {
      const response = await customerApi.getAll({
        search: filters?.search,
        tags: filters?.selectedTags,
      })
      return response.customers
    },
    {
      keepPreviousData: true,
    }
  )

  return {
    customers: data || [],
    isLoading,
    isError: error,
    mutate,
  }
}

export function useCustomer(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Customer>(
    id ? `/customers/${id}` : null,
    () => customerApi.getById(id!),
  )

  return {
    customer: data,
    isLoading,
    isError: error,
    mutate,
  }
}

export function useCustomerTags(companyId: string | null) {
  const { data, error, isLoading } = useSWR<Tag[]>(
    companyId ? `/tags/all` : null,
    () => customerApi.getAllTags(),
    {
      dedupingInterval: 60000,
    }
  )

  return {
    tags: data || [],
    isLoading,
    isError: error,
  }
}
