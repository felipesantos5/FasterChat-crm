import { prisma } from '../utils/prisma';
import { UpdateAIKnowledgeRequest, Product } from '../types/ai-knowledge';
import openaiService from './ai-providers/openai.service';

// ============================================
// CONFIGURAÇÕES HARDCODED DO ATENDENTE VIRTUAL
// ============================================
// Estas configurações foram otimizadas para melhor performance
// de um chatbot profissional de atendimento ao cliente.
// O cliente NÃO configura tom de voz/personalidade, apenas objetivo.

const HARDCODED_AI_BEHAVIOR = `
## COMPORTAMENTO PROFISSIONAL (AUTOMÁTICO)

### Tom de Comunicação
- Comunicação educada e levemente formal, mas acolhedora
- Linguagem clara, objetiva e fácil de entender
- Tratamento respeitoso usando "você" ou o nome do cliente
- Respostas diretas sem enrolação

### Uso de Emojis
- Uso moderado e estratégico (máximo 2-3 por mensagem)
- Emojis profissionais: ✅ confirmações, 📦 entregas, 💳 pagamentos, ⏰ horários
- Evitar emojis muito informais ou excessivos
- Emoji de saudação apenas no início (Olá! 👋)

### Estrutura das Respostas
- Respostas curtas e organizadas (máximo 3-4 linhas por bloco)
- Quebras de linha para separar informações
- Listas para múltiplos itens
- Uma pergunta de ação por vez (não sobrecarregar)

### Fluxo de Atendimento
1. Cumprimentar cordialmente (só na primeira mensagem)
2. Identificar a necessidade do cliente
3. Responder de forma objetiva
4. Oferecer ajuda adicional ou próximo passo
5. Agradecer quando apropriado

### O que SEMPRE fazer
- Confirmar entendimento em dúvidas complexas
- Pedir desculpas educadamente em caso de limitações
- Oferecer alternativas quando não puder ajudar diretamente
- Encaminhar para humano quando necessário

### O que NUNCA fazer
- NUNCA inventar preços, valores ou prazos - APENAS informe o que está cadastrado
- Se não souber um valor ou prazo específico, diga que vai verificar/confirmar
- Nunca prometer prazos ou condições sem confirmação
- Nunca usar gírias ou linguagem muito informal
- Nunca ser impaciente ou ríspido
- Nunca compartilhar dados de outros clientes
- Nunca repetir saudação se já houver histórico de conversa
- Nunca "chutar" ou arredondar valores - seja preciso ou diga que vai confirmar
`;

const DEFAULT_AI_OBJECTIVE = `Atender clientes de forma eficiente e profissional, respondendo dúvidas sobre produtos/serviços, auxiliando com informações de pedidos, explicando políticas da empresa e direcionando para atendimento humano quando necessário.`;

class AIKnowledgeService {
  /**
   * Parse JSON de forma segura
   */
  private safeJsonParse(value: any, defaultValue: any = []): any {
    if (!value) return defaultValue;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed || trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
        return defaultValue;
      }
      try {
        return JSON.parse(trimmed);
      } catch {
        return defaultValue;
      }
    }
    return defaultValue;
  }

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

          // Objetivo da IA (usa padrão se não informado)
          aiObjective: data.aiObjective || DEFAULT_AI_OBJECTIVE,
          // aiPersonality e toneInstructions agora são hardcoded no sistema
          aiPersonality: null,
          toneInstructions: null,

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

      // Parse JSON fields para retorno (com tratamento de erro)
      const result = {
        ...knowledge,
        products: this.safeJsonParse(knowledge.products, []),
        faq: this.safeJsonParse(knowledge.faq, []),
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
      const products: Product[] = this.safeJsonParse(knowledge.products, []);

      // Monta as informações para a IA processar
      // NOTA: aiPersonality foi removido - agora é hardcoded
      const businessInfo = {
        companyName: knowledge.companyName || '',
        companySegment: knowledge.companySegment || '',
        companyDescription: knowledge.companyDescription || knowledge.companyInfo || '',
        aiObjective: knowledge.aiObjective || '',
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
   *
   * IMPORTANTE: Esta função também aprimora o objetivo do cliente
   * para torná-lo mais eficiente e profissional.
   */
  private async generateContextWithAI(businessInfo: {
    companyName: string;
    companySegment: string;
    companyDescription: string;
    aiObjective: string;
    workingHours: string;
    paymentMethods: string;
    deliveryInfo: string;
    warrantyInfo: string;
    products: Product[];
  }): Promise<string> {
    // Primeiro, aprimora o objetivo do cliente usando IA
    const enhancedObjective = await this.enhanceObjectiveWithAI(businessInfo.aiObjective, businessInfo.companySegment);

    const prompt = `Você é um especialista em criar contextos de IA para atendimento ao cliente via WhatsApp.

Com base nas informações abaixo sobre um negócio, crie um contexto COMPLETO, PROFISSIONAL e OTIMIZADO que será usado por uma IA assistente para atender clientes.

IMPORTANTE: O comportamento e tom de voz já estão configurados automaticamente. Seu foco é criar o contexto do NEGÓCIO de forma clara e estruturada.

## INFORMAÇÕES DO NEGÓCIO

**Empresa:** ${businessInfo.companyName || 'Não informado'}
**Segmento:** ${businessInfo.companySegment || 'Não informado'}
**Descrição:** ${businessInfo.companyDescription || 'Não informada'}

**Objetivo do Atendimento (Aprimorado):**
${enhancedObjective}

**Horário de Atendimento:** ${businessInfo.workingHours || 'Consultar disponibilidade'}
**Formas de Pagamento:** ${businessInfo.paymentMethods || 'Consultar opções disponíveis'}
**Entrega/Prazos:** ${businessInfo.deliveryInfo || 'Consultar condições'}
**Garantias:** ${businessInfo.warrantyInfo || 'Consultar política de garantia'}

**Produtos/Serviços:**
${businessInfo.products.length > 0
  ? businessInfo.products.map(p => `- **${p.name}**${p.price ? ` - ${p.price}` : ''}${p.category ? ` [${p.category}]` : ''}${p.description ? `\n  ${p.description}` : ''}`).join('\n')
  : 'Produtos/serviços serão informados durante o atendimento'}

---

## TAREFA

Crie o contexto estruturado com as seguintes seções:

### 1. APRESENTAÇÃO
- Quem é a IA e qual empresa representa
- Deixe claro que é uma assistente virtual inteligente

### 2. CAPACIDADES
- O que pode fazer para ajudar o cliente
- Quais informações pode fornecer
- Quando deve encaminhar para humano

### 3. CONHECIMENTO DO NEGÓCIO
- Informações sobre a empresa
- Produtos e serviços (organize de forma clara)
- Diferenciais e pontos fortes

### 4. POLÍTICAS E INFORMAÇÕES IMPORTANTES
- Horários, pagamentos, entregas, garantias
- Regras que o cliente precisa saber

### 5. INSTRUÇÕES ESPECIAIS PARA O SEGMENTO "${businessInfo.companySegment || 'GERAL'}"
- Adicione dicas específicas do segmento
- Como lidar com situações comuns do setor
- Perguntas frequentes típicas

REGRAS CRÍTICAS:
- Escreva em português brasileiro natural
- Seja conciso mas completo
- Use formatação clara com títulos e bullets
- Não inclua instruções de tom de voz (já configurado automaticamente)
- Foque em informações do NEGÓCIO, não em como se comportar
- ⚠️ MANTENHA OS VALORES EXATOS - NÃO altere preços, não arredonde, não invente valores
- ⚠️ Se um produto tem preço "R$ 450,00", mantenha EXATAMENTE "R$ 450,00"
- ⚠️ Se não há preço cadastrado, NÃO invente - deixe sem preço
- ⚠️ Copie os valores LITERALMENTE como foram informados`;

    try {
      const response = await openaiService.generateResponse({
        systemPrompt: `Você é um especialista em criar contextos de IA para atendimento ao cliente via WhatsApp.

Sua especialidade é transformar informações básicas de um negócio em um contexto rico, profissional e otimizado para atendimento.

IMPORTANTE:
- Foque apenas nas informações do negócio
- O comportamento/tom de voz já está configurado automaticamente pelo sistema
- Seu papel é organizar e enriquecer as informações do negócio

⚠️ REGRA CRÍTICA SOBRE VALORES:
- NUNCA altere, arredonde ou invente preços/valores
- Copie os valores EXATAMENTE como foram fornecidos
- Se o cliente informou "R$ 450,00", use EXATAMENTE "R$ 450,00"
- Se não há preço para um item, NÃO invente - deixe sem preço`,
        userPrompt: prompt,
        temperature: 0.4, // Reduzido para ser mais preciso com valores
        maxTokens: 3000,
      });

      // Combina o contexto do negócio com o comportamento hardcoded
      const finalContext = `${response}\n\n${HARDCODED_AI_BEHAVIOR}`;

      return finalContext || this.generateFallbackContext(businessInfo);
    } catch (error) {
      console.error('Error calling OpenAI for context generation:', error);
      return this.generateFallbackContext(businessInfo);
    }
  }

  /**
   * Aprimora o objetivo do cliente usando IA
   * Torna o objetivo mais específico, profissional e eficiente
   */
  private async enhanceObjectiveWithAI(clientObjective: string, segment: string): Promise<string> {
    if (!clientObjective || clientObjective.trim().length < 10) {
      // Se o objetivo é muito curto ou vazio, retorna um padrão baseado no segmento
      return this.getDefaultObjectiveForSegment(segment);
    }

    try {
      const response = await openaiService.generateResponse({
        systemPrompt: `Você é um especialista em otimizar objetivos de chatbots de atendimento.

Sua tarefa é pegar o objetivo escrito pelo cliente (que pode estar mal escrito ou incompleto) e transformá-lo em um objetivo profissional, claro e eficiente.

REGRAS:
- Mantenha a essência do que o cliente quer
- Adicione capacidades importantes que o cliente pode ter esquecido
- Use linguagem profissional e clara
- Seja específico sobre o que a IA pode e não pode fazer
- Máximo de 5 linhas`,
        userPrompt: `Segmento do negócio: ${segment || 'Geral'}

Objetivo original do cliente:
"${clientObjective}"

Transforme isso em um objetivo profissional e otimizado para um chatbot de atendimento via WhatsApp:`,
        temperature: 0.6,
        maxTokens: 300,
      });

      return response || clientObjective;
    } catch (error) {
      console.error('Error enhancing objective:', error);
      return clientObjective; // Retorna o original se falhar
    }
  }

  /**
   * Retorna um objetivo padrão baseado no segmento do negócio
   */
  private getDefaultObjectiveForSegment(segment: string): string {
    const segmentObjectives: Record<string, string> = {
      'E-commerce / Loja Online': 'Auxiliar clientes com informações sobre produtos, disponibilidade, preços, formas de pagamento, prazos de entrega e status de pedidos. Resolver dúvidas pré e pós-venda. Encaminhar para atendimento humano em casos de reclamações ou negociações especiais.',

      'Prestação de Serviços': 'Apresentar os serviços oferecidos, esclarecer dúvidas, informar sobre valores e condições, auxiliar no agendamento de serviços e fornecer suporte para clientes existentes. Encaminhar casos complexos para especialistas.',

      'Restaurante / Alimentação': 'Informar sobre cardápio, preços, ingredientes e opções dietéticas. Auxiliar com pedidos, horários de funcionamento, reservas e delivery. Resolver dúvidas sobre promoções e programas de fidelidade.',

      'Saúde / Clínica': 'Auxiliar no agendamento de consultas, informar sobre especialidades e profissionais disponíveis, esclarecer dúvidas sobre convênios e valores particulares. Fornecer informações sobre preparo para exames quando aplicável.',

      'Educação / Cursos': 'Apresentar cursos disponíveis, grades curriculares, valores e formas de pagamento. Auxiliar no processo de matrícula e tirar dúvidas sobre metodologia, certificações e pré-requisitos.',

      'Tecnologia / Software': 'Fornecer suporte técnico de primeiro nível, auxiliar com dúvidas sobre funcionalidades, informar sobre planos e preços. Escalar problemas técnicos complexos para a equipe especializada.',

      'Consultoria': 'Apresentar serviços de consultoria, áreas de atuação e diferenciais. Auxiliar no agendamento de reuniões iniciais e esclarecer dúvidas sobre metodologia de trabalho e valores.',

      'Varejo / Loja Física': 'Informar sobre produtos disponíveis, promoções vigentes, horários de funcionamento e localização. Auxiliar com reservas de produtos e tirar dúvidas sobre trocas e devoluções.',

      'Imobiliário': 'Apresentar imóveis disponíveis conforme critérios do cliente, informar sobre valores, condições de financiamento e agendar visitas. Esclarecer dúvidas sobre documentação e processo de compra/aluguel.',

      'Automotivo': 'Auxiliar com informações sobre veículos, peças e serviços. Informar sobre disponibilidade, preços, condições de financiamento e agendamento de test-drives ou serviços de manutenção.',

      'Beleza / Estética': 'Informar sobre serviços e tratamentos disponíveis, valores e duração dos procedimentos. Auxiliar no agendamento de horários e tirar dúvidas sobre cuidados pré e pós-procedimento.',
    };

    return segmentObjectives[segment] || DEFAULT_AI_OBJECTIVE;
  }

  /**
   * Gera um contexto básico caso a IA falhe
   */
  private generateFallbackContext(businessInfo: {
    companyName: string;
    companySegment: string;
    companyDescription: string;
    aiObjective: string;
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
    context += businessInfo.aiObjective || this.getDefaultObjectiveForSegment(businessInfo.companySegment);
    context += '\n\n';

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

    // Adiciona o comportamento hardcoded
    context += HARDCODED_AI_BEHAVIOR;

    return context;
  }

  /**
   * Formata a base de conhecimento para uso pela IA
   * Prioriza o contexto gerado, se disponível
   */
  formatKnowledgeForAI(knowledge: any): string {
    if (!knowledge) {
      return 'Nenhuma informação adicional disponível.' + HARDCODED_AI_BEHAVIOR;
    }

    // Se tem contexto gerado, usa ele (já inclui comportamento hardcoded)
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

    if (knowledge.policies) {
      formatted += `## Políticas Importantes\n${knowledge.policies}\n\n`;
    }

    // Sempre adiciona o comportamento hardcoded
    formatted += HARDCODED_AI_BEHAVIOR;

    return formatted || 'Nenhuma informação adicional disponível.' + HARDCODED_AI_BEHAVIOR;
  }
}

export default new AIKnowledgeService();
