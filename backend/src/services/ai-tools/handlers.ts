import { prisma } from '../../utils/prisma';
import { addDays, format, startOfDay } from 'date-fns';
import Fuse from 'fuse.js'; // npm install fuse.js

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
 * Parser de horários (Mantido e Melhorado)
 */
function parseWorkingHours(workingHoursText: string | null) {
  const defaultHours = {
    weekdayHours: [9, 10, 11, 14, 15, 16, 17],
    saturdayHours: [], // Por segurança, padrão é fechado sábado
    sundayHours: [],
  };

  if (!workingHoursText) return defaultHours;

  try {
    const text = workingHoursText.toLowerCase();
    
    // Helper para gerar range
    const range = (start: number, end: number) => {
      const h = [];
      for (let i = start; i < end; i++) if(i !== 12 && i !== 13) h.push(i); // Pula almoço padrão
      return h;
    };

    // Regex simples para capturar "8h as 18h" ou "08:00 - 18:00"
    const match = text.match(/(\d{1,2})[h:]?.*(?:às|as|a|-).+?(\d{1,2})[h:]?/);
    
    if (match) {
      const start = parseInt(match[1]);
      const end = parseInt(match[2]);
      const hours = range(start, end);

      const isSaturday = text.includes('sáb') || text.includes('sab');
      
      return {
        weekdayHours: hours,
        saturdayHours: isSaturday ? range(start, 12) : [], // Se mencionar sábado, assume manhã
        sundayHours: []
      };
    }
    return defaultHours;
  } catch {
    return defaultHours;
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
 */
export async function handleGetAvailableSlots(args: {
  service_type: string;
  preferred_date?: string;
  companyId: string;
}) {
  try {
    const { preferred_date, companyId } = args;

    const aiKnowledge = await prisma.aIKnowledge.findUnique({
      where: { companyId },
      select: { workingHours: true },
    });

    const { weekdayHours, saturdayHours } = parseWorkingHours(aiKnowledge?.workingHours || null);
    
    const startDate = preferred_date ? new Date(preferred_date) : new Date();
    const slots: string[] = [];
    
    // Gera slots para os próximos 5 dias
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
      message: slots.length === 0 ? "Sem horários nesta data." : "Horários disponíveis encontrados."
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