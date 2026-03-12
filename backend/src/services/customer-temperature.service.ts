import { CustomerTemperature, MessageDirection } from "@prisma/client";
import { prisma } from "../utils/prisma";
import geminiService from "./ai-providers/gemini.service";

// Só reanalisar se passaram pelo menos 30 minutos desde a última análise
const REANALYSIS_COOLDOWN_MS = 30 * 60 * 1000;

// Mínimo de mensagens INBOUND para análise ter valor
const MIN_MESSAGES = 3;

const SYSTEM_PROMPT =
  "Você é um classificador de temperatura comercial. Responda APENAS com uma palavra: HOT, WARM ou COLD. Nada mais.";

const USER_PROMPT_TEMPLATE = `Analise as mensagens abaixo enviadas pelo cliente e classifique a temperatura comercial dele.

Critérios:
- HOT: engajado, fazendo perguntas, demonstrando intenção clara de comprar ou fechar negócio
- WARM: respondendo normalmente, neutro, sem sinais fortes de interesse ou desinteresse
- COLD: respostas curtas/evasivas, sem interesse aparente, sumiu ou está desconfortável

Mensagens do cliente (da mais antiga para a mais recente):
{messages}

Temperatura:`;

class CustomerTemperatureService {
  async analyzeAndUpdate(customerId: string, companyId: string): Promise<void> {
    // Verifica cooldown para evitar chamadas desnecessárias em conversas muito ativas
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { temperatureUpdatedAt: true, isGroup: true },
    });

    if (!customer || customer.isGroup) return;

    if (customer.temperatureUpdatedAt) {
      const elapsed = Date.now() - customer.temperatureUpdatedAt.getTime();
      if (elapsed < REANALYSIS_COOLDOWN_MS) return;
    }

    // Busca últimas 15 mensagens INBOUND de texto do cliente
    const messages = await prisma.message.findMany({
      where: {
        customerId,
        direction: MessageDirection.INBOUND,
        mediaType: "text",
        content: { not: "" },
      },
      orderBy: { timestamp: "desc" },
      take: 15,
      select: { content: true },
    });

    if (messages.length < MIN_MESSAGES) return;

    const messagesText = messages
      .reverse()
      .map((m) => `- ${m.content}`)
      .join("\n");

    const userPrompt = USER_PROMPT_TEMPLATE.replace("{messages}", messagesText);

    const raw = await geminiService.generateResponse({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      temperature: 0,
      maxTokens: 5,
      enableTools: false,
      context: { customerId, companyId },
    });

    const normalized = raw.trim().toUpperCase();
    let temperature: CustomerTemperature;

    if (normalized.includes("HOT")) temperature = CustomerTemperature.HOT;
    else if (normalized.includes("COLD")) temperature = CustomerTemperature.COLD;
    else temperature = CustomerTemperature.WARM;

    await prisma.customer.update({
      where: { id: customerId },
      data: {
        temperature,
        temperatureUpdatedAt: new Date(),
      },
    });
  }
}

export const customerTemperatureService = new CustomerTemperatureService();
