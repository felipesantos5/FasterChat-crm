/**
 * AI Tool Handlers - Implementação das funções que a IA pode chamar
 *
 * Cada handler executa a lógica real quando a IA decide chamar uma tool.
 */

import { prisma } from '../../utils/prisma';
import { addDays, format, startOfDay } from 'date-fns';

/**
 * Parser de horário de funcionamento do cadastro do cliente
 * Formatos suportados:
 * - "8h às 18h" ou "08:00 às 18:00"
 * - "Segunda a Sexta: 8h-18h, Sábado: 8h-12h"
 * - "Seg-Sex 9h-18h | Sab 9h-12h"
 */
function parseWorkingHours(workingHoursText: string | null): {
  weekdayHours: number[];
  saturdayHours: number[];
  sundayHours: number[];
} {
  // Padrão fallback se não houver configuração
  const defaultHours = {
    weekdayHours: [9, 10, 11, 14, 15, 16, 17],
    saturdayHours: [9, 10, 11],
    sundayHours: [],
  };

  if (!workingHoursText) {
    return defaultHours;
  }

  try {
    const text = workingHoursText.toLowerCase();

    // Tenta extrair horários do texto
    const hourRangeRegex = /(\d{1,2})(?:h|:00)?\s*(?:às|a|-)\s*(\d{1,2})(?:h|:00)?/gi;
    const matches = [...text.matchAll(hourRangeRegex)];

    if (matches.length === 0) {
      return defaultHours;
    }

    // Gera array de horas a partir do range
    const generateHours = (start: number, end: number): number[] => {
      const hours: number[] = [];
      // Considera pausa para almoço (12-14h) se o range é grande
      for (let h = start; h < end; h++) {
        if (end - start > 6 && (h === 12 || h === 13)) continue; // Pula almoço
        hours.push(h);
      }
      return hours;
    };

    // Primeira correspondência como horário padrão de semana
    const mainMatch = matches[0];
    const weekdayStart = parseInt(mainMatch[1]);
    const weekdayEnd = parseInt(mainMatch[2]);
    const weekdayHours = generateHours(weekdayStart, weekdayEnd);

    // Verifica se há menção a sábado
    let saturdayHours: number[] = [];
    const saturdayMatch = text.match(/s[aá]b(?:ado)?[:\s]*(\d{1,2})(?:h|:00)?\s*(?:às|a|-)\s*(\d{1,2})(?:h|:00)?/i);
    if (saturdayMatch) {
      saturdayHours = generateHours(parseInt(saturdayMatch[1]), parseInt(saturdayMatch[2]));
    } else if (!text.includes('seg') && !text.includes('segunda')) {
      // Se não especificou dias, assume sábado com horário reduzido
      saturdayHours = generateHours(weekdayStart, Math.min(weekdayEnd, 12));
    }

    // Verifica se atende domingo
    let sundayHours: number[] = [];
    const sundayMatch = text.match(/dom(?:ingo)?[:\s]*(\d{1,2})(?:h|:00)?\s*(?:às|a|-)\s*(\d{1,2})(?:h|:00)?/i);
    if (sundayMatch) {
      sundayHours = generateHours(parseInt(sundayMatch[1]), parseInt(sundayMatch[2]));
    }

    return {
      weekdayHours: weekdayHours.length > 0 ? weekdayHours : defaultHours.weekdayHours,
      saturdayHours,
      sundayHours,
    };
  } catch (error) {
    console.warn('[AI Tool] Error parsing working hours:', error);
    return defaultHours;
  }
}

/**
 * Handler: Buscar slots disponíveis
 * Usa horários configurados pelo cliente no AIKnowledge
 */
export async function handleGetAvailableSlots(args: {
  service_type: string;
  preferred_date?: string;
  companyId: string;
}) {
  try {
    const { service_type, preferred_date, companyId } = args;

    // Busca configuração de horários do cliente
    const aiKnowledge = await prisma.aIKnowledge.findUnique({
      where: { companyId },
      select: { workingHours: true },
    });

    // Parse dos horários configurados
    const { weekdayHours, saturdayHours, sundayHours } = parseWorkingHours(aiKnowledge?.workingHours || null);

    // Define data inicial (preferida ou hoje)
    const startDate = preferred_date ? new Date(preferred_date) : new Date();
    const slots: string[] = [];

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const currentDate = addDays(startOfDay(startDate), dayOffset);
      const dayOfWeek = currentDate.getDay();

      // Seleciona horários baseado no dia da semana
      let hoursToCheck: number[] = [];
      if (dayOfWeek === 0) {
        hoursToCheck = sundayHours;
      } else if (dayOfWeek === 6) {
        hoursToCheck = saturdayHours;
      } else {
        hoursToCheck = weekdayHours;
      }

      // Pula dias sem horário disponível
      if (hoursToCheck.length === 0) continue;

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
      available_slots: slots.slice(0, 10),
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
 * Extrai valor numérico de uma string de preço
 * Ex: "R$ 300,00" -> 300, "a partir de R$ 150" -> 150
 */
function extractPriceValue(priceStr: string | null | undefined): number | null {
  if (!priceStr) return null;

  // Remove texto comum e extrai números
  const cleanPrice = priceStr
    .replace(/a partir de/gi, '')
    .replace(/desde/gi, '')
    .replace(/até/gi, '')
    .replace(/r\$/gi, '')
    .replace(/\./g, '') // Remove pontos de milhar
    .replace(',', '.') // Converte vírgula decimal
    .trim();

  const match = cleanPrice.match(/(\d+(?:\.\d{2})?)/);
  if (match) {
    return parseFloat(match[1]);
  }

  return null;
}

/**
 * Busca o preço de um produto/serviço no cadastro do cliente
 */
async function findProductPrice(
  companyId: string,
  serviceType: string,
  productQuery?: string
): Promise<{ price: number | null; productName: string | null; source: 'cadastro' | 'não_encontrado' }> {
  try {
    const aiKnowledge = await prisma.aIKnowledge.findUnique({
      where: { companyId },
      select: {
        products: true,
        productsServices: true,
      },
    });

    if (!aiKnowledge) {
      return { price: null, productName: null, source: 'não_encontrado' };
    }

    // Primeiro tenta buscar no array de produtos (JSON)
    let products: Array<{ name: string; price?: string; description?: string; category?: string }> = [];
    try {
      if (aiKnowledge.products) {
        products = typeof aiKnowledge.products === 'string'
          ? JSON.parse(aiKnowledge.products)
          : aiKnowledge.products as any;
      }
    } catch {
      products = [];
    }

    // Mapeamento de tipos de serviço para palavras-chave de busca
    const serviceKeywords: Record<string, string[]> = {
      INSTALLATION: ['instalação', 'instalar', 'instalacao'],
      MAINTENANCE: ['manutenção', 'manutencao', 'preventiva', 'revisão'],
      REPAIR: ['reparo', 'conserto', 'corretiva', 'consertar'],
      CONSULTATION: ['consulta', 'orçamento', 'visita', 'avaliação', 'diagnóstico'],
    };

    const keywords = serviceKeywords[serviceType] || [];
    const queryLower = (productQuery || '').toLowerCase();

    // Busca nos produtos cadastrados
    for (const product of products) {
      const nameLower = (product.name || '').toLowerCase();
      const descLower = (product.description || '').toLowerCase();

      // Verifica se o produto corresponde ao tipo de serviço ou à query
      const matchesService = keywords.some(kw => nameLower.includes(kw) || descLower.includes(kw));
      const matchesQuery = queryLower && (nameLower.includes(queryLower) || descLower.includes(queryLower));

      if (matchesService || matchesQuery) {
        const price = extractPriceValue(product.price);
        if (price !== null) {
          return { price, productName: product.name, source: 'cadastro' };
        }
      }
    }

    // Se não encontrou no JSON, busca no texto de produtos/serviços
    if (aiKnowledge.productsServices) {
      const lines = aiKnowledge.productsServices.split('\n');

      for (const line of lines) {
        const lineLower = line.toLowerCase();

        // Verifica se a linha corresponde ao serviço
        const matchesService = keywords.some(kw => lineLower.includes(kw));
        const matchesQuery = queryLower && lineLower.includes(queryLower);

        if (matchesService || matchesQuery) {
          const price = extractPriceValue(line);
          if (price !== null) {
            // Extrai nome do produto da linha
            const productName = line.split(/[-–:]/)[0]?.trim() || line.substring(0, 50);
            return { price, productName, source: 'cadastro' };
          }
        }
      }
    }

    return { price: null, productName: null, source: 'não_encontrado' };
  } catch (error) {
    console.error('[AI Tool] Error finding product price:', error);
    return { price: null, productName: null, source: 'não_encontrado' };
  }
}

/**
 * Handler: Calcular orçamento
 * IMPORTANTE: Busca preços APENAS do cadastro do cliente
 * Não usa valores hardcoded para evitar disparidades
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
    const { service_type, product_specs, additional_services, companyId } = args;

    // Busca o preço do serviço no cadastro do cliente
    const productQuery = product_specs?.unit_type || '';
    const { price: basePrice, productName, source } = await findProductPrice(
      companyId,
      service_type,
      productQuery
    );

    // Se não encontrou preço cadastrado, informa que precisa verificar
    if (basePrice === null || source === 'não_encontrado') {
      return {
        service_type,
        found: false,
        message: 'Não encontrei o preço desse serviço cadastrado. Deixe-me verificar com a equipe para te passar um orçamento preciso.',
        suggestion: 'Posso solicitar um orçamento personalizado para você. Deseja que eu encaminhe?',
      };
    }

    // Busca preços de serviços adicionais no cadastro
    let additionalTotal = 0;
    const additionalDetails: Array<{ service: string; price: number | null; found: boolean }> = [];

    if (additional_services && additional_services.length > 0) {
      for (const service of additional_services) {
        const { price: additionalPrice } = await findProductPrice(companyId, 'ADDITIONAL', service);
        additionalDetails.push({
          service,
          price: additionalPrice,
          found: additionalPrice !== null,
        });
        if (additionalPrice !== null) {
          additionalTotal += additionalPrice;
        }
      }
    }

    const totalPrice = basePrice + additionalTotal;

    // Verifica se algum serviço adicional não foi encontrado
    const missingAdditionals = additionalDetails.filter(a => !a.found);

    return {
      service_type,
      found: true,
      product_name: productName,
      base_price: basePrice,
      additional_cost: additionalTotal,
      total_price: totalPrice,
      currency: 'BRL',
      formatted_price: `R$ ${totalPrice.toFixed(2).replace('.', ',')}`,
      formatted_base: `R$ ${basePrice.toFixed(2).replace('.', ',')}`,
      source: 'Preço conforme cadastro da empresa',
      additional_details: additionalDetails,
      warning: missingAdditionals.length > 0
        ? `Alguns serviços adicionais (${missingAdditionals.map(a => a.service).join(', ')}) não têm preço cadastrado. Preciso verificar esses valores.`
        : undefined,
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
