export enum WhatsAppStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
}

export interface WhatsAppInstance {
  id: string;
  companyId: string;
  instanceName: string; // Nome técnico usado pela Evolution API
  displayName?: string | null; // Nome amigável definido pelo usuário
  apiKey?: string | null;
  qrCode?: string | null;
  status: WhatsAppStatus;
  phoneNumber?: string | null;
  connectedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInstanceResponse {
  success: boolean;
  data: WhatsAppInstance;
}

export interface QRCodeResponse {
  success: boolean;
  data: {
    qrCode: string;
    status: WhatsAppStatus;
  };
}

export interface StatusResponse {
  success: boolean;
  data: {
    status: WhatsAppStatus;
    phoneNumber?: string | null;
    instanceName: string;
  };
}

export interface SendMessageRequest {
  instanceId: string;
  to: string;
  text: string;
}

export interface SendMessageResponse {
  success: boolean;
  data: {
    success: boolean;
    messageId: string;
    timestamp: string;
  };
}

export interface GetInstancesResponse {
  success: boolean;
  data: WhatsAppInstance[];
}
