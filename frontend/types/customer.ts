export interface Customer {
  id: string;
  companyId: string;
  name: string;
  phone: string;
  email?: string | null;
  tags: string[];
  notes?: string | null;
  profilePicUrl?: string | null; // URL da foto de perfil do WhatsApp
  isGroup: boolean; // Identifica se é um grupo do WhatsApp
  pipelineStageId?: string | null; // Estágio atual no pipeline
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerData {
  name: string;
  phone: string;
  email?: string;
  tags?: string[];
  notes?: string;
}

export interface UpdateCustomerData {
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

export interface CustomerListResponse {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
}

export interface CustomerStats {
  total: number;
  thisMonth: number;
  tags: Array<{ tag: string; count: number }>;
}
