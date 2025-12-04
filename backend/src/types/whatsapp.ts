import { WhatsAppStatus } from '@prisma/client';

export interface WhatsAppInstanceData {
  id: string;
  companyId: string;
  instanceName: string;
  apiKey?: string | null;
  qrCode?: string | null;
  status: WhatsAppStatus;
  phoneNumber?: string | null;
  connectedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInstanceRequest {
  companyId: string;
  instanceName?: string;
}

export interface SendMessageRequest {
  instanceId: string;
  to: string;
  text: string;
}

// Evolution API Types
export interface EvolutionApiCreateInstanceResponse {
  instance: {
    instanceName: string;
    status: string;
  };
  hash: {
    apikey: string;
  };
  qrcode?: {
    base64: string;
    code: string;
  };
}

export interface EvolutionApiQRCodeResponse {
  base64: string;
  code: string;
  pairingCode?: string;
}

export interface EvolutionApiConnectionStateResponse {
  instance: string;
  state: 'open' | 'connecting' | 'close';
}

export interface EvolutionApiSendMessageResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: {
    conversation: string;
  };
  messageTimestamp: string;
  status: string;
}
