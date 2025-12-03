import { Customer } from './customer';

export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export enum AppointmentType {
  VISIT = 'VISIT',
  INSTALLATION = 'INSTALLATION',
  MAINTENANCE = 'MAINTENANCE',
  CONSULTATION = 'CONSULTATION',
  OTHER = 'OTHER',
}

export interface Appointment {
  id: string;
  companyId: string;
  customerId: string;
  title: string;
  description?: string | null;
  type: AppointmentType;
  status: AppointmentStatus;
  startTime: string;
  endTime: string;
  duration: number; // Duração em minutos
  location?: string | null;
  googleEventId?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: Customer;
}

export interface CreateAppointmentData {
  customerId: string;
  title: string;
  description?: string;
  type: AppointmentType;
  startTime: string;
  endTime: string;
  duration: number; // Duração em minutos
  location?: string;
  notes?: string;
}

export interface UpdateAppointmentData {
  title?: string;
  description?: string;
  type?: AppointmentType;
  status?: AppointmentStatus;
  startTime?: string;
  endTime?: string;
  duration?: number; // Duração em minutos
  location?: string;
  notes?: string;
}

export interface AppointmentFilters {
  customerId?: string;
  status?: AppointmentStatus;
  type?: AppointmentType;
  startDate?: string;
  endDate?: string;
}

export interface TimeSlot {
  start: Date;
  end: Date;
}

export const AppointmentStatusLabels: Record<AppointmentStatus, string> = {
  [AppointmentStatus.SCHEDULED]: 'Agendado',
  [AppointmentStatus.CONFIRMED]: 'Confirmado',
  [AppointmentStatus.COMPLETED]: 'Concluído',
  [AppointmentStatus.CANCELLED]: 'Cancelado',
  [AppointmentStatus.NO_SHOW]: 'Não Compareceu',
};

export const AppointmentTypeLabels: Record<AppointmentType, string> = {
  [AppointmentType.VISIT]: 'Visita',
  [AppointmentType.INSTALLATION]: 'Instalação',
  [AppointmentType.MAINTENANCE]: 'Manutenção',
  [AppointmentType.CONSULTATION]: 'Consulta',
  [AppointmentType.OTHER]: 'Outro',
};

export const AppointmentStatusColors: Record<AppointmentStatus, string> = {
  [AppointmentStatus.SCHEDULED]: 'bg-blue-500',
  [AppointmentStatus.CONFIRMED]: 'bg-green-500',
  [AppointmentStatus.COMPLETED]: 'bg-gray-500',
  [AppointmentStatus.CANCELLED]: 'bg-red-500',
  [AppointmentStatus.NO_SHOW]: 'bg-yellow-500',
};

export const AppointmentTypeColors: Record<AppointmentType, string> = {
  [AppointmentType.VISIT]: 'bg-purple-500',
  [AppointmentType.INSTALLATION]: 'bg-blue-500',
  [AppointmentType.MAINTENANCE]: 'bg-orange-500',
  [AppointmentType.CONSULTATION]: 'bg-green-500',
  [AppointmentType.OTHER]: 'bg-gray-500',
};
