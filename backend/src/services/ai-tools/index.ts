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
    description: 'Busca horários disponíveis para agendamento de visita técnica ou serviço. Use quando o cliente perguntar sobre disponibilidade, horários livres, ou quiser agendar.',
    parameters: {
      type: 'object',
      properties: {
        service_type: {
          type: 'string',
          enum: ['INSTALLATION', 'MAINTENANCE', 'CONSULTATION', 'REPAIR'],
          description: 'Tipo de serviço desejado pelo cliente',
        },
        preferred_date: {
          type: 'string',
          description: 'Data preferida pelo cliente no formato YYYY-MM-DD. Se não especificada, busca próximos dias disponíveis.',
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
    description: 'Busca informações detalhadas sobre produtos, serviços, preços e especificações técnicas da empresa. Use quando cliente perguntar sobre produtos, modelos, capacidades, ou preços.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Termo de busca: nome do produto, categoria (ex: "ar condicionado 12000 BTUs", "manutenção preventiva", "instalação")',
        },
        category: {
          type: 'string',
          enum: ['PRODUCT', 'SERVICE', 'PRICING'],
          description: 'Categoria da consulta',
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
          enum: ['INSTALLATION', 'MAINTENANCE', 'REPAIR', 'CONSULTATION'],
          description: 'Tipo de serviço',
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
 * Lista de todas as tools disponíveis
 */
export const allTools: ChatCompletionTool[] = [
  getAvailableSlotsTool,
  getProductInfoTool,
  getCustomerHistoryTool,
  calculateQuoteTool,
  getCompanyPolicyTool,
];

/**
 * Exporta apenas as tools essenciais para economia de tokens
 * Use esta lista para conversas iniciais ou quando precisar economizar
 */
export const essentialTools: ChatCompletionTool[] = [
  getAvailableSlotsTool,
  getProductInfoTool,
  calculateQuoteTool,
];
