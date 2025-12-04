import { api } from "./api";
import { Customer, CreateCustomerData, UpdateCustomerData, CustomerFilters, CustomerListResponse, CustomerStats } from "@/types/customer";
import { tagApi, Tag } from "./tag";

export const customerApi = {
  async getAll(filters?: CustomerFilters): Promise<CustomerListResponse> {
    const response = await api.get<{ data: CustomerListResponse }>("/customers", {
      params: filters,
    });
    return response.data.data;
  },

  async getById(id: string): Promise<Customer> {
    const response = await api.get<{ data: Customer }>(`/customers/${id}`);
    return response.data.data;
  },

  async create(data: CreateCustomerData): Promise<Customer> {
    const response = await api.post<{ data: Customer }>("/customers", data);
    return response.data.data;
  },

  async update(id: string, data: UpdateCustomerData): Promise<Customer> {
    const response = await api.put<{ data: Customer }>(`/customers/${id}`, data);
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/customers/${id}`);
  },

  async getStats(): Promise<CustomerStats> {
    const response = await api.get<{ data: CustomerStats }>("/customers/stats");
    return response.data.data;
  },

  async getAllTags(): Promise<Tag[]> {
    // Usa a API de tags para buscar tags completas com cores
    return tagApi.getAll();
  },

  async import(data: CreateCustomerData[]): Promise<{ success: number; failed: number; errors: any[] }> {
    const response = await api.post("/customers/import", data);
    return response.data.data;
  },
};
