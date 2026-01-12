import { prisma } from '../../utils/prisma';
import { addDays, format, startOfDay, addMinutes } from 'date-fns';
import Fuse from 'fuse.js'; // npm install fuse.js
import { googleCalendarService } from '../google-calendar.service';
import { appointmentService } from '../appointment.service';
import { AppointmentType } from '@prisma/client';

// ==========================================
// TYPES & INTERFACES
// ==========================================

interface Product {
  name: string;
  price?: string | number;
  description?: string;
  category?: string;
  salesLink?: string; // Link de venda/checkout para produtos virtuais ou mensalidades
}

interface SearchResult {
  item: Product;
  score?: number;
}

// ==========================================
// HELPERS
// ==========================================

/**
 * Cria uma data no timezone do Brasil (America/Sao_Paulo)
 * Garante que quando o cliente fala "08:00", é realmente 08:00 no horário de Brasília
 *
 * ABORDAGEM SIMPLIFICADA E CONFIÁVEL:
 * - Cria a Date diretamente usando o offset de São Paulo (-03:00)
 * - Funciona independente do timezone do servidor (UTC, AWS, Docker, etc.)
 *
 * @param dateString Data no formato YYYY-MM-DD (ex: "2024-12-25")
 * @param timeString Hora no formato HH:mm (ex: "08:00")
 * @returns Date object no timezone correto
 */
function createBrazilDate(dateString: string, timeString: string): Date {
  // São Paulo está em UTC-3 (Brasil não usa mais horário de verão desde 2019)
  const SAO_PAULO_OFFSET = '-03:00';

  // Cria a data diretamente no formato ISO com o offset correto
  // Exemplo: "2025-01-02T14:00:00-03:00"
  const isoString = `${dateString}T${timeString}:00${SAO_PAULO_OFFSET}`;

  const date = new Date(isoString);

  console.log('[Helper] ============================================');
  console.log('[Helper] CRIANDO DATA - TIMEZONE BRASIL');
  console.log('[Helper] ============================================');
  console.log('[Helper] Input:', dateString, timeString);
  console.log('[Helper] ISO String criada:', isoString);
  console.log('[Helper] Date UTC (interno):', date.toISOString());
  console.log('[Helper] Verificação - Hora em São Paulo:', date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
  console.log('[Helper] ============================================');

  return date;
}

/**
 * Limpa e converte preço para number
 */
function parsePrice(value: string | number | undefined): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return value;
  
  // Remove R$, espaços e converte vírgula para ponto
  const clean = value.toString()
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')  // Remove separador de milhar
    .replace(',', '.');  // Virgula decimal para ponto

  const floatVal = parseFloat(clean);
  return isNaN(floatVal) ? null : floatVal;
}

/**
 * Busca produtos usando Fuse.js (Fuzzy Search)
 * Melhorado para buscar em nome, categoria E descrição com pesos balanceados
 */
function searchProducts(
  products: Product[],
  query: string,
  threshold = 0.6  // Aumentado para ser mais permissivo (era 0.4)
): Product[] {
  if (!products.length) return [];

  console.log(`[SearchProducts] Buscando "${query}" em ${products.length} produtos`);

  const fuse = new Fuse(products, {
    keys: [
      { name: 'name', weight: 0.5 },       // Nome tem prioridade, mas não tanto
      { name: 'description', weight: 0.3 }, // Descrição agora tem peso significativo (era 0.1)
      { name: 'category', weight: 0.2 }
    ],
    threshold, // 0.0 = exato, 1.0 = qualquer coisa | 0.6 = balanceado
    includeScore: true,
    ignoreLocation: true, // Ignora posição do termo na string (busca em qualquer lugar)
    minMatchCharLength: 2, // Mínimo 2 caracteres para match
    findAllMatches: true, // Encontra todos os matches, não apenas o primeiro
  });

  const results = fuse.search(query);

  console.log(`[SearchProducts] Encontrados ${results.length} resultados para "${query}"`);
  results.forEach((r, i) => {
    console.log(`[SearchProducts]   ${i + 1}. ${r.item.name} (score: ${r.score?.toFixed(3)})`);
  });

  return results.map(r => r.item);
}

/**
 * Parser de horários - Extrai informações do texto de horário de funcionamento
 * Retorna null se não conseguir parsear (empresa precisa configurar)
 */
function parseWorkingHours(workingHoursText: string | null): {
  weekdayHours: number[];
  saturdayHours: number[];
  sundayHours: number[];
  startHour: number;
  endHour: number;
  configured: boolean;
} | null {

  if (!workingHoursText || workingHoursText.trim() === '') {
    return null; // Não configurado - não assume valores padrão
  }

  try {
    const text = workingHoursText.toLowerCase();

    // Helper para gerar range de horas
    const range = (start: number, end: number) => {
      const h = [];
      for (let i = start; i < end; i++) {
        if (i !== 12 && i !== 13) h.push(i); // Pula almoço padrão
      }
      return h;
    };

    // Regex para capturar "8h as 18h", "08:00 - 18:00", "8 às 18", etc.
    const match = text.match(/(\d{1,2})[h:]?.*(?:às|as|a|-).+?(\d{1,2})[h:]?/);

    if (match) {
      const start = parseInt(match[1]);
      const end = parseInt(match[2]);

      // Validação básica dos horários
      if (start < 0 || start > 23 || end < 0 || end > 23 || start >= end) {
        return null;
      }

      const hours = range(start, end);
      const isSaturday = text.includes('sáb') || text.includes('sab');

      return {
        weekdayHours: hours,
        saturdayHours: isSaturday ? range(start, 12) : [],
        sundayHours: [],
        startHour: start,
        endHour: end,
        configured: true,
      };
    }

    return null; // Não conseguiu parsear o formato
  } catch {
    return null;
  }
}

// ==========================================
// HANDLERS
// ==========================================

/**
 * [TOOL] Buscar Produtos e Serviços
 * Retorna dados estruturados para a IA responder dúvidas
 *
 * MELHORADO: Agora busca em múltiplas fontes e agrupa variações
 */
export async function handleGetProductInfo(args: {
  query: string;
  category?: string;
  companyId: string;
}) {
  try {
    const { query, companyId } = args;

    console.log(`[Tool] GetProductInfo: Buscando "${query}" para company ${companyId}`);

    // =============================================
    // 1. BUSCA NA TABELA SERVICE (COM VARIÁVEIS)
    // =============================================
    let servicesWithVariables: any[] = [];
    try {
      const services = await prisma.service.findMany({
        where: {
          companyId,
          isActive: true,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { category: { contains: query, mode: 'insensitive' } },
          ]
        },
        include: {
          variables: {
            include: {
              options: true
            }
          },
          pricingTiers: true
        },
        take: 10
      });

      if (services.length > 0) {
        console.log(`[Tool] GetProductInfo: Encontrados ${services.length} serviços na tabela Service`);

        servicesWithVariables = services.map(service => {
          // Calcula todas as variações de preço
          const variations: Array<{ name: string; price: number; description?: string }> = [];
          const basePriceNum = Number(service.basePrice);

          if (service.variables && service.variables.length > 0) {
            // Serviço tem variáveis - calcula preço para cada opção
            for (const variable of service.variables) {
              for (const option of variable.options) {
                const priceModifierNum = Number(option.priceModifier);
                const finalPrice = basePriceNum + priceModifierNum;
                variations.push({
                  name: `${service.name} - ${option.name}`,
                  price: finalPrice
                });
              }
            }
          } else {
            // Serviço sem variáveis - preço único
            variations.push({
              name: service.name,
              price: basePriceNum,
              description: service.description || undefined
            });
          }

          return {
            serviceName: service.name,
            category: service.category,
            description: service.description,
            basePrice: basePriceNum,
            hasVariations: variations.length > 1,
            variations: variations,
            pricingTiers: service.pricingTiers?.map(tier => ({
              minQty: tier.minQuantity,
              maxQty: tier.maxQuantity,
              pricePerUnit: Number(tier.pricePerUnit)
            }))
          };
        });
      }
    } catch (error) {
      console.warn('[Tool] GetProductInfo: Erro ao buscar na tabela Service:', error);
    }

    // =============================================
    // 2. BUSCA NO CAMPO PRODUCTS (AIKNOWLEDGE)
    // =============================================
    const aiKnowledge = await prisma.aIKnowledge.findUnique({
      where: { companyId },
    });

    let products: Product[] = [];
    if (aiKnowledge) {
      try {
        const rawProducts = aiKnowledge.products;
        const allProducts = Array.isArray(rawProducts)
          ? rawProducts
          : JSON.parse(typeof rawProducts === 'string' ? rawProducts : '[]');

        // Busca com Fuzzy Search
        products = searchProducts(allProducts, query);
        console.log(`[Tool] GetProductInfo: Encontrados ${products.length} produtos no AIKnowledge`);
      } catch (error) {
        console.error('[Tool] GetProductInfo: Erro ao parsear produtos:', error);
      }
    }

    // =============================================
    // 3. COMBINA E FORMATA RESULTADOS
    // =============================================
    const hasServicesResults = servicesWithVariables.length > 0;
    const hasProductsResults = products.length > 0;

    if (!hasServicesResults && !hasProductsResults) {
      // Tenta fallback no texto legado
      let fallbackInfo = null;
      if (aiKnowledge?.productsServices) {
        const lines = aiKnowledge.productsServices.split('\n');
        const matchedLines = lines.filter(l => l.toLowerCase().includes(query.toLowerCase()));
        if (matchedLines.length > 0) {
          fallbackInfo = matchedLines.slice(0, 5).join('\n');
        }
      }

      console.warn(`[Tool] GetProductInfo: Nenhum resultado para "${query}"`);
      return {
        query,
        found: false,
        services: [],
        products: [],
        fallback_text: fallbackInfo,
        instruction: fallbackInfo
          ? "Encontrei algumas informações no texto complementar. Use com cautela."
          : "Não encontrei produtos/serviços com esse nome. Informe ao cliente que não consta no catálogo e ofereça alternativas."
      };
    }

    // =============================================
    // 4. MONTA RESPOSTA ESTRUTURADA
    // =============================================
    const response: any = {
      query,
      found: true,
      instruction: `IMPORTANTE: Responda ao cliente de forma COMPLETA.

Você DEVE:
1. Explicar O QUE É o serviço/produto
2. Listar TODAS as variações e preços disponíveis
3. Mencionar detalhes da descrição
4. Perguntar qual opção interessa ao cliente

NUNCA dê respostas vagas como "o preço varia". SEMPRE liste os valores!`
    };

    // Adiciona serviços (com variações calculadas)
    if (hasServicesResults) {
      response.services = servicesWithVariables.map(s => ({
        name: s.serviceName,
        category: s.category,
        description: s.description,
        basePrice: `R$ ${s.basePrice.toFixed(2)}`,
        hasVariations: s.hasVariations,
        variations: s.variations.map((v: any) => ({
          option: v.name,
          price: `R$ ${v.price.toFixed(2)}`,
          details: v.description
        })),
        pricingByQuantity: s.pricingTiers?.length > 0 ? s.pricingTiers : undefined
      }));

      // Instrução específica para serviços com variações
      if (servicesWithVariables.some(s => s.hasVariations)) {
        response.instruction += `

FORMATO DE RESPOSTA PARA SERVIÇOS COM VARIAÇÕES:
"[Nome do serviço] - [descrição breve]

Temos as seguintes opções:
• [Variação 1] - R$ XX,XX
• [Variação 2] - R$ XX,XX
• [Variação 3] - R$ XX,XX

Qual opção te interessa?"`;
      }
    }

    // Adiciona produtos do AIKnowledge
    if (hasProductsResults) {
      response.products = products.slice(0, 5).map(p => ({
        name: p.name,
        price: p.price,
        description: p.description || 'Sem descrição',
        category: p.category || 'Geral',
        salesLink: p.salesLink || null
      }));
    }

    console.log(`[Tool] GetProductInfo: Retornando ${servicesWithVariables.length} serviços e ${products.length} produtos`);
    return response;

  } catch (error) {
    console.error('[Tool] GetProductInfo Error:', error);
    return { error: 'Erro ao buscar informações. Tente novamente.' };
  }
}

/**
 * [TOOL] Calcular Orçamento / Preço
 * Retorna valores numéricos para a IA somar
 */
export async function handleCalculateQuote(args: {
  service_type: string; // Ex: "Instalação", "Manutenção" ou nome do produto
  product_specs?: any;
  companyId: string;
}) {
  try {
    const { service_type, companyId } = args;

    const aiKnowledge = await prisma.aIKnowledge.findUnique({
      where: { companyId },
    });

    if (!aiKnowledge) return { error: 'Empresa não encontrada' };

    // Carrega produtos
    let products: Product[] = [];
    try {
      products = JSON.parse(typeof aiKnowledge.products === 'string' ? aiKnowledge.products : '[]');
    } catch { products = []; }

    // Busca o serviço/produto principal
    const results = searchProducts(products, service_type);
    
    if (results.length === 0) {
      return {
        found: false,
        message: "Não encontrei um item com esse nome exato na tabela de preços.",
        action: "Pergunte ao cliente mais detalhes ou ofereça atendimento humano."
      };
    }

    const bestMatch = results[0];
    const price = parsePrice(bestMatch.price?.toString());

    return {
      found: true,
      item: {
        name: bestMatch.name,
        description: bestMatch.description,
        original_price_string: bestMatch.price,
        numeric_price: price, // IMPORTANTE: IA usa isso para contas
        currency: "BRL",
        salesLink: bestMatch.salesLink || null // Link de compra/checkout quando disponível
      },
      disclaimer: "Este valor é baseado na tabela oficial. Custos adicionais de deslocamento ou peças podem aplicar.",
      instruction: bestMatch.salesLink
        ? `Se o cliente quiser comprar, envie o link de venda: ${bestMatch.salesLink}`
        : undefined
    };

  } catch (error) {
    console.error('[Tool] CalculateQuote Error:', error);
    return { error: 'Erro ao calcular orçamento' };
  }
}

/**
 * [TOOL] Ver Disponibilidade de Agenda
 * Retorna APENAS as brechas de tempo (horários livres) dentro do horário de funcionamento
 * Integrado com Google Calendar quando disponível
 */
export async function handleGetAvailableSlots(args: {
  service_type?: string;
  preferred_date?: string;
  companyId: string;
}) {
  try {
    const { preferred_date, companyId, service_type } = args;

    console.log('[Tool] GetAvailableSlots: Iniciando busca');
    console.log('[Tool] GetAvailableSlots: service_type =', service_type || '(não especificado)');
    console.log('[Tool] GetAvailableSlots: preferred_date =', preferred_date || '(próximos 7 dias)');

    // Busca a duração do serviço do catálogo da empresa
    let slotDuration = 60; // Duração padrão de 1 hora
    try {
      const aiKnowledge = await prisma.aIKnowledge.findUnique({
        where: { companyId },
        select: { products: true }
      });

      if (aiKnowledge?.products && service_type) {
        const products = Array.isArray(aiKnowledge.products)
          ? aiKnowledge.products
          : JSON.parse(typeof aiKnowledge.products === 'string' ? aiKnowledge.products : '[]');

        // Busca o serviço pelo nome (case-insensitive)
        const service = products.find((p: any) =>
          p.name?.toLowerCase() === service_type.toLowerCase()
        );

        // Se o serviço tiver duração configurada, usa; senão mantém o padrão
        if (service?.duration) {
          slotDuration = parseInt(service.duration);
          console.log('[Tool] GetAvailableSlots: Duração do serviço encontrada:', slotDuration, 'min');
        }
      }
    } catch (error) {
      console.warn('[Tool] GetAvailableSlots: Erro ao buscar duração do serviço, usando padrão:', error);
    }

    console.log('[Tool] GetAvailableSlots: Buscando horários disponíveis');
    console.log('[Tool] GetAvailableSlots: Serviço:', service_type, '- Duração:', slotDuration, 'min');

    // Busca horários para os próximos 7 dias
    // FIX: Corrigir parsing de preferred_date para interpretar no timezone de São Paulo
    let startDate: Date;
    if (preferred_date) {
      // preferred_date vem em YYYY-MM-DD (ex: "2024-12-26")
      // new Date("2024-12-26") interpreta como UTC, então ajustamos
      const [year, month, day] = preferred_date.split('-').map(Number);
      // Cria no timezone local (depois startOfDay vai ajustar)
      startDate = new Date(year, month - 1, day);
    } else {
      startDate = new Date();
    }

    const allSlots: Array<{ date: string; time: string; datetime: string }> = [];

    for (let i = 0; i < 7; i++) {
      const currentDate = addDays(startOfDay(startDate), i);
      const dayOfWeek = currentDate.getDay();

      // Pula domingo
      if (dayOfWeek === 0) continue;

      try {
        console.log(`[Tool] GetAvailableSlots: Buscando slots para ${format(currentDate, 'dd/MM/yyyy')}`);

        // Usa o appointmentService que já integra Google Calendar + banco local
        const daySlots = await appointmentService.getAvailableSlots(
          companyId,
          currentDate,
          slotDuration
        );

        console.log(`[Tool] GetAvailableSlots: Encontrados ${daySlots.length} slots disponíveis para ${format(currentDate, 'dd/MM/yyyy')}`);

        // Converte para formato amigável para a IA
        daySlots.forEach(slot => {
          if (slot.start > new Date()) { // Apenas slots futuros
            allSlots.push({
              date: format(slot.start, 'dd/MM/yyyy'),
              time: format(slot.start, 'HH:mm'),
              datetime: format(slot.start, "yyyy-MM-dd'T'HH:mm:ss")
            });
          }
        });

        // Limita a 12 slots para não sobrecarregar a resposta
        if (allSlots.length >= 12) break;

      } catch (dayError: any) {
        console.log(`[Tool] GetAvailableSlots: Erro ao buscar dia ${format(currentDate, 'dd/MM/yyyy')}:`, dayError.message);
        // Continua para o próximo dia
      }
    }

    console.log(`[Tool] GetAvailableSlots: Total de ${allSlots.length} slots disponíveis encontrados`);

    if (allSlots.length === 0) {
      return {
        available: false,
        slots: [],
        message: "Não encontrei horários disponíveis nos próximos 7 dias dentro do horário de funcionamento.",
        instruction: "Informe ao cliente que a agenda está cheia. Ofereça contato com atendimento humano para verificar outras opções."
      };
    }

    // Retorna os primeiros 12 slots
    const limitedSlots = allSlots.slice(0, 12);

    return {
      available: true,
      total_slots: limitedSlots.length,
      slots: limitedSlots,
      message: `Encontrei ${limitedSlots.length} horários disponíveis. Estes são horários REAIS e LIVRES na agenda.`,
      instruction: "Apresente os horários de forma clara e natural. Mencione que são horários confirmados sem conflitos na agenda."
    };

  } catch (error: any) {
    console.error('[Tool] GetAvailableSlots Error:', error);
    return {
      error: 'Erro ao buscar horários disponíveis',
      message: 'Não consegui consultar a agenda no momento. Entre em contato para verificar disponibilidade.'
    };
  }
}

/**
 * [TOOL] Políticas da Empresa
 */
export async function handleGetCompanyPolicy(args: {
  policy_type: string;
  companyId: string;
}) {
  const { policy_type, companyId } = args;

  const knowledge = await prisma.aIKnowledge.findUnique({
    where: { companyId },
    select: {
      policies: true,
      paymentMethods: true,
      warrantyInfo: true,
      deliveryInfo: true
    }
  });

  if (!knowledge) return { found: false };

  // Mapeia intenção para campo do banco
  let content = "";
  const type = policy_type.toLowerCase();

  if (type.includes('pagamento')) content = knowledge.paymentMethods || "";
  else if (type.includes('garantia')) content = knowledge.warrantyInfo || "";
  else if (type.includes('entrega') || type.includes('prazo')) content = knowledge.deliveryInfo || "";
  else content = knowledge.policies || "";

  return {
    requested: policy_type,
    content: content || "Informação específica não cadastrada. Consulte o atendimento humano.",
    source: "policies_db"
  };
}

/**
 * [TOOL] Criar Agendamento
 * Cria um agendamento no banco de dados e sincroniza com Google Calendar
 */
export async function handleCreateAppointment(args: {
  service_type: string;
  date: string;
  time: string;
  address: string;
  title: string;
  notes?: string;
  customerId: string;
  companyId: string;
}) {
  try {
    const { service_type, date, time, address, title, notes, customerId, companyId } = args;

    // VALIDAÇÃO: Verificar se o endereço contém um número válido
    // Padrões aceitos: "Rua X, 123", "Rua X 123", "Rua X nº 123", "Rua X número 123"
    const hasValidNumber = /(?:,\s*|\s+)(\d{1,5})(?:\s|$|,)|n[ºo°]?\s*(\d{1,5})|n[úu]mero\s+(\d{1,5})/i.test(address);

    // Verifica se é um número genérico/fictício (apenas "1" ou números muito baixos sem contexto)
    const isFakeNumber = /^[^,\d]*,?\s*1\s*$|rua\s+\w+\s+1\s*$/i.test(address);

    if (!hasValidNumber || isFakeNumber) {
      console.log('[CreateAppointment] ❌ Endereço sem número válido:', address);
      return {
        success: false,
        error: 'ENDERECO_INCOMPLETO',
        message: 'O endereço informado está sem o número. Por favor, pergunte ao cliente qual é o número do endereço (ex: "Qual o número da sua casa/apartamento?") antes de criar o agendamento.',
        address_received: address,
      };
    }

    // Busca a duração do serviço do catálogo da empresa
    let duration = 60; // Duração padrão
    try {
      const aiKnowledge = await prisma.aIKnowledge.findUnique({
        where: { companyId },
        select: { products: true }
      });

      if (aiKnowledge?.products) {
        const products = Array.isArray(aiKnowledge.products)
          ? aiKnowledge.products
          : JSON.parse(typeof aiKnowledge.products === 'string' ? aiKnowledge.products : '[]');

        // Busca o serviço pelo nome (case-insensitive)
        const service = products.find((p: any) =>
          p.name?.toLowerCase() === service_type.toLowerCase()
        );

        // Se o serviço tiver duração configurada, usa; senão mantém o padrão
        if (service?.duration) {
          duration = parseInt(service.duration);
        }
      }
    } catch (error) {
      console.warn('[CreateAppointment] Erro ao buscar duração do serviço, usando padrão:', error);
    }

    // Parse da data e hora no timezone do Brasil (America/Sao_Paulo)
    console.log('[CreateAppointment] Criando agendamento para:', date, time, '(horário de Brasília)');
    console.log('[CreateAppointment] Serviço:', service_type, '- Duração:', duration, 'min');
    const dateTime = createBrazilDate(date, time);
    const endTime = addMinutes(dateTime, duration);

    console.log('[CreateAppointment] Data/hora criada:', dateTime.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
    console.log('[CreateAppointment] Data/hora fim:', endTime.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));

    // Cria o agendamento usando o serviço existente
    // Usa AppointmentType.OTHER e armazena o nome real do serviço no title/description
    const appointment = await appointmentService.create(companyId, {
      customerId,
      title: `${service_type} - ${title}`,
      description: notes || `Serviço: ${service_type}`,
      type: AppointmentType.OTHER,
      startTime: dateTime,
      endTime: endTime,
      duration,
      location: address,
      notes,
    });

    return {
      success: true,
      appointment: {
        id: appointment.id,
        title: appointment.title,
        type: appointment.type,
        date: format(appointment.startTime, 'dd/MM/yyyy'),
        time: format(appointment.startTime, 'HH:mm'),
        duration: `${duration} minutos`,
        address: appointment.location,
        googleCalendarSynced: (appointment as any).googleCalendarSynced || false,
      },
      message: `Agendamento criado com sucesso para ${format(dateTime, "dd/MM/yyyy 'às' HH:mm")}!`,
    };

  } catch (error: any) {
    console.error('[Tool] CreateAppointment Error:', error);

    // Tratamento de erros específicos
    if (error.message.includes('não disponível') || error.message.includes('not available')) {
      return {
        success: false,
        error: 'Horário não disponível. Use get_available_slots para verificar horários livres.'
      };
    }

    if (error.message.includes('não encontrado') || error.message.includes('not found')) {
      return {
        success: false,
        error: 'Cliente não encontrado.'
      };
    }

    return {
      success: false,
      error: error.message || 'Erro ao criar agendamento. Tente novamente.'
    };
  }
}

// ==========================================
// DISPATCHER PRINCIPAL
// ==========================================

export async function executeToolCall(
  toolName: string,
  args: any,
  context: { customerId: string; companyId: string }
) {
  // Injeta contexto nos argumentos
  const fullArgs = { ...args, ...context };

  switch (toolName) {
    case 'get_product_info':
      return handleGetProductInfo(fullArgs);

    case 'calculate_quote':
      return handleCalculateQuote(fullArgs);

    case 'get_available_slots':
      return handleGetAvailableSlots(fullArgs);

    case 'get_company_policy':
      return handleGetCompanyPolicy(fullArgs);

    case 'create_appointment':
      return handleCreateAppointment(fullArgs);

    case 'get_customer_history':
       // Implementação simples mantida ou importada
       return { status: "not_implemented_yet_optimized" };

    default:
      return { error: `Tool ${toolName} not found` };
  }
}