import { z } from 'zod';

const phoneRegex = /^\+?[1-9]\d{1,14}$/;

export const createCustomerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  phone: z.string().regex(phoneRegex, 'Telefone inválido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  tags: z.array(z.string()).optional().default([]),
  notes: z.string().optional(),
});

export const updateCustomerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').optional(),
  phone: z.string().regex(phoneRegex, 'Telefone inválido').optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const customerFiltersSchema = z.object({
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
});

export const validateCreateCustomer = (data: unknown) => {
  return createCustomerSchema.parse(data);
};

export const validateUpdateCustomer = (data: unknown) => {
  return updateCustomerSchema.parse(data);
};

export const validateCustomerFilters = (data: unknown) => {
  return customerFiltersSchema.parse(data);
};
