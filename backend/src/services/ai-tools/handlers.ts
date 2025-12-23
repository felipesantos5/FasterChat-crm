import { prisma } from '../../utils/prisma';
import { addDays, format, startOfDay } from 'date-fns';
import Fuse from 'fuse.js'; // npm install fuse.js
import { googleCalendarService } from '../google-calendar.service';

// ==========================================
// TYPES & INTERFACES
// ==========================================

interface Product {
  name: string;
  price?: string | number;
  description?: string;
  category?: string;
}

interface SearchResult {
  item: Product;
  score?: number;
}

// ==========================================
// HELPERS
// ==========================================

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
 */
function searchProducts(
  products: Product[], 
  query: string, 
  threshold = 0.4
): Product[] {
  if (!products.length) return [];

  const fuse = new Fuse(products, {
    keys: [
      { name: 'name', weight: 0.7 },       // Nome tem prioridade
      { name: 'category', weight: 0.2 },
      { name: 'description', weight: 0.1 }
    ],
    threshold, // 0.0 = exato, 1.0 = qualquer coisa
    includeScore: true
  });

  return fuse.search(query).map(r => r.item);
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
 */
export async function handleGetProductInfo(args: {
  query: string;
  category?: string;
  companyId: string;
}) {
  try {
    const { query, companyId } = args;

    const aiKnowledge = await prisma.aIKnowledge.findUnique({
      where: { companyId },
    });

    if (!aiKnowledge) return { error: 'Dados da empresa não encontrados' };

    // 1. Parse dos produtos do JSON (Fonte da Verdade)
    let products: Product[] = [];
    try {
      products = JSON.parse(typeof aiKnowledge.products === 'string' ? aiKnowledge.products : '[]');
    } catch { 
      products = []; 
    }

    // 2. Busca Inteligente
    const results = searchProducts(products, query);

    // 3. Se não achou no JSON, tenta fallback no texto (menos confiável)
    let fallbackInfo = null;
    if (results.length === 0 && aiKnowledge.productsServices) {
      const lines = aiKnowledge.productsServices.split('\n');
      const matchedLines = lines.filter(l => l.toLowerCase().includes(query.toLowerCase()));
      if (matchedLines.length > 0) {
        fallbackInfo = matchedLines.slice(0, 3).join('\n');
      }
    }

    return {
      query,
      found_structured: results.length > 0,
      products: results.slice(0, 3), // Top 3 resultados
      fallback_text: fallbackInfo,
      instruction: results.length > 0 
        ? "Use os dados estruturados acima para responder." 
        : "Nenhum produto exato encontrado no cadastro oficial. Verifique se o termo está correto."
    };

  } catch (error) {
    console.error('[Tool] GetProductInfo Error:', error);
    return { error: 'Erro ao buscar informações' };
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
        currency: "BRL"
      },
      disclaimer: "Este valor é baseado na tabela oficial. Custos adicionais de deslocamento ou peças podem aplicar."
    };

  } catch (error) {
    console.error('[Tool] CalculateQuote Error:', error);
    return { error: 'Erro ao calcular orçamento' };
  }
}

/**
 * [TOOL] Ver Disponibilidade de Agenda
 * Integrado com Google Calendar quando disponível
 * Usa horários configurados no sistema (nunca valores hardcoded)
 */
export async function handleGetAvailableSlots(args: {
  service_type: string;
  preferred_date?: string;
  companyId: string;
}) {
  try {
    const { preferred_date, companyId } = args;

    // Busca configurações de horário de trabalho do sistema
    const aiKnowledge = await prisma.aIKnowledge.findUnique({
      where: { companyId },
      select: { workingHours: true },
    });

    // Parse dos horários configurados - retorna null se não configurado
    const workingHoursConfig = parseWorkingHours(aiKnowledge?.workingHours || null);

    // ========================================
    // VALIDA SE HORÁRIO DE FUNCIONAMENTO ESTÁ CONFIGURADO
    // ========================================
    if (!workingHoursConfig) {
      console.log('[Tool] GetAvailableSlots: Horário de funcionamento não configurado para empresa:', companyId);
      return {
        available: false,
        slots: [],
        message: "Horário de funcionamento não está configurado. Entre em contato para mais informações.",
        error_type: "working_hours_not_configured"
      };
    }

    const { weekdayHours, saturdayHours, startHour, endHour } = workingHoursConfig;
    const startDate = preferred_date ? new Date(preferred_date) : new Date();

    // ========================================
    // VERIFICA SE GOOGLE CALENDAR ESTÁ CONECTADO
    // ========================================
    let isGoogleCalendarConnected = false;
    try {
      isGoogleCalendarConnected = await googleCalendarService.isConfigured(companyId);
    } catch (error) {
      // Silently fail - não impacta outros atendimentos
      console.log('[Tool] GetAvailableSlots: Erro ao verificar Google Calendar, usando fallback');
      isGoogleCalendarConnected = false;
    }

    // ========================================
    // FLUXO COM GOOGLE CALENDAR CONECTADO
    // ========================================
    if (isGoogleCalendarConnected) {
      console.log('[Tool] GetAvailableSlots: Google Calendar conectado, buscando slots reais...');
      console.log('[Tool] GetAvailableSlots: Horário configurado:', startHour, 'às', endHour);

      try {
        const slots: string[] = [];

        // Busca slots para os próximos 5 dias usando o Google Calendar real
        for (let i = 0; i < 5; i++) {
          const currentDate = addDays(startOfDay(startDate), i);
          const day = currentDate.getDay();

          // Pula domingo (fechado)
          if (day === 0) continue;

          // Define horário comercial baseado no dia (usando config do sistema)
          let businessHours = { start: startHour, end: endHour };
          if (day === 6) {
            // Sábado: usa horário reduzido se configurado
            if (saturdayHours.length === 0) continue; // Sábado fechado
            businessHours = {
              start: Math.min(...saturdayHours),
              end: Math.max(...saturdayHours) + 1
            };
          }

          try {
            // Busca slots REAIS do Google Calendar
            const googleSlots = await googleCalendarService.getAvailableSlots(
              companyId,
              currentDate,
              businessHours,
              60 // duração de 1 hora
            );

            // Converte para formato string
            googleSlots.forEach(slot => {
              if (slot.available && slot.start > new Date()) {
                slots.push(format(slot.start, "yyyy-MM-dd'T'HH:mm:ss"));
              }
            });
          } catch (dayError) {
            console.log(`[Tool] GetAvailableSlots: Erro ao buscar dia ${i}, continuando...`);
            // Continua para o próximo dia em caso de erro
          }
        }

        if (slots.length > 0) {
          return {
            available: true,
            slots: slots.slice(0, 8), // Retorna apenas os 8 primeiros
            message: "Horários disponíveis encontrados (sincronizado com agenda).",
            source: "google_calendar"
          };
        }

        // Se não encontrou slots no Google Calendar, retorna mensagem apropriada
        return {
          available: false,
          slots: [],
          message: "Sem horários disponíveis na agenda para os próximos dias.",
          source: "google_calendar"
        };

      } catch (googleError: any) {
        console.error('[Tool] GetAvailableSlots: Erro no Google Calendar, usando fallback:', googleError.message);
        // Fallback para geração local se Google Calendar falhar
      }
    }

    // ========================================
    // FALLBACK: GERAÇÃO LOCAL (SEM GOOGLE CALENDAR)
    // Usa os horários configurados no sistema
    // ========================================
    console.log('[Tool] GetAvailableSlots: Usando geração local de slots (Google Calendar não conectado)');
    console.log('[Tool] GetAvailableSlots: Horário configurado:', startHour, 'às', endHour);

    const slots: string[] = [];

    // Gera slots para os próximos 5 dias baseado nos horários configurados
    for (let i = 0; i < 5; i++) {
      const currentDate = addDays(startOfDay(startDate), i);
      const day = currentDate.getDay();

      let hours: number[] = [];
      if (day === 0) hours = []; // Domingo fechado
      else if (day === 6) hours = saturdayHours;
      else hours = weekdayHours;

      hours.forEach(h => {
        const slot = new Date(currentDate);
        slot.setHours(h, 0, 0, 0);
        if (slot > new Date()) { // Só futuro
          slots.push(format(slot, "yyyy-MM-dd'T'HH:mm:ss"));
        }
      });
    }

    return {
      available: slots.length > 0,
      slots: slots.slice(0, 8), // Retorna apenas os 8 primeiros para não poluir o contexto
      message: slots.length === 0 ? "Sem horários nesta data." : "Horários disponíveis encontrados.",
      source: "local_fallback"
    };

  } catch (error) {
    console.error('[Tool] GetAvailableSlots Error:', error);
    return { error: 'Erro ao buscar agenda' };
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

    case 'get_customer_history':
       // Implementação simples mantida ou importada
       return { status: "not_implemented_yet_optimized" }; 

    default:
      return { error: `Tool ${toolName} not found` };
  }
}