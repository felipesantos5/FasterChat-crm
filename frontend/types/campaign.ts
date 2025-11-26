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
  scheduledAt?: string;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignRequest {
  companyId: string;
  name: string;
  messageTemplate: string;
  targetTags: string[];
  type: CampaignType;
  scheduledAt?: string;
}

export interface UpdateCampaignRequest {
  name?: string;
  messageTemplate?: string;
  targetTags?: string[];
  type?: CampaignType;
  scheduledAt?: string;
  status?: CampaignStatus;
}

export interface CampaignEstimate {
  totalCustomers: number;
  estimatedDuration: number;
}

export interface CampaignListResponse {
  campaigns: Campaign[];
  total: number;
  limit: number;
  offset: number;
}
