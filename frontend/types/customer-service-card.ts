export interface CustomerServiceCard {
  id: string;
  customerId: string;
  title: string;
  description: string;
  serviceDate: string;
  rating?: number | null; // 1-5 estrelas
  price?: number | null;
  status: ServiceCardStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type ServiceCardStatus = "completed" | "in_progress" | "scheduled" | "cancelled";

export interface CreateCustomerServiceCardData {
  title: string;
  description: string;
  serviceDate: string;
  rating?: number;
  price?: number;
  status: ServiceCardStatus;
  tags?: string[];
}

export interface UpdateCustomerServiceCardData {
  title?: string;
  description?: string;
  serviceDate?: string;
  rating?: number;
  price?: number;
  status?: ServiceCardStatus;
  tags?: string[];
}

export const SERVICE_CARD_STATUS_LABELS: Record<ServiceCardStatus, string> = {
  completed: "Concluído",
  in_progress: "Em Andamento",
  scheduled: "Agendado",
  cancelled: "Cancelado",
};

export const SERVICE_CARD_STATUS_COLORS: Record<ServiceCardStatus, string> = {
  completed: "bg-green-100 text-green-800",
  in_progress: "bg-blue-100 text-blue-800",
  scheduled: "bg-yellow-100 text-yellow-800",
  cancelled: "bg-red-100 text-red-800",
};
