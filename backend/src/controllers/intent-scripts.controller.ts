import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { INTENT_SCRIPTS, IntentScript } from '../prompts/sections/intent-scripts';

/**
 * ============================================
 * INTENT SCRIPTS CONTROLLER
 * ============================================
 * Gerencia configurações dos scripts de atendimento por intenção.
 * 
 * Os scripts base são definidos no código (intent-scripts.ts).
 * As customizações por empresa (enabled, extra triggers, custom instructions)
 * são salvas no banco como JSON no campo aiCustomInstructions ou em campo dedicado.
 * 
 * Estratégia de armazenamento: usa o campo `intentScriptsConfig` no AIKnowledge
 * como JSON. Simples e não requer migração de banco.
 */

interface IntentScriptConfig {
  enabled: boolean;
  customTriggers?: string[];     // Gatilhos extras além dos padrão
  customInstructions?: string;   // Instruções adicionais específicas para a empresa
}

interface IntentScriptsConfig {
  [scriptId: string]: IntentScriptConfig;
}

class IntentScriptsController {
  /**
   * GET /api/ai/intent-scripts
   * Lista todos os scripts disponíveis + configurações salvas da empresa
   */
  async listScripts(req: Request, res: Response): Promise<void> {
    const companyId = req.user?.companyId;

    if (!companyId) {
      res.status(400).json({ success: false, message: 'Company not found' });
      return;
    }

    // Busca configurações salvas no banco
    // Usando 'as any' para garantir build limpo enquanto o client local não atualiza totalmente
    const aiKnowledge = await (prisma.aIKnowledge as any).findUnique({
      where: { companyId },
      select: { intentScriptsConfig: true },
    });

    let savedConfig: IntentScriptsConfig = {};
    const rawConfig = aiKnowledge?.intentScriptsConfig;
    if (rawConfig) {
      try {
        savedConfig = typeof rawConfig === 'string'
          ? JSON.parse(rawConfig)
          : (rawConfig as IntentScriptsConfig);
      } catch (e) {
        savedConfig = {};
      }
    }

    // Monta resposta com scripts disponíveis + configs da empresa
    const scripts = Object.values(INTENT_SCRIPTS).map((script: IntentScript) => {
      const config = savedConfig[script.id] || { enabled: false };
      return {
        id: script.id,
        label: script.label,
        triggers: script.triggers,
        requiredData: script.requiredData,
        enabled: config.enabled ?? false,
        customTriggers: config.customTriggers || [],
        customInstructions: config.customInstructions || '',
      };
    });

    res.json({ success: true, data: scripts });
  }

  /**
   * PUT /api/ai/intent-scripts
   * Salva configurações dos scripts da empresa
   */
  async updateScripts(req: Request, res: Response): Promise<void> {
    const companyId = req.user?.companyId;

    if (!companyId) {
      res.status(400).json({ success: false, message: 'Company not found' });
      return;
    }

    const { scripts } = req.body as {
      scripts: Array<{
        id: string;
        enabled: boolean;
        customTriggers?: string[];
        customInstructions?: string;
      }>;
    };

    if (!scripts || !Array.isArray(scripts)) {
      res.status(400).json({ success: false, message: 'Invalid scripts data' });
      return;
    }

    // Monta o objeto de configuração
    const config: IntentScriptsConfig = {};
    for (const script of scripts) {
      if (INTENT_SCRIPTS[script.id]) {
        config[script.id] = {
          enabled: script.enabled,
          customTriggers: script.customTriggers || [],
          customInstructions: script.customInstructions || '',
        };
      }
    }

    // Upsert no AIKnowledge (usando as any para compatibilidade de build)
    await (prisma.aIKnowledge as any).upsert({
      where: { companyId },
      create: {
        companyId,
        intentScriptsConfig: config,
      },
      update: {
        intentScriptsConfig: config,
      },
    });

    res.json({ success: true, message: 'Intent scripts updated successfully' });
  }

  /**
   * GET /api/ai/intent-scripts/available
   * Lista apenas os IDs e labels disponíveis (uso público/interno)
   */
  async listAvailable(_req: Request, res: Response): Promise<void> {
    const scripts = Object.values(INTENT_SCRIPTS).map((script: IntentScript) => ({
      id: script.id,
      label: script.label,
      triggersCount: script.triggers.length,
      requiredDataCount: script.requiredData.length,
    }));

    res.json({ success: true, data: scripts });
  }
}

export default new IntentScriptsController();
