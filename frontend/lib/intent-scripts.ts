import { api } from './api';

export interface IntentScriptPhase {
  id: string;
  title: string;
  icon: string;
  description: string;
  type: 'trigger' | 'question' | 'action' | 'output';
}

export interface IntentScriptData {
  id: string;
  label: string;
  enabled: boolean;
  triggers: string[];
  customTriggers: string[];
  requiredData: string[];
  phases: IntentScriptPhase[];
  customInstructions: string;
}

export interface CreateIntentScriptRequest {
  label: string;
  triggers: string[];
  requiredData: string[];
  phases: IntentScriptPhase[];
  customInstructions?: string;
}

export interface UpdateIntentScriptRequest {
  label?: string;
  enabled?: boolean;
  triggers?: string[];
  customTriggers?: string[];
  requiredData?: string[];
  phases?: IntentScriptPhase[];
  customInstructions?: string;
}

export const intentScriptsApi = {
  /**
   * Lista todos os scripts da empresa
   */
  async listScripts(): Promise<{ success: boolean; data: IntentScriptData[] }> {
    const response = await api.get('/ai/intent-scripts');
    return response.data;
  },

  /**
   * Cria um novo script
   */
  async createScript(data: CreateIntentScriptRequest): Promise<{ success: boolean; data: IntentScriptData }> {
    const response = await api.post('/ai/intent-scripts', data);
    return response.data;
  },

  /**
   * Atualiza um script específico
   */
  async updateScript(id: string, data: UpdateIntentScriptRequest): Promise<{ success: boolean; data: IntentScriptData }> {
    const response = await api.put(`/ai/intent-scripts/${id}`, data);
    return response.data;
  },

  /**
   * Remove um script
   */
  async deleteScript(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/ai/intent-scripts/${id}`);
    return response.data;
  },
};
