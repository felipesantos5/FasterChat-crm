export interface InviteCollaboratorDTO {
  email: string;
  name: string;
  cargo?: string;
  permissions: PermissionDTO[];
}

export interface PermissionDTO {
  page: string;
  canView: boolean;
  canEdit: boolean;
}

export interface AcceptInviteDTO {
  password: string;
}

export interface UpdatePermissionsDTO {
  permissions: PermissionDTO[];
}
