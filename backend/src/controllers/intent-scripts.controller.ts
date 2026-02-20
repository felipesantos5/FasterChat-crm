import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { IntentScriptPhase } from '../prompts/sections/intent-scripts';

/**
 * ============================================
 * INTENT SCRIPTS CONTROLLER v2
 * ============================================
 * Gerencia scripts de atendimento criados pelo usuário.
 * 
 * Cada empresa cria seus próprios scripts do zero.
 * Não há scripts padrão — a empresa define:
 *   - Label (nome do script)
 *   - Triggers (palavras que ativam o script)
 *   - RequiredData (dados a coletar)
 *   - Phases (fases do fluxo visual)
 *   - CustomInstructions (instruções extras para a IA)
 * 
 * Armazenamento: campo `intentScriptsConfig` no AIKnowledge (JSON)
 * 
 * Estrutura do JSON:
 * {
 *   "scriptId": {
 *     "id": "scriptId",
 *     "label": "Instalação de AR",
 *     "enabled": true,
 *     "triggers": ["instalar", "instalação"],
 *     "customTriggers": [],
 *     "requiredData": ["tipo_equipamento", "btus"],
 *     "phases": [{ id, title, icon, description, type }],
 *     "customInstructions": ""
 *   }
 * }
 */

interface IntentScriptData {
  id: string;
  label: string;
  enabled: boolean;
  triggers: string[];
  customTriggers: string[];
  requiredData: string[];
  phases: IntentScriptPhase[];
  customInstructions: string;
}

type IntentScriptsConfig = Record<string, IntentScriptData>;

class IntentScriptsController {
  /**
   * GET /api/ai/intent-scripts
   * Lista todos os scripts da empresa
   */
  async listScripts(req: Request, res: Response): Promise<void> {
    const companyId = req.user?.companyId;

    if (!companyId) {
      res.status(400).json({ success: false, message: 'Company not found' });
      return;
    }

    try {
      const aiKnowledge = await (prisma.aIKnowledge as any).findUnique({
        where: { companyId },
        select: { intentScriptsConfig: true },
      });

      let config: IntentScriptsConfig = {};
      const rawConfig = aiKnowledge?.intentScriptsConfig;
      if (rawConfig) {
        try {
          config = typeof rawConfig === 'string'
            ? JSON.parse(rawConfig)
            : (rawConfig as IntentScriptsConfig);
        } catch (e) {
          config = {};
        }
      }

      // Retorna array com todos os scripts (incluindo phases para o frontend)
      const scripts = Object.values(config).map((script) => ({
        id: script.id,
        label: script.label,
        enabled: script.enabled ?? false,
        triggers: script.triggers || [],
        customTriggers: script.customTriggers || [],
        requiredData: script.requiredData || [],
        phases: script.phases || [],
        customInstructions: script.customInstructions || '',
      }));

      res.json({ success: true, data: scripts });
    } catch (error: any) {
      console.error('[IntentScripts] Error listing scripts:', error.message);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * POST /api/ai/intent-scripts
   * Cria um novo script
   */
  async createScript(req: Request, res: Response): Promise<void> {
    const companyId = req.user?.companyId;

    if (!companyId) {
      res.status(400).json({ success: false, message: 'Company not found' });
      return;
    }

    const { label, triggers, requiredData, phases, customInstructions } = req.body as {
      label: string;
      triggers: string[];
      requiredData: string[];
      phases: IntentScriptPhase[];
      customInstructions?: string;
    };

    if (!label?.trim()) {
      res.status(400).json({ success: false, message: 'Label is required' });
      return;
    }

    try {
      // Gera um ID único para o script
      const scriptId = `script_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      const newScript: IntentScriptData = {
        id: scriptId,
        label: label.trim(),
        enabled: true,
        triggers: triggers || [],
        customTriggers: [],
        requiredData: requiredData || [],
        phases: phases || [],
        customInstructions: customInstructions || '',
      };

      // Busca config atual
      const aiKnowledge = await (prisma.aIKnowledge as any).findUnique({
        where: { companyId },
        select: { intentScriptsConfig: true },
      });

      let config: IntentScriptsConfig = {};
      if (aiKnowledge?.intentScriptsConfig) {
        try {
          config = typeof aiKnowledge.intentScriptsConfig === 'string'
            ? JSON.parse(aiKnowledge.intentScriptsConfig)
            : aiKnowledge.intentScriptsConfig;
        } catch (e) { config = {}; }
      }

      config[scriptId] = newScript;

      await (prisma.aIKnowledge as any).upsert({
        where: { companyId },
        create: { companyId, intentScriptsConfig: config },
        update: { intentScriptsConfig: config },
      });

      res.json({ success: true, data: newScript });
    } catch (error: any) {
      console.error('[IntentScripts] Error creating script:', error.message);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * PUT /api/ai/intent-scripts/:id
   * Atualiza um script existente
   */
  async updateScript(req: Request, res: Response): Promise<void> {
    const companyId = req.user?.companyId;
    const scriptId = req.params.id;

    if (!companyId) {
      res.status(400).json({ success: false, message: 'Company not found' });
      return;
    }

    try {
      const aiKnowledge = await (prisma.aIKnowledge as any).findUnique({
        where: { companyId },
        select: { intentScriptsConfig: true },
      });

      let config: IntentScriptsConfig = {};
      if (aiKnowledge?.intentScriptsConfig) {
        try {
          config = typeof aiKnowledge.intentScriptsConfig === 'string'
            ? JSON.parse(aiKnowledge.intentScriptsConfig)
            : aiKnowledge.intentScriptsConfig;
        } catch (e) { config = {}; }
      }

      if (!config[scriptId]) {
        res.status(404).json({ success: false, message: 'Script not found' });
        return;
      }

      const { label, enabled, triggers, customTriggers, requiredData, phases, customInstructions } = req.body;

      // Atualiza apenas os campos enviados
      const updated: IntentScriptData = {
        ...config[scriptId],
        ...(label !== undefined && { label: label.trim() }),
        ...(enabled !== undefined && { enabled }),
        ...(triggers !== undefined && { triggers }),
        ...(customTriggers !== undefined && { customTriggers }),
        ...(requiredData !== undefined && { requiredData }),
        ...(phases !== undefined && { phases }),
        ...(customInstructions !== undefined && { customInstructions }),
      };

      config[scriptId] = updated;

      await (prisma.aIKnowledge as any).upsert({
        where: { companyId },
        create: { companyId, intentScriptsConfig: config },
        update: { intentScriptsConfig: config },
      });

      res.json({ success: true, data: updated });
    } catch (error: any) {
      console.error('[IntentScripts] Error updating script:', error.message);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * DELETE /api/ai/intent-scripts/:id
   * Remove um script
   */
  async deleteScript(req: Request, res: Response): Promise<void> {
    const companyId = req.user?.companyId;
    const scriptId = req.params.id;

    if (!companyId) {
      res.status(400).json({ success: false, message: 'Company not found' });
      return;
    }

    try {
      const aiKnowledge = await (prisma.aIKnowledge as any).findUnique({
        where: { companyId },
        select: { intentScriptsConfig: true },
      });

      let config: IntentScriptsConfig = {};
      if (aiKnowledge?.intentScriptsConfig) {
        try {
          config = typeof aiKnowledge.intentScriptsConfig === 'string'
            ? JSON.parse(aiKnowledge.intentScriptsConfig)
            : aiKnowledge.intentScriptsConfig;
        } catch (e) { config = {}; }
      }

      if (!config[scriptId]) {
        res.status(404).json({ success: false, message: 'Script not found' });
        return;
      }

      delete config[scriptId];

      await (prisma.aIKnowledge as any).upsert({
        where: { companyId },
        create: { companyId, intentScriptsConfig: config },
        update: { intentScriptsConfig: config },
      });

      res.json({ success: true, message: 'Script deleted successfully' });
    } catch (error: any) {
      console.error('[IntentScripts] Error deleting script:', error.message);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * PUT /api/ai/intent-scripts (bulk save — compatibilidade com versão antiga)
   */
  async updateScripts(req: Request, res: Response): Promise<void> {
    const companyId = req.user?.companyId;

    if (!companyId) {
      res.status(400).json({ success: false, message: 'Company not found' });
      return;
    }

    const { scripts } = req.body as { scripts: IntentScriptData[] };

    if (!scripts || !Array.isArray(scripts)) {
      res.status(400).json({ success: false, message: 'Invalid scripts data' });
      return;
    }

    try {
      const config: IntentScriptsConfig = {};
      for (const script of scripts) {
        if (script.id) {
          config[script.id] = {
            id: script.id,
            label: script.label,
            enabled: script.enabled ?? false,
            triggers: script.triggers || [],
            customTriggers: script.customTriggers || [],
            requiredData: script.requiredData || [],
            phases: script.phases || [],
            customInstructions: script.customInstructions || '',
          };
        }
      }

      await (prisma.aIKnowledge as any).upsert({
        where: { companyId },
        create: { companyId, intentScriptsConfig: config },
        update: { intentScriptsConfig: config },
      });

      res.json({ success: true, message: 'Intent scripts updated successfully' });
    } catch (error: any) {
      console.error('[IntentScripts] Error bulk updating:', error.message);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}

export default new IntentScriptsController();
