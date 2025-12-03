/**
 * AI Tool Handlers - Implementação das funções que a IA pode chamar
 *
 * Cada handler executa a lógica real quando a IA decide chamar uma tool.
 */

import { prisma } from '../../utils/prisma';
import { addDays, format, startOfDay } from 'date-fns';

/**
 * Handler: Buscar slots disponíveis
 */
export async function handleGetAvailableSlots(args: {
  service_type: string;
  preferred_date?: string;
  companyId: string;
}) {
  try {
    const { service_type, preferred_date } = args;

    // Define data inicial (preferida ou hoje)
    const startDate = preferred_date ? new Date(preferred_date) : new Date();

    // Gera slots disponíveis (simplificado)
    const businessHours = [9, 10, 11, 14, 15, 16, 17]; // 9h-12h, 14h-18h
    const slots: string[] = [];

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const currentDate = addDays(startOfDay(startDate), dayOffset);
      const dayOfWeek = currentDate.getDay();

      // Pula domingos (0)
      if (dayOfWeek === 0) continue;

      // Reduz horários no sábado (6)
      const hoursToCheck = dayOfWeek === 6 ? [9, 10, 11] : businessHours;

      for (const hour of hoursToCheck) {
        const slotTime = new Date(currentDate);
        slotTime.setHours(hour, 0, 0, 0);

        if (slotTime > new Date()) {
          slots.push(format(slotTime, "yyyy-MM-dd'T'HH:mm:ss"));
        }
      }
    }

    return {
      service_type,
      available_slots: slots.slice(0, 10), // Retorna máximo 10 slots
      next_available: slots[0] || null,
      total_available: slots.length,
    };
  } catch (error: any) {
    console.error('[AI Tool] Error in handleGetAvailableSlots:', error);
    return {
      error: 'Não foi possível buscar horários disponíveis',
      message: 'Por favor, tente novamente ou fale com um atendente',
    };
  }
}

/**
 * Handler: Buscar informações de produtos
 */
export async function handleGetProductInfo(args: {
  query: string;
  category: string;
  companyId: string;
}) {
  try {
    const { query, category, companyId } = args;

    // Busca no AIKnowledge da empresa
    const aiKnowledge = await prisma.aIKnowledge.findUnique({
      where: { companyId },
      select: {
        productsServices: true,
        companyInfo: true,
      },
    });

    if (!aiKnowledge) {
      return {
        error: 'Informações não encontradas',
        message: 'Deixe eu transferir você para um atendente',
      };
    }

    // Busca no texto de produtos/serviços
    const searchText =
      category === 'PRODUCT' || category === 'SERVICE'
        ? aiKnowledge.productsServices
        : aiKnowledge.companyInfo;

    // Filtro simples (pode ser melhorado com busca vetorial)
    const queryLower = query.toLowerCase();
    const lines = (searchText || '').split('\n');
    const relevantLines = lines.filter((line) =>
      line.toLowerCase().includes(queryLower)
    );

    return {
      query,
      category,
      results: relevantLines.slice(0, 5), // Top 5 resultados
      found: relevantLines.length > 0,
    };
  } catch (error: any) {
    console.error('[AI Tool] Error in handleGetProductInfo:', error);
    return {
      error: 'Não foi possível buscar informações do produto',
    };
  }
}

/**
 * Handler: Buscar histórico do cliente
 */
export async function handleGetCustomerHistory(args: {
  customerId: string;
  include_appointments?: boolean;
}) {
  try {
    const { customerId } = args;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        name: true,
        phone: true,
        tags: true,
        notes: true,
        createdAt: true,
      },
    });

    if (!customer) {
      return {
        error: 'Cliente não encontrado',
      };
    }

    return {
      customer: {
        name: customer.name,
        phone: customer.phone,
        tags: customer.tags,
        notes: customer.notes,
        since: customer.createdAt,
      },
      has_history: customer.tags.length > 0 || !!customer.notes,
    };
  } catch (error: any) {
    console.error('[AI Tool] Error in handleGetCustomerHistory:', error);
    return {
      error: 'Não foi possível buscar histórico do cliente',
    };
  }
}

/**
 * Handler: Calcular orçamento
 */
export async function handleCalculateQuote(args: {
  service_type: string;
  product_specs?: {
    btu_capacity?: number;
    room_size?: number;
    unit_type?: string;
  };
  additional_services?: string[];
  companyId: string;
}) {
  try {
    const { service_type, product_specs, additional_services } = args;

    // Tabela de preços base (pode vir do banco de dados)
    const basePrices: Record<string, number> = {
      INSTALLATION: 300,
      MAINTENANCE: 150,
      REPAIR: 200,
      CONSULTATION: 0, // Grátis
    };

    // Preço base
    let totalPrice = basePrices[service_type] || 0;

    // Adicional por BTU capacity
    if (product_specs?.btu_capacity) {
      if (product_specs.btu_capacity >= 18000) {
        totalPrice += 100; // +R$ 100 para aparelhos grandes
      } else if (product_specs.btu_capacity >= 12000) {
        totalPrice += 50; // +R$ 50 para aparelhos médios
      }
    }

    // Adicional por tipo de unidade
    if (product_specs?.unit_type === 'CASSETTE') {
      totalPrice += 150; // Cassete é mais complexo
    }

    // Serviços adicionais
    const additionalCosts: Record<string, number> = {
      'instalação elétrica': 200,
      'duto extra': 100,
      'suporte reforçado': 80,
    };

    let additionalTotal = 0;
    (additional_services || []).forEach((service) => {
      const serviceLower = service.toLowerCase();
      Object.entries(additionalCosts).forEach(([key, value]) => {
        if (serviceLower.includes(key)) {
          additionalTotal += value;
        }
      });
    });

    totalPrice += additionalTotal;

    return {
      service_type,
      base_price: basePrices[service_type],
      additional_cost: additionalTotal,
      total_price: totalPrice,
      currency: 'BRL',
      formatted_price: `R$ ${totalPrice.toFixed(2).replace('.', ',')}`,
      breakdown: {
        base: basePrices[service_type],
        btu_addon: product_specs?.btu_capacity ? (product_specs.btu_capacity >= 18000 ? 100 : product_specs.btu_capacity >= 12000 ? 50 : 0) : 0,
        unit_addon: product_specs?.unit_type === 'CASSETTE' ? 150 : 0,
        additional_services: additionalTotal,
      },
    };
  } catch (error: any) {
    console.error('[AI Tool] Error in handleCalculateQuote:', error);
    return {
      error: 'Não foi possível calcular orçamento',
      message: 'Por favor, fale com um atendente para orçamento personalizado',
    };
  }
}

/**
 * Handler: Buscar políticas da empresa
 */
export async function handleGetCompanyPolicy(args: {
  policy_type: string;
  companyId: string;
}) {
  try {
    const { policy_type, companyId } = args;

    const aiKnowledge = await prisma.aIKnowledge.findUnique({
      where: { companyId },
      select: {
        policies: true,
        companyInfo: true,
      },
    });

    if (!aiKnowledge) {
      return {
        error: 'Políticas não encontradas',
      };
    }

    // Mapeamento de tipos de política
    const policyKeywords: Record<string, string[]> = {
      WARRANTY: ['garantia', 'warranty'],
      PAYMENT: ['pagamento', 'payment', 'parcelamento', 'cartão'],
      HOURS: ['horário', 'funcionamento', 'hours', 'atendimento'],
      CANCELLATION: ['cancelamento', 'cancellation', 'reembolso'],
      COVERAGE_AREA: ['área', 'cobertura', 'atendemos', 'região'],
    };

    const keywords = policyKeywords[policy_type] || [];
    const searchText = `${aiKnowledge.policies || ''}\n${aiKnowledge.companyInfo || ''}`;
    const lines = searchText.split('\n');

    const relevantLines = lines.filter((line) =>
      keywords.some((keyword) => line.toLowerCase().includes(keyword))
    );

    return {
      policy_type,
      information: relevantLines.slice(0, 3),
      found: relevantLines.length > 0,
    };
  } catch (error: any) {
    console.error('[AI Tool] Error in handleGetCompanyPolicy:', error);
    return {
      error: 'Não foi possível buscar política',
    };
  }
}

/**
 * Dispatcher - Roteia chamadas de tools para seus handlers
 */
export async function executeToolCall(
  toolName: string,
  args: any,
  context: { customerId: string; companyId: string }
) {
  console.log(`[AI Tool] Executing ${toolName} with args:`, JSON.stringify(args, null, 2));

  const enrichedArgs = { ...args, ...context };

  switch (toolName) {
    case 'get_available_slots':
      return handleGetAvailableSlots(enrichedArgs);

    case 'get_product_info':
      return handleGetProductInfo(enrichedArgs);

    case 'get_customer_history':
      return handleGetCustomerHistory(enrichedArgs);

    case 'calculate_quote':
      return handleCalculateQuote(enrichedArgs);

    case 'get_company_policy':
      return handleGetCompanyPolicy(enrichedArgs);

    default:
      console.error(`[AI Tool] Unknown tool: ${toolName}`);
      return {
        error: 'Ferramenta não encontrada',
        tool: toolName,
      };
  }
}
