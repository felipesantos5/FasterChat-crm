import { api } from './api';

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

export interface InviteCollaboratorData {
  email: string;
  name: string;
  cargo?: string;
  permissions: Permission[];
}

export const collaboratorApi = {
  async invite(data: InviteCollaboratorData): Promise<void> {
    await api.post('/collaborators', data);
  },

  async list(): Promise<{ users: Collaborator[]; pendingInvites: PendingInvite[] }> {
    const response = await api.get<{ data: { users: Collaborator[]; pendingInvites: PendingInvite[] } }>('/collaborators');
    return response.data.data;
  },

  async updatePermissions(id: string, permissions: Permission[]): Promise<void> {
    await api.put(`/collaborators/${id}/permissions`, { permissions });
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/collaborators/${id}`);
  },

  async cancelInvite(id: string): Promise<void> {
    await api.delete(`/collaborators/invites/${id}`);
  },

  async acceptInvite(token: string, password: string): Promise<{ user: any; token: string }> {
    const response = await api.post(`/collaborators/accept/${token}`, { password });
    return response.data.data;
  },

  async getMyPermissions(): Promise<Permission[]> {
    const response = await api.get<{ data: Permission[] }>('/collaborators/me/permissions');
    return response.data.data;
  },
};
