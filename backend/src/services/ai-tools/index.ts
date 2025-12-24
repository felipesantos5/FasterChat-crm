/**
 * AI Tools (Function Calling) - OpenAI
 *
 * Define as ferramentas (functions) que a IA pode chamar para buscar informações
 * precisas ao invés de "aluci nar" ou usar apenas o prompt.
 *
 * Vantagens:
 * - ✅ Respostas mais precisas e confiáveis
 * - ✅ Redução de tokens (contexto menor)
 * - ✅ Menor custo operacional
 * - ✅ Menor latência
 */

import { ChatCompletionTool } from 'openai/resources/chat/completions';

/**
 * Tool: Buscar disponibilidade de horários para agendamento
 */
export const getAvailableSlotsTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_available_slots',
    description: 'Busca APENAS as brechas de tempo (horários LIVRES) na agenda dentro do horário de funcionamento. Retorna horários REAIS sem conflitos no Google Calendar. Use quando o cliente perguntar: "que horas vocês têm disponível?", "quais horários estão livres?", "quando vocês podem vir?", ou quando precisar verificar disponibilidade antes de agendar. IMPORTANTE: Estes são horários confirmados e disponíveis, não são sugestões.',
    parameters: {
      type: 'object',
      properties: {
        service_type: {
          type: 'string',
          description: 'Nome do serviço desejado pelo cliente conforme cadastrado no seu catálogo de produtos/serviços. Use EXATAMENTE o nome do serviço que está na LISTA OFICIAL DE PRODUTOS.',
        },
        preferred_date: {
          type: 'string',
          description: 'Data preferida pelo cliente no formato YYYY-MM-DD (ex: 2024-12-25). Se não especificada, busca nos próximos 7 dias.',
        },
      },
      required: ['service_type'],
    },
  },
};

/**
 * Tool: Buscar informações sobre produtos/serviços
 */
export const getProductInfoTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_product_info',
    description: 'SEMPRE use esta ferramenta quando o cliente perguntar QUALQUER COISA sobre produtos, serviços ou preços. Exemplos de perguntas que EXIGEM o uso desta ferramenta: "vocês vendem X?", "tem X?", "quanto custa X?", "qual o preço de X?", "vocês fazem X?", "trabalham com X?", "tem disponível X?". NUNCA diga "vou verificar" - USE A FERRAMENTA IMEDIATAMENTE. A ferramenta busca no catálogo oficial da empresa e retorna informações precisas sobre disponibilidade, preços e especificações.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Termo de busca extraído da pergunta do cliente. Exemplos: se cliente pergunta "vocês vendem controle?", use "controle". Se pergunta "tem ar condicionado 12000?", use "ar condicionado 12000". Se pergunta "quanto custa instalação?", use "instalação".',
        },
        category: {
          type: 'string',
          enum: ['PRODUCT', 'SERVICE', 'PRICING'],
          description: 'PRODUCT: quando perguntam sobre produtos físicos (ex: "controle", "ar condicionado"). SERVICE: quando perguntam sobre serviços (ex: "instalação", "manutenção"). PRICING: quando perguntam especificamente sobre preço (ex: "quanto custa").',
        },
      },
      required: ['query', 'category'],
    },
  },
};

/**
 * Tool: Buscar histórico do cliente
 */
export const getCustomerHistoryTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_customer_history',
    description: 'Busca histórico de serviços, agendamentos anteriores e informações relevantes do cliente. Use quando precisar contexto sobre serviços passados ou relacionamento anterior.',
    parameters: {
      type: 'object',
      properties: {
        include_appointments: {
          type: 'boolean',
          description: 'Incluir agendamentos passados',
          default: true,
        },
        include_services: {
          type: 'boolean',
          description: 'Incluir serviços realizados',
          default: true,
        },
      },
    },
  },
};

/**
 * Tool: Calcular orçamento
 */
export const calculateQuoteTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'calculate_quote',
    description: 'Calcula orçamento personalizado baseado nas especificações do cliente. Use quando cliente pedir preço específico ou orçamento detalhado.',
    parameters: {
      type: 'object',
      properties: {
        service_type: {
          type: 'string',
          description: 'Nome do serviço conforme cadastrado no seu catálogo de produtos/serviços. Use o nome EXATO da LISTA OFICIAL DE PRODUTOS.',
        },
        product_specs: {
          type: 'object',
          properties: {
            btu_capacity: {
              type: 'number',
              description: 'Capacidade em BTUs (ex: 9000, 12000, 18000)',
            },
            room_size: {
              type: 'number',
              description: 'Tamanho do ambiente em m²',
            },
            unit_type: {
              type: 'string',
              enum: ['SPLIT', 'WINDOW', 'PORTABLE', 'CASSETTE'],
              description: 'Tipo de aparelho',
            },
          },
        },
        additional_services: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Serviços adicionais (ex: "instalação elétrica", "duto extra")',
        },
      },
      required: ['service_type'],
    },
  },
};

/**
 * Tool: Buscar políticas e informações da empresa
 */
export const getCompanyPolicyTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_company_policy',
    description: 'Busca políticas, garantias, formas de pagamento, horário de funcionamento e outras informações institucionais da empresa.',
    parameters: {
      type: 'object',
      properties: {
        policy_type: {
          type: 'string',
          enum: ['WARRANTY', 'PAYMENT', 'HOURS', 'CANCELLATION', 'COVERAGE_AREA'],
          description: 'Tipo de política ou informação solicitada',
        },
      },
      required: ['policy_type'],
    },
  },
};

/**
 * Tool: Criar agendamento
 */
export const createAppointmentTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'create_appointment',
    description: 'Cria um agendamento para o cliente quando todos os dados necessários foram coletados: tipo de serviço, data, horário e endereço. Use SOMENTE quando o cliente confirmar explicitamente que deseja agendar.',
    parameters: {
      type: 'object',
      properties: {
        service_type: {
          type: 'string',
          description: 'Nome do serviço a ser agendado conforme cadastrado no seu catálogo. Use o nome EXATO da LISTA OFICIAL DE PRODUTOS/SERVIÇOS.',
        },
        date: {
          type: 'string',
          description: 'Data do agendamento no formato YYYY-MM-DD',
        },
        time: {
          type: 'string',
          description: 'Horário do agendamento no formato HH:MM (ex: 14:00)',
        },
        address: {
          type: 'string',
          description: 'Endereço completo onde o serviço será realizado',
        },
        title: {
          type: 'string',
          description: 'Título descritivo do agendamento',
        },
        notes: {
          type: 'string',
          description: 'Observações adicionais sobre o agendamento',
        },
      },
      required: ['service_type', 'date', 'time', 'address', 'title'],
    },
  },
};

/**
 * Lista de todas as tools disponíveis
 */
export const allTools: ChatCompletionTool[] = [
  getAvailableSlotsTool,
  getProductInfoTool,
  getCustomerHistoryTool,
  calculateQuoteTool,
  getCompanyPolicyTool,
  createAppointmentTool,
];

/**
 * Exporta apenas as tools essenciais para economia de tokens
 * Use esta lista para conversas iniciais ou quando precisar economizar
 */
export const essentialTools: ChatCompletionTool[] = [
  getAvailableSlotsTool,
  createAppointmentTool,
  getProductInfoTool,
  calculateQuoteTool,
];
