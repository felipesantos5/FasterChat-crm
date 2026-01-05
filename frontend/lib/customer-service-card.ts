import { api } from "./api";
import {
  CustomerServiceCard,
  CreateCustomerServiceCardData,
  UpdateCustomerServiceCardData,
} from "@/types/customer-service-card";

export const customerServiceCardApi = {
  async getAll(customerId: string): Promise<CustomerServiceCard[]> {
    const response = await api.get<{ data: CustomerServiceCard[] }>(
      `/customers/${customerId}/service-cards`
    );
    return response.data.data;
  },

  async getById(customerId: string, cardId: string): Promise<CustomerServiceCard> {
    const response = await api.get<{ data: CustomerServiceCard }>(
      `/customers/${customerId}/service-cards/${cardId}`
    );
    return response.data.data;
  },

  async create(
    customerId: string,
    data: CreateCustomerServiceCardData
  ): Promise<CustomerServiceCard> {
    const response = await api.post<{ data: CustomerServiceCard }>(
      `/customers/${customerId}/service-cards`,
      data
    );
    return response.data.data;
  },

  async update(
    customerId: string,
    cardId: string,
    data: UpdateCustomerServiceCardData
  ): Promise<CustomerServiceCard> {
    const response = await api.put<{ data: CustomerServiceCard }>(
      `/customers/${customerId}/service-cards/${cardId}`,
      data
    );
    return response.data.data;
  },

  async delete(customerId: string, cardId: string): Promise<void> {
    await api.delete(`/customers/${customerId}/service-cards/${cardId}`);
  },
};
