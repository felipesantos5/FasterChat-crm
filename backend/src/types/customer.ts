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
  orderBy?: "recent" | "old" | "az" | "za";
  type?: "all" | "individual" | "group";
}
