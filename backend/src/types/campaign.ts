import { CampaignStatus as PrismaCampaignStatus, CampaignType as PrismaCampaignType } from '@prisma/client';

export enum CampaignType {
  MANUAL = 'MANUAL',
  SCHEDULED = 'SCHEDULED',
}

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
}

export interface Campaign {
  id: string;
  companyId: string;
  name: string;
  messageTemplate: string;
  targetTags: string[];
  type: CampaignType;
  status: CampaignStatus;
  scheduledAt?: Date;
  sentCount: number;
  failedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCampaignDTO {
  companyId: string;
  name: string;
  messageTemplate: string;
  targetTags: string[];
  type: PrismaCampaignType;
  scheduledAt?: Date;
}

export interface UpdateCampaignDTO {
  name?: string;
  messageTemplate?: string;
  targetTags?: string[];
  type?: PrismaCampaignType;
  scheduledAt?: Date;
  status?: PrismaCampaignStatus;
  sentCount?: number;
  failedCount?: number;
}

export interface CampaignEstimate {
  totalCustomers: number;
  estimatedDuration: number; // em segundos
}

export interface CampaignResult {
  campaignId: string;
  totalSent: number;
  totalFailed: number;
  duration: number; // em milissegundos
}
