import { Customer } from './customer';

export interface PipelineStage {
  id: string;
  companyId: string;
  name: string;
  description?: string | null;
  color: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface StageWithCustomers {
  stage: PipelineStage;
  customers: Customer[];
}

export interface PipelineBoard {
  stages: StageWithCustomers[];
  customersWithoutStage: Customer[];
}

export interface CreateStageData {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateStageData {
  name?: string;
  description?: string;
  color?: string;
  order?: number;
}

export interface MoveCustomerData {
  stageId: string | null;
}

export interface ReorderStagesData {
  stageIds: string[];
}
