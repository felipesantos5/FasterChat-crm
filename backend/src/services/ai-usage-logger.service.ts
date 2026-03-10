import { prisma } from '../utils/prisma';

interface LogAiUsageParams {
  companyId: string;
  provider: string;
  usageType: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  characters?: number;
  costUsd: number;
}

/**
 * Registra uso de IA de forma assíncrona (fire-and-forget).
 * Nunca lança exceção — falhas de log não devem interromper o fluxo principal.
 */
export function logAiUsage(params: LogAiUsageParams): void {
  prisma.aIUsageLog
    .create({
      data: {
        companyId: params.companyId,
        provider: params.provider,
        usageType: params.usageType,
        model: params.model,
        inputTokens: params.inputTokens ?? 0,
        outputTokens: params.outputTokens ?? 0,
        characters: params.characters ?? 0,
        costUsd: params.costUsd,
      },
    })
    .catch((err: unknown) =>
      console.error('[AIUsageLogger] Falha ao registrar uso de IA:', err),
    );
}
