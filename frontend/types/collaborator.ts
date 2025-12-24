export interface Permission {
  page: string;
  canView: boolean;
  canEdit: boolean;
}

export interface Collaborator {
  id: string;
  email: string;
  name: string;
  cargo?: string;
  role: string;
  status: string;
  createdAt: string;
  permissions: Permission[];
}

export interface PendingInvite {
  id: string;
  email: string;
  name: string;
  cargo?: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  permissions: Permission[];
  invitedBy: { name: string };
}

export const PERMISSION_PAGES = [
  { value: 'DASHBOARD', label: 'Dashboard' },
  { value: 'CUSTOMERS', label: 'Clientes' },
  { value: 'CONVERSATIONS', label: 'Conversas' },
  { value: 'PIPELINE', label: 'Funil' },
  { value: 'CALENDAR', label: 'Calendário' },
  { value: 'CAMPAIGNS', label: 'Campanhas' },
  { value: 'WHATSAPP_LINKS', label: 'Links WhatsApp' },
  { value: 'AI_CONFIG', label: 'Config IA' },
  { value: 'WHATSAPP_CONFIG', label: 'Config WhatsApp' },
] as const;
