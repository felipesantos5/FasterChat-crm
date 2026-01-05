import { api } from "./api";
import {
  CustomerAddress,
  CreateCustomerAddressData,
  UpdateCustomerAddressData,
} from "@/types/customer-address";

export const customerAddressApi = {
  async getAll(customerId: string): Promise<CustomerAddress[]> {
    const response = await api.get<{ data: CustomerAddress[] }>(
      `/customers/${customerId}/addresses`
    );
    return response.data.data;
  },

  async getById(customerId: string, addressId: string): Promise<CustomerAddress> {
    const response = await api.get<{ data: CustomerAddress }>(
      `/customers/${customerId}/addresses/${addressId}`
    );
    return response.data.data;
  },

  async create(
    customerId: string,
    data: CreateCustomerAddressData
  ): Promise<CustomerAddress> {
    const response = await api.post<{ data: CustomerAddress }>(
      `/customers/${customerId}/addresses`,
      data
    );
    return response.data.data;
  },

  async update(
    customerId: string,
    addressId: string,
    data: UpdateCustomerAddressData
  ): Promise<CustomerAddress> {
    const response = await api.put<{ data: CustomerAddress }>(
      `/customers/${customerId}/addresses/${addressId}`,
      data
    );
    return response.data.data;
  },

  async delete(customerId: string, addressId: string): Promise<void> {
    await api.delete(`/customers/${customerId}/addresses/${addressId}`);
  },

  async setDefault(customerId: string, addressId: string): Promise<CustomerAddress> {
    const response = await api.patch<{ data: CustomerAddress }>(
      `/customers/${customerId}/addresses/${addressId}/default`
    );
    return response.data.data;
  },
};
