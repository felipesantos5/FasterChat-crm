import { z } from 'zod';

const permissionSchema = z.object({
  page: z.enum([
    'DASHBOARD',
    'CUSTOMERS',
    'CONVERSATIONS',
    'PIPELINE',
    'CALENDAR',
    'CAMPAIGNS',
    'WHATSAPP_LINKS',
    'AI_CONFIG',
    'WHATSAPP_CONFIG',
  ]),
  canView: z.boolean(),
  canEdit: z.boolean(),
});

export const inviteCollaboratorSchema = z.object({
  email: z.string().email('Email inválido'),
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  cargo: z.string().optional(),
  permissions: z.array(permissionSchema).min(1, 'Selecione ao menos uma permissão'),
});

export const acceptInviteSchema = z.object({
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export const updatePermissionsSchema = z.object({
  permissions: z.array(permissionSchema).min(1, 'Selecione ao menos uma permissão'),
});

export const validateInviteCollaborator = (data: unknown) => {
  return inviteCollaboratorSchema.parse(data);
};

export const validateAcceptInvite = (data: unknown) => {
  return acceptInviteSchema.parse(data);
};

export const validateUpdatePermissions = (data: unknown) => {
  return updatePermissionsSchema.parse(data);
};
