import { prisma } from '../utils/prisma';
import { UpdateAIKnowledgeRequest, Product } from '../types/ai-knowledge';
import openaiService from './ai-providers/openai.service';

class AIKnowledgeService {
  /**
   * Obtém a base de conhecimento de uma empresa
   */
  async getKnowledge(companyId: string) {
    try {
      const knowledge = await prisma.aIKnowledge.findUnique({
        where: { companyId },
      });

      return knowledge;
    } catch (error: any) {
      console.error('Error getting AI knowledge:', error);
      throw new Error(`Failed to get AI knowledge: ${error.message}`);
    }
  }

  /**
   * Cria ou atualiza a base de conhecimento
   */
  async upsertKnowledge(companyId: string, data: UpdateAIKnowledgeRequest) {
    try {
      console.log('[AI Knowledge Service] Upserting knowledge with data:', {
        companyId,
        companyName: data.companyName,
        companySegment: data.companySegment,
        setupStep: data.setupStep,
        setupCompleted: data.setupCompleted,
      });

      const knowledge = await prisma.aIKnowledge.upsert({
        where: { companyId },
        update: {
          // Informações da empresa
          companyName: data.companyName,
          companySegment: data.companySegment,
          companyDescription: data.companyDescription,
          companyInfo: data.companyInfo,

          // Objetivo da IA
          aiObjective: data.aiObjective,
          aiPersonality: data.aiPersonality,
          toneInstructions: data.toneInstructions,

          // Políticas
          policies: data.policies,
          workingHours: data.workingHours,
          paymentMethods: data.paymentMethods,
          deliveryInfo: data.deliveryInfo,
          warrantyInfo: data.warrantyInfo,

          // Produtos
          productsServices: data.productsServices,
          products: data.products ? JSON.stringify(data.products) : undefined,

          // Configurações adicionais
          negativeExamples: data.negativeExamples,
          faq: data.faq ? JSON.stringify(data.faq) : undefined,

          // Status do onboarding
          setupCompleted: data.setupCompleted,
          setupStep: data.setupStep,

          // Configurações avançadas
          provider: data.provider,
          model: data.model,
          temperature: data.temperature,
          maxTokens: data.maxTokens,
          autoReplyEnabled: data.autoReplyEnabled,
        },
        create: {
          companyId,
          // Informações da empresa
          companyName: data.companyName,
          companySegment: data.companySegment,
          companyDescription: data.companyDescription,
          companyInfo: data.companyInfo,

          // Objetivo da IA
          aiObjective: data.aiObjective,
          aiPersonality: data.aiPersonality,
          toneInstructions: data.toneInstructions,

          // Políticas
          policies: data.policies,
          workingHours: data.workingHours,
          paymentMethods: data.paymentMethods,
          deliveryInfo: data.deliveryInfo,
          warrantyInfo: data.warrantyInfo,

          // Produtos
          productsServices: data.productsServices,
          products: data.products ? JSON.stringify(data.products) : '[]',

          // Configurações adicionais
          negativeExamples: data.negativeExamples,
          faq: data.faq ? JSON.stringify(data.faq) : '[]',

          // Status do onboarding
          setupCompleted: data.setupCompleted ?? false,
          setupStep: data.setupStep ?? 0,

          // Configurações avançadas
          provider: data.provider || 'openai',
          model: data.model,
          temperature: data.temperature ?? 0.7,
          maxTokens: data.maxTokens ?? 500,
          autoReplyEnabled: data.autoReplyEnabled ?? true,
        },
      });

      // Parse JSON fields para retorno
      const result = {
        ...knowledge,
        products: knowledge.products ? JSON.parse(knowledge.products as string) : [],
        faq: knowledge.faq ? JSON.parse(knowledge.faq as string) : [],
      };

      console.log(`✓ AI knowledge updated for company ${companyId}`);

      return result;
    } catch (error: any) {
      console.error('✗ Error upserting AI knowledge:', error);
      throw new Error(`Failed to upsert AI knowledge: ${error.message}`);
    }
  }

  /**
   * Gera um contexto completo e otimizado usando IA
   */
  async generateContext(companyId: string) {
    try {
      // Busca as informações atuais
      const knowledge = await prisma.aIKnowledge.findUnique({
        where: { companyId },
      });

      if (!knowledge) {
        throw new Error('Configurações não encontradas. Complete o wizard primeiro.');
      }

      // Parse products
      let products: Product[] = [];
      try {
        products = knowledge.products ? JSON.parse(knowledge.products as string) : [];
      } catch {
        products = [];
      }

      // Monta as informações para a IA processar
      const businessInfo = {
        companyName: knowledge.companyName || '',
        companySegment: knowledge.companySegment || '',
        companyDescription: knowledge.companyDescription || knowledge.companyInfo || '',
        aiObjective: knowledge.aiObjective || '',
        aiPersonality: knowledge.aiPersonality || knowledge.toneInstructions || '',
        workingHours: knowledge.workingHours || '',
        paymentMethods: knowledge.paymentMethods || '',
        deliveryInfo: knowledge.deliveryInfo || '',
        warrantyInfo: knowledge.warrantyInfo || '',
        products,
      };

      // Gera o contexto usando IA
      const generatedContext = await this.generateContextWithAI(businessInfo);

      // Salva o contexto gerado
      await prisma.aIKnowledge.update({
        where: { companyId },
        data: {
          generatedContext,
          contextGeneratedAt: new Date(),
          setupCompleted: true,
        },
      });

      console.log(`✓ Context generated for company ${companyId}`);

      return {
        generatedContext,
        contextGeneratedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error('✗ Error generating context:', error);
      throw new Error(`Failed to generate context: ${error.message}`);
    }
  }

  /**
   * Usa IA para gerar um contexto rico e estruturado
   */
  private async generateContextWithAI(businessInfo: {
    companyName: string;
    companySegment: string;
    companyDescription: string;
    aiObjective: string;
    aiPersonality: string;
    workingHours: string;
    paymentMethods: string;
    deliveryInfo: string;
    warrantyInfo: string;
    products: Product[];
  }): Promise<string> {
    const prompt = `Você é um especialista em criar contextos de IA para atendimento ao cliente via WhatsApp.

Com base nas informações abaixo sobre um negócio, crie um contexto completo, profissional e estruturado que será usado por uma IA assistente para atender clientes.

O contexto deve ser:
- Claro e bem organizado
- Completo mas conciso
- Profissional e amigável
- Otimizado para atendimento via WhatsApp

INFORMAÇÕES DO NEGÓCIO:

Nome da Empresa: ${businessInfo.companyName || 'Não informado'}
Segmento: ${businessInfo.companySegment || 'Não informado'}
Descrição: ${businessInfo.companyDescription || 'Não informada'}

Objetivo da IA: ${businessInfo.aiObjective || 'Atender clientes e responder dúvidas'}
Personalidade: ${businessInfo.aiPersonality || 'Amigável e profissional'}

Horário de Atendimento: ${businessInfo.workingHours || 'Não informado'}
Formas de Pagamento: ${businessInfo.paymentMethods || 'Não informado'}
Entrega/Prazos: ${businessInfo.deliveryInfo || 'Não informado'}
Garantias: ${businessInfo.warrantyInfo || 'Não informado'}

Produtos/Serviços:
${businessInfo.products.length > 0
  ? businessInfo.products.map(p => `- ${p.name}${p.price ? ` (${p.price})` : ''}${p.description ? `: ${p.description}` : ''}`).join('\n')
  : 'Nenhum produto cadastrado'}

---

Agora crie o contexto completo para a IA assistente. Inclua:

1. Uma apresentação clara de quem é a IA e para qual empresa trabalha
2. O que a IA pode fazer e como pode ajudar
3. Informações relevantes sobre produtos/serviços
4. Políticas importantes (horário, pagamento, entrega, garantia)
5. Tom de voz e como deve se comportar
6. O que NÃO deve fazer (ex: não inventar informações, não prometer o que não pode cumprir)

Escreva em português brasileiro, de forma natural e profissional.`;

    try {
      const response = await openaiService.generateResponse({
        systemPrompt: 'Você é um especialista em criar contextos de IA para atendimento ao cliente via WhatsApp. Crie contextos profissionais, completos e otimizados.',
        userPrompt: prompt,
        temperature: 0.7,
        maxTokens: 2000,
      });

      return response || this.generateFallbackContext(businessInfo);
    } catch (error) {
      console.error('Error calling OpenAI for context generation:', error);
      // Fallback: gera um contexto básico sem IA
      return this.generateFallbackContext(businessInfo);
    }
  }

  /**
   * Gera um contexto básico caso a IA falhe
   */
  private generateFallbackContext(businessInfo: {
    companyName: string;
    companySegment: string;
    companyDescription: string;
    aiObjective: string;
    aiPersonality: string;
    workingHours: string;
    paymentMethods: string;
    deliveryInfo: string;
    warrantyInfo: string;
    products: Product[];
  }): string {
    let context = `# Assistente Virtual ${businessInfo.companyName || 'da Empresa'}\n\n`;

    context += `## Sobre a Empresa\n`;
    if (businessInfo.companyName) context += `Nome: ${businessInfo.companyName}\n`;
    if (businessInfo.companySegment) context += `Segmento: ${businessInfo.companySegment}\n`;
    if (businessInfo.companyDescription) context += `${businessInfo.companyDescription}\n`;
    context += '\n';

    context += `## Meu Objetivo\n`;
    context += businessInfo.aiObjective || 'Atender clientes, responder dúvidas e ajudar no que for preciso.\n';
    context += '\n';

    context += `## Como Devo Agir\n`;
    context += businessInfo.aiPersonality || 'Ser amigável, profissional e prestativo.\n';
    context += '\n';

    if (businessInfo.products.length > 0) {
      context += `## Produtos e Serviços\n`;
      businessInfo.products.forEach(p => {
        context += `- **${p.name}**`;
        if (p.price) context += ` - ${p.price}`;
        if (p.description) context += `\n  ${p.description}`;
        context += '\n';
      });
      context += '\n';
    }

    context += `## Informações Importantes\n`;
    if (businessInfo.workingHours) context += `- Horário de atendimento: ${businessInfo.workingHours}\n`;
    if (businessInfo.paymentMethods) context += `- Formas de pagamento: ${businessInfo.paymentMethods}\n`;
    if (businessInfo.deliveryInfo) context += `- Entrega: ${businessInfo.deliveryInfo}\n`;
    if (businessInfo.warrantyInfo) context += `- Garantia: ${businessInfo.warrantyInfo}\n`;
    context += '\n';

    context += `## Regras Importantes\n`;
    context += `- Nunca inventar informações que não tenho\n`;
    context += `- Sempre ser educado e prestativo\n`;
    context += `- Se não souber algo, indicar que vou verificar ou encaminhar para um atendente humano\n`;

    return context;
  }

  /**
   * Formata a base de conhecimento para uso pela IA
   * Prioriza o contexto gerado, se disponível
   */
  formatKnowledgeForAI(knowledge: any): string {
    if (!knowledge) {
      return 'Nenhuma informação adicional disponível.';
    }

    // Se tem contexto gerado, usa ele
    if (knowledge.generatedContext) {
      return knowledge.generatedContext;
    }

    // Fallback para formatação antiga
    let formatted = '';

    if (knowledge.companyInfo || knowledge.companyDescription) {
      formatted += `## Sobre a Empresa\n${knowledge.companyDescription || knowledge.companyInfo}\n\n`;
    }

    if (knowledge.productsServices) {
      formatted += `## Produtos e Serviços\n${knowledge.productsServices}\n\n`;
    }

    if (knowledge.toneInstructions || knowledge.aiPersonality) {
      formatted += `## Tom de Voz e Instruções\n${knowledge.aiPersonality || knowledge.toneInstructions}\n\n`;
    }

    if (knowledge.policies) {
      formatted += `## Políticas Importantes\n${knowledge.policies}\n\n`;
    }

    return formatted || 'Nenhuma informação adicional disponível.';
  }
}

export default new AIKnowledgeService();
