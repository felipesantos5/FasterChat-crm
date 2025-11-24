export interface CreateCustomerDTO {
  name: string;
  phone: string;
  email?: string;
  tags?: string[];
  notes?: string;
}

export interface UpdateCustomerDTO {
  name?: string;
  phone?: string;
  email?: string;
  tags?: string[];
  notes?: string;
}

export interface CustomerFilters {
  search?: string;
  tags?: string[];
  page?: number;
  limit?: number;
}
