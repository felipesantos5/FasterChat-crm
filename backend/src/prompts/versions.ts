/**
 * ============================================
 * PROMPT VERSIONS - Sistema de Versionamento
 * ============================================
 *
 * Cada versão representa um conjunto testado e aprovado de prompts.
 * Permite rollback e comparação de performance entre versões.
 */

export interface PromptVersion {
  version: string;
  releaseDate: string;
  description: string;
  changes: string[];
  isStable: boolean;
  isDefault: boolean;
}

/**
 * Histórico de versões do sistema de prompts
 */
export const PROMPT_VERSIONS: PromptVersion[] = [
  {
    version: "1.0.0",
    releaseDate: "2026-01-22",
    description: "Versão inicial modularizada",
    changes: [
      "Sistema modular de prompts implementado",
      "Separação entre core, objectives e sections",
      "Suporte a múltiplos tipos de objetivo (vendas, suporte, atendimento)",
      "Sistema de versionamento implementado",
      "Regras base de segurança, identidade e comportamento",
    ],
    isStable: true,
    isDefault: true,
  },
];

/**
 * Versões dos módulos individuais
 */
export const MODULE_VERSIONS = {
  core: {
    security: "1.0.0",
    identity: "1.0.0",
    rules: "1.0.0",
  },
  objectives: {
    customer_service: "1.0.0",
    support: "1.0.0",
    sales: "1.0.0",
    sales_scheduling: "1.0.0",
    scheduling: "1.0.0",
    info: "1.0.0",
  },
  sections: {
    tools: "1.0.0",
    style: "1.0.0",
    transbordo: "1.0.0",
  },
};

/**
 * Retorna a versão atual (default) do sistema
 */
export function getCurrentVersion(): PromptVersion {
  const defaultVersion = PROMPT_VERSIONS.find((v) => v.isDefault);
  if (!defaultVersion) {
    return PROMPT_VERSIONS[PROMPT_VERSIONS.length - 1];
  }
  return defaultVersion;
}

/**
 * Retorna uma versão específica
 */
export function getVersion(version: string): PromptVersion | undefined {
  return PROMPT_VERSIONS.find((v) => v.version === version);
}

/**
 * Retorna todas as versões estáveis
 */
export function getStableVersions(): PromptVersion[] {
  return PROMPT_VERSIONS.filter((v) => v.isStable);
}

/**
 * Gera string de versão completa para debug
 */
export function getFullVersionString(): string {
  const current = getCurrentVersion();
  return `PromptSystem v${current.version} (${current.releaseDate})`;
}
