import { api } from './api';

export interface IntentScriptData {
  id: string;
  label: string;
  triggers: string[];
  requiredData: string[];
  enabled: boolean;
  customTriggers: string[];
  customInstructions: string;
}

export interface UpdateIntentScriptsRequest {
  scripts: Array<{
    id: string;
    enabled: boolean;
    customTriggers: string[];
    customInstructions: string;
  }>;
}

export const intentScriptsApi = {
  /**
   * Lista todos os scripts disponíveis com configurações da empresa
   */
  async listScripts(): Promise<{ success: boolean; data: IntentScriptData[] }> {
    const response = await api.get('/ai/intent-scripts');
    return response.data;
  },

  /**
   * Salva configurações dos scripts
   */
  async updateScripts(data: UpdateIntentScriptsRequest): Promise<{ success: boolean; message: string }> {
    const response = await api.put('/ai/intent-scripts', data);
    return response.data;
  },
};
