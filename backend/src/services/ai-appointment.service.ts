import { prisma } from '../utils/prisma';
import { appointmentService } from './appointment.service';
import { AppointmentType } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { conversationContextService } from './conversation-context.service';

/**
 * Cria uma data no timezone do Brasil (America/Sao_Paulo)
 *
 * ABORDAGEM SIMPLIFICADA:
 * - Cria a Date diretamente usando o offset de São Paulo (-03:00)
 * - Evita conversões desnecessárias que causam bugs de timezone
 * - O Google Calendar receberá a data no formato correto
 */
function createBrazilDateTime(dateString: string, timeString: string): Date {
  // São Paulo está em UTC-3
  const SAO_PAULO_OFFSET = '-03:00';
  const isoString = `${dateString}T${timeString}:00${SAO_PAULO_OFFSET}`;
  return new Date(isoString);
}

/**
 * Variação de serviço disponível no catálogo
 */
interface ServiceVariation {
  name: string;
  price: string;
  duration?: number;
  description?: string;
}

/**
 * Serviço disponível para agendamento (cadastrado no sistema)
 */
interface AvailableService {
  id: string;
  name: string;
  price: string;
  duration: number;
  category?: string;
}

/**
 * Estado do processo de agendamento
 */
interface AppointmentState {
  step: 'SELECTING_SERVICE' | 'COLLECTING_TYPE' | 'SELECTING_SERVICE_VARIATION' | 'COLLECTING_DATE' | 'COLLECTING_TIME' | 'COLLECTING_ADDRESS' | 'CONFIRMING' | 'COMPLETED';
  serviceType?: AppointmentType;
  serviceName?: string; // Nome real do serviço (ex: "Instalação de Ar Condicionado 12000 BTUs")
  servicePrice?: string; // Preço do serviço (ex: "R$ 350,00")
  serviceId?: string; // ID do serviço selecionado (quando dinâmico)
  serviceVariations?: ServiceVariation[]; // Variações disponíveis quando há múltiplos serviços do mesmo tipo
  availableServices?: AvailableService[]; // Serviços disponíveis para seleção dinâmica
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  duration?: number; // minutos
  description?: string;
  availableSlots?: Array<{ start: Date; end: Date }>;
  currentSlotPage?: number; // Controla qual "página" de slots está mostrando (0 = primeiros 6, 1 = próximos 6, etc.)
  createdAt?: string; // ISO timestamp para expiração

  // Dados de endereço
  address?: {
    cep?: string;
    street?: string;
    number?: string;
    complement?: string; // Apartamento, bloco, etc.
    neighborhood?: string;
    city?: string;
    state?: string;
  };
}

/**
 * Resultado da detecção múltipla de dados da mensagem
 */
interface DetectedAppointmentData {
  serviceType: AppointmentType | null;
  date: string | null;
  time: string | null;
  address: {
    cep?: string;
    street?: string;
    number?: string;
    complement?: string;
  } | null;
}

export class AIAppointmentService {
  // Constante para expiração de estado (24 horas)
  private readonly STATE_EXPIRATION_MS = 24 * 60 * 60 * 1000;

  /**
   * Verifica se existe fluxo de agendamento ativo
   */
  async hasActiveAppointmentFlow(customerId: string): Promise<boolean> {
    const state = await this.getAppointmentState(customerId);
    return state !== null;
  }

  /**
   * 🆕 DETECÇÃO MÚLTIPLA: Extrai todos os dados possíveis de uma única mensagem
   *
   * Exemplo: "Quero agendar instalação amanhã às 14h na Rua das Flores, 123"
   * Retorna: { serviceType: INSTALLATION, date: "2025-01-03", time: "14:00", address: { street: "Rua das Flores", number: "123" } }
   */
  detectAllFromMessage(message: string): DetectedAppointmentData {
    return {
      serviceType: this.detectServiceType(message),
      date: this.detectDate(message),
      time: this.detectTime(message),
      address: this.detectAddressFromMessage(message),
    };
  }

  /**
   * Detecta endereço completo de uma mensagem
   *
   * Reconhece padrões como:
   * - "Rua das Flores, 123"
   * - "Av. Brasil 456 apto 12"
   * - "na Rua X número 789"
   * - CEP: "12345-678"
   */
  detectAddressFromMessage(message: string): DetectedAppointmentData['address'] | null {
    const address: DetectedAppointmentData['address'] = {};
    let hasAnyData = false;

    // Detecta CEP primeiro
    const cep = this.detectCEP(message);
    if (cep) {
      address.cep = cep;
      hasAnyData = true;
    }

    // Detecta complemento (apartamento, bloco)
    const complement = this.detectComplement(message);
    if (complement) {
      address.complement = complement;
      hasAnyData = true;
    }

    // PRIORIDADE: Detecta rua + número junto (formato mais comum)
    const streetWithNumberPatterns = [
      /(?:rua|r\.?|avenida|av\.?|alameda|al\.?|travessa|tv\.?|praça|pç\.?)\s+([a-zà-ÿ\s]+?),\s*(\d{1,5})/i,
      /(?:rua|r\.?|avenida|av\.?|alameda|al\.?|travessa|tv\.?|praça|pç\.?)\s+([a-zà-ÿ\s]+?)\s+(\d{1,5})(?:\s|,|$)/i,
      /(?:na|em|no)\s+(?:rua|r\.?|avenida|av\.?|alameda)\s+([a-zà-ÿ\s]+?)[\s,]*(?:n[ºo°úu]mero|n[ºo°]?)\s*(\d{1,5})/i,
      /([a-zà-ÿ]{3,}(?:\s+[a-zà-ÿ]+)*),\s*(\d{1,5})(?:\s|,|$)/i,
      /([a-zà-ÿ]{3,}(?:\s+[a-zà-ÿ]+)*)\s+(\d{1,5})$/i,
    ];

    for (const pattern of streetWithNumberPatterns) {
      const match = message.match(pattern);
      if (match) {
        const potentialStreet = match[1].trim();
        const number = match[2];

        if (potentialStreet.length > 3 && !potentialStreet.match(/^\d+$/)) {
          const ignoreWords = ['quero', 'agendar', 'marcar', 'instalar', 'instalação', 'manutenção', 'às', 'dia', 'hora', 'amanhã', 'hoje'];
          const isIgnoredWord = ignoreWords.some(word => potentialStreet.toLowerCase().includes(word));

          if (!isIgnoredWord) {
            address.street = potentialStreet;
            address.number = number;
            hasAnyData = true;
            break;
          }
        }
      }
    }

    // Fallback: Se não detectou junto, tenta detectar número isolado
    if (!address.number) {
      const number = this.detectAddressNumber(message);
      if (number) {
        address.number = number;
        hasAnyData = true;
      }
    }

    return hasAnyData ? address : null;
  }

  /**
   * 🆕 Determina o próximo step baseado nos dados já coletados
   */
  private determineNextStep(state: AppointmentState): AppointmentState['step'] {
    // Precisa ter identificado o serviço (nome específico OU tipo genérico)
    if (!state.serviceName && !state.serviceType) {
      return 'SELECTING_SERVICE'; // Tenta selecionar da lista primeiro
    }
    if (!state.date) return 'COLLECTING_DATE';
    if (!state.time) return 'COLLECTING_TIME';

    // Verifica se endereço está completo
    const addressValidation = this.validateAddress(state.address);
    if (!addressValidation.valid) return 'COLLECTING_ADDRESS';

    return 'CONFIRMING';
  }

  /**
   * 🆕 Gera resposta dinâmica baseada no que já foi detectado
   */
  private generateSmartResponse(state: AppointmentState, detected: DetectedAppointmentData): string {
    const parts: string[] = [];

    // Reconhece o que foi detectado
    if (detected.serviceType) {
      parts.push(`📋 ${this.getServiceTypeLabel(detected.serviceType)}`);
    }
    if (detected.date) {
      const dateObj = new Date(detected.date);
      const dateFormatted = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
      parts.push(`📅 ${dateFormatted}`);
    }
    if (detected.time) {
      parts.push(`🕐 ${detected.time}`);
    }
    if (detected.address?.street) {
      let addr = detected.address.street;
      if (detected.address.number) addr += `, ${detected.address.number}`;
      parts.push(`📍 ${addr}`);
    }

    let response = '';

    if (parts.length > 0) {
      response = `Show! Já entendi:\n${parts.join('\n')}\n\n`;
    }

    // Adiciona pergunta sobre o que falta
    const nextStep = this.determineNextStep(state);

    switch (nextStep) {
      case 'SELECTING_SERVICE':
      case 'COLLECTING_TYPE':
        response += `Qual serviço você precisa?`;
        break;
      case 'COLLECTING_DATE':
        response += `Qual dia é melhor pra você?`;
        break;
      case 'COLLECTING_TIME':
        response += `Vou buscar os horários disponíveis...`;
        break;
      case 'COLLECTING_ADDRESS':
        response += `Agora só preciso do endereço completo 📍`;
        break;
      case 'CONFIRMING':
        response += `Tá tudo certo?`;
        break;
    }

    return response;
  }

  /**
   * Inicia um novo fluxo de agendamento
   *
   * 🆕 FLUXO INTELIGENTE: Detecta todos os dados possíveis da mensagem inicial
   * e pula direto para a etapa necessária, tornando o processo mais rápido.
   *
   * Exemplo: "Quero agendar instalação amanhã às 14h na Rua X, 123"
   * → Detecta tudo e vai direto para confirmação!
   */
  async startAppointmentFlow(
    customerId: string,
    companyId: string,
    message: string
  ): Promise<{ response?: string }> {
    // Verificação se Google Calendar está configurado
    const { googleCalendarService } = await import('./google-calendar.service');
    await googleCalendarService.isConfigured(companyId);

    // Busca serviços disponíveis
    const availableServices = await this.getAvailableServicesForCompany(companyId);

    // 🆕 DETECÇÃO MÚLTIPLA: Extrai todos os dados possíveis de uma vez
    const detected = this.detectAllFromMessage(message);

    // Monta o estado inicial com tudo que foi detectado
    const state: AppointmentState = {
      step: 'SELECTING_SERVICE', // Começa tentando selecionar serviço específico
      createdAt: new Date().toISOString(), // Para expiração
    };

    // Aplica dados detectados ao estado
    if (detected.date) {
      state.date = detected.date;
    }
    // 🚨 NÃO aplicar horário automaticamente - cliente DEVE escolher da lista
    // O horário detectado será usado apenas para sugerir/validar
    if (detected.address) {
      state.address = detected.address;
    }

    // Contexto inteligente: Analisa histórico da conversa para detectar serviço de interesse
    let contextServiceId: string | null = null;
    try {
      const conversationContext = await conversationContextService.analyzeConversationContext(
        customerId,
        companyId,
        message
      );

      if (conversationContext.detectedService && conversationContext.detectedService.confidence >= 0.3) {
        contextServiceId = conversationContext.detectedService.serviceId;
      }
    } catch (contextError) {
      // Silently continue without context
    }

    // Tenta identificar serviço específico da lista cadastrada
    let matchedService: AvailableService | null = null;

    if (availableServices.length > 0) {
      // Primeiro tenta match direto na mensagem atual
      matchedService = this.matchServiceFromMessage(message, availableServices);

      // Se não encontrou na mensagem, usa o contexto da conversa
      if (!matchedService && contextServiceId) {
        const contextMatch = availableServices.find(s => s.id === contextServiceId);
        if (contextMatch) {
          matchedService = contextMatch;
        }
      }

      if (matchedService) {
        state.serviceId = matchedService.id;
        state.serviceName = matchedService.name;
        state.servicePrice = matchedService.price;
        state.duration = matchedService.duration;
        state.serviceType = AppointmentType.OTHER;
      }
    }

    // Se identificou serviço específico, ajusta o próximo step
    if (matchedService) {
      // Determina próximo step baseado no que já foi detectado
      if (state.date && !state.time) {
        state.step = 'COLLECTING_TIME';
      } else {
        state.step = this.determineNextStep(state);
      }
    } else if (availableServices.length > 0) {
      // Tem serviços mas não identificou qual - mostra lista
      state.availableServices = availableServices;
      state.step = 'SELECTING_SERVICE';
    } else {
      // Fallback: Usa detecção de tipo genérico (modo antigo)
      if (detected.serviceType) {
        state.serviceType = detected.serviceType;
        state.duration = this.getDefaultDuration(detected.serviceType);
        await this.enrichStateWithCatalogInfo(state, companyId, message);
      }

      if (state.serviceType && state.date && !state.time) {
        state.step = 'COLLECTING_TIME';
      } else {
        state.step = this.determineNextStep(state);
      }
    }

    // CENÁRIO 1: Identificou serviço + data → Buscar e mostrar horários disponíveis
    if ((state.serviceName || state.serviceType) && state.date && state.step === 'COLLECTING_TIME') {
      // Busca horários disponíveis
      const selectedDate = new Date(state.date);
      try {
        const slots = await appointmentService.getAvailableSlots(companyId, selectedDate, state.duration || 60);

        if (slots.length === 0) {
          // Dia lotado, volta pra pedir outra data
          state.date = undefined;
          state.step = 'COLLECTING_DATE';
          await this.saveAppointmentState(customerId, state);

          const serviceLabel = state.serviceName || this.getServiceTypeLabel(state.serviceType);
          return {
            response: `Entendi! ${serviceLabel} anotado 👍\n\nMas putz, esse dia tá sem horários disponíveis 😔\n\nTem outro dia que funciona pra você?`
          };
        }

        state.availableSlots = slots;
        state.currentSlotPage = 0;

        // Se detectou hora, verifica se está disponível
        if (detected.time) {
          const matchingSlot = slots.find(slot => this.slotToTimeString(slot.start) === detected.time);

          if (matchingSlot) {
            // Horário disponível! Pula pra endereço ou confirmação
            state.time = detected.time;
            state.step = this.determineNextStep(state);

            await this.saveAppointmentState(customerId, state);

            if (state.step === 'CONFIRMING') {
              return await this.sendConfirmation(customerId, state);
            }

            const serviceLabel = state.serviceName || this.getServiceTypeLabel(state.serviceType);
            const dateFormatted = selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

            return {
              response: `Show! Tudo anotado:\n📋 ${serviceLabel}\n📅 ${dateFormatted}\n🕐 ${state.time}\n\nAgora só preciso do endereço completo onde vou fazer o serviço 📍`
            };
          }
        }

        await this.saveAppointmentState(customerId, state);

        // Mostra horários disponíveis
        const serviceLabel = state.serviceName || this.getServiceTypeLabel(state.serviceType);
        const dateFormatted = selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

        const slotsToShow = slots.slice(0, 6);
        const slotsText = slotsToShow
          .map((slot, index) => `${index + 1}️⃣ ${this.slotToTimeString(slot.start)}`)
          .join('\n');

        let response = `Beleza! ${serviceLabel} pra ${dateFormatted} 👍\n\n`;

        if (detected.time) {
          response += `O horário ${detected.time} não tá disponível, mas tenho esses:\n\n`;
        } else {
          response += `Horários disponíveis:\n\n`;
        }

        response += `${slotsText}\n\nQual desses é melhor pra você?`;

        if (slots.length > 6) {
          response += `\n\n💡 Tenho mais ${slots.length - 6} horários. Fala "mais tarde" pra ver mais opções`;
        }

        return { response };
      } catch (error) {
        console.error('[AIAppointment] Erro ao buscar horários:', error);
        state.step = 'COLLECTING_DATE';
        await this.saveAppointmentState(customerId, state);

        return {
          response: `Opa, tive um problema ao buscar os horários 😅\n\nPode me falar o dia novamente?`
        };
      }
    }

    // 🆕 CENÁRIO 2: Identificou serviço específico → Pede a data
    if ((state.serviceName || state.serviceType) && state.step === 'COLLECTING_DATE') {
      await this.saveAppointmentState(customerId, state);

      const serviceLabel = state.serviceName || this.getServiceTypeLabel(state.serviceType!);
      const priceInfo = state.servicePrice && state.servicePrice !== 'Consultar' ? ` (${state.servicePrice})` : '';
      return {
        response: `Perfeito! ${serviceLabel}${priceInfo} anotado 👍\n\nQual dia fica bom pra você?`
      };
    }

    // 🆕 CENÁRIO 3: Precisa selecionar serviço da lista
    if (state.step === 'SELECTING_SERVICE' && state.availableServices && state.availableServices.length > 0) {
      await this.saveAppointmentState(customerId, state);

      const servicesText = this.formatServicesForDisplay(state.availableServices);
      return {
        response: `Show! Posso agendar pra você sim 😊\n\nQual serviço você precisa?\n\n${servicesText}\n\nÉ só me dizer qual!`
      };
    }

    // 🆕 CENÁRIO 4: Fallback - modo antigo (sem serviços cadastrados)
    if (state.step === 'COLLECTING_TYPE') {
      await this.saveAppointmentState(customerId, state);

      return {
        response: `Show! Posso agendar pra você sim 😊\n\nQue tipo de serviço você precisa? Me conta o que está precisando!`
      };
    }

    // Se chegou aqui, redireciona para o step apropriado
    await this.saveAppointmentState(customerId, state);
    return { response: this.generateSmartResponse(state, detected) };
  }

  /**
   * Detecta se a mensagem do cliente indica intenção de agendamento
   *
   * ⚠️ REGRA: Detecta intenção quando o cliente EXPLICITAMENTE pede para agendar.
   * Perguntas, dúvidas, solicitações de informação NÃO são intenção de agendamento.
   */
  detectAppointmentIntent(message: string): boolean {
    const lowerMessage = message.toLowerCase();

    // 🚫 BLOQUEIO PRIORITÁRIO: Perguntas e dúvidas NUNCA são intenção de agendamento
    const questionIndicators = [
      'qual o preço', 'quanto custa', 'quanto é', 'quanto fica',
      'quais serviços', 'que serviços',
      'vocês fazem', 'voces fazem', 'vocês tem', 'voces tem',
      'me fala', 'me diz', 'pode falar', 'pode me dizer', 'pode me falar',
      'gostaria de saber', 'queria saber', 'quero saber',
      'me explica', 'explica', 'explicar',
      'informação sobre', 'informações sobre', 'informacao sobre', 'informacoes sobre',
      'dúvida', 'duvida', 'dúvidas', 'duvidas',
      'como funciona', 'o que é'
    ];

    // Se detectar indicador de pergunta SEM palavra de agendamento, NÃO é agendamento
    const hasQuestionIndicator = questionIndicators.some(word => lowerMessage.includes(word));

    // ✅ Palavras que indicam intenção de agendamento
    const explicitAppointmentKeywords = [
      // Verbos de agendamento
      'quero agendar', 'quero marcar', 'quero fazer',
      'gostaria de agendar', 'gostaria de marcar',
      'preciso agendar', 'preciso marcar', 'preciso de',
      'vou agendar', 'vou marcar',
      'posso agendar', 'posso marcar',
      'queria agendar', 'queria marcar',
      'agendar uma', 'marcar uma', 'agendar um', 'marcar um',
      'fazer um agendamento', 'fazer uma marcação',
      'agendar horário', 'marcar horário',
      'agendar visita', 'marcar visita',
      'quero um horário', 'quero horário',
      'preciso de um horário',
      // Serviços com intenção implícita
      'quero instalação', 'quero uma instalação', 'quero instalar',
      'quero manutenção', 'quero uma manutenção',
      'preciso de instalação', 'preciso de uma instalação',
      'preciso de manutenção', 'preciso de uma manutenção',
      'preciso instalar', 'preciso fazer instalação',
      'quero fazer instalação', 'quero fazer manutenção',
      // Padrões naturais
      'marca pra mim', 'marca ai', 'agenda pra mim', 'agenda ai',
      'pode agendar', 'pode marcar',
      'bora agendar', 'bora marcar',
      'vamos agendar', 'vamos marcar',
      'fechar um horário', 'fechar horário',
      'reservar horário', 'reservar um horário'
    ];

    // Se tem palavra explícita de agendamento, É intenção clara
    if (explicitAppointmentKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return true;
    }

    // Se é só pergunta sem intenção de agendamento, retorna false
    if (hasQuestionIndicator) {
      return false;
    }

    // Mais nada! Se não tem palavra EXPLÍCITA de agendamento, retorna false
    return false;
  }

  /**
   * Detecta o tipo de serviço da mensagem
   */
  detectServiceType(message: string): AppointmentType | null {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.match(/instala(r|ção|cao|çao)/)) {
      return AppointmentType.INSTALLATION;
    }
    if (lowerMessage.match(/manuten(ção|cao|çao)|preventiva/)) {
      return AppointmentType.MAINTENANCE;
    }
    if (lowerMessage.match(/repar(o|ação|acao|ar)|consert(o|ar)|corretiva|limpeza|higieniza(ção|cao)/)) {
      // Reparo, conserto e limpeza são categorizados como "OTHER"
      return AppointmentType.OTHER;
    }
    if (lowerMessage.match(/consult(a|oria)|orçamento|visita técnica|vistoria|visita/)) {
      return AppointmentType.CONSULTATION;
    }

    return null;
  }

  /**
   * Detecta data na mensagem
   * IMPORTANTE: Sempre trabalha no timezone do Brasil para evitar bugs de timezone
   *
   * Detecta:
   * - "hoje", "amanhã"
   * - "dia 2", "dia 15", "no dia 3"
   * - "segunda-feira", "terça", etc.
   * - "10/12", "10/12/2025"
   * - "semana que vem", "próxima semana"
   */
  detectDate(message: string): string | null {
    const timeZone = 'America/Sao_Paulo';
    const lowerMessage = message.toLowerCase();

    // Pega a data ATUAL no timezone do Brasil (não UTC!)
    const nowInBrazil = new Date(formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd HH:mm:ss'));

    // Amanhã
    if (lowerMessage.includes('amanhã') || lowerMessage.includes('amanha')) {
      const tomorrow = new Date(nowInBrazil);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const result = format(tomorrow, 'yyyy-MM-dd');
      return result;
    }

    // Hoje
    if (lowerMessage.includes('hoje')) {
      const result = format(nowInBrazil, 'yyyy-MM-dd');
      return result;
    }

    // Formato DD/MM ou DD/MM/YYYY
    const dateMatch = message.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]) - 1; // JS months are 0-indexed
      const year = dateMatch[3]
        ? (dateMatch[3].length === 2 ? 2000 + parseInt(dateMatch[3]) : parseInt(dateMatch[3]))
        : nowInBrazil.getFullYear();

      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        const result = format(date, 'yyyy-MM-dd');
        return result;
      }
    }

    // 🆕 Detecta "dia X" em vários formatos:
    // "dia 12", "Dia 12", "no dia 3", "pro dia 10", "pode ser dia 12", "quero dia 5"
    // O regex é bem flexível - procura "dia" seguido de um número
    const dayOnlyMatch = lowerMessage.match(/dia\s+(\d{1,2})(?:\b|$)/);
    if (dayOnlyMatch) {
      const dayNumber = parseInt(dayOnlyMatch[1]);

      // Validação básica do dia (1-31)
      if (dayNumber >= 1 && dayNumber <= 31) {
        let targetDate = new Date(nowInBrazil);
        targetDate.setDate(dayNumber);

        // Se o dia já passou neste mês, vai pro próximo mês
        if (targetDate <= nowInBrazil) {
          targetDate.setMonth(targetDate.getMonth() + 1);
          targetDate.setDate(dayNumber);
        }

        // Verifica se o dia existe no mês alvo (ex: 31 de fevereiro não existe)
        if (targetDate.getDate() !== dayNumber) {
          // Dia inválido para o mês, tenta próximo mês válido
          targetDate.setMonth(targetDate.getMonth() + 1);
          targetDate.setDate(dayNumber);
        }

        const result = format(targetDate, 'yyyy-MM-dd');

        return result;
      }
    }

    // Dias da semana - CORRIGIDO: mapeia corretamente para getDay()
    const weekdayMap: { [key: string]: number } = {
      'domingo': 0,
      'segunda': 1,
      'terca': 2,
      'terça': 2,
      'quarta': 3,
      'quinta': 4,
      'sexta': 5,
      'sabado': 6,
      'sábado': 6
    };

    for (const [weekdayName, weekdayIndex] of Object.entries(weekdayMap)) {
      if (lowerMessage.includes(weekdayName)) {
        const todayWeekday = nowInBrazil.getDay();
        let daysUntil = weekdayIndex - todayWeekday;

        // Se o dia já passou nesta semana, pega na próxima
        if (daysUntil <= 0) {
          daysUntil += 7;
        }

        const targetDate = new Date(nowInBrazil);
        targetDate.setDate(targetDate.getDate() + daysUntil);

        const result = format(targetDate, 'yyyy-MM-dd');


        return result;
      }
    }

    // 🆕 NOVO: Detecta "semana que vem" ou "próxima semana" (assume segunda-feira)
    if (lowerMessage.includes('semana que vem') || lowerMessage.includes('proxima semana') || lowerMessage.includes('próxima semana')) {
      const todayWeekday = nowInBrazil.getDay();
      // Segunda-feira da próxima semana
      const daysUntilMonday = todayWeekday === 0 ? 1 : 8 - todayWeekday;

      const targetDate = new Date(nowInBrazil);
      targetDate.setDate(targetDate.getDate() + daysUntilMonday);

      const result = format(targetDate, 'yyyy-MM-dd');
      return result;
    }

    return null;
  }

  /**
   * Detecta horário na mensagem
   *
   * 🆕 DETECÇÃO ROBUSTA: Reconhece múltiplos formatos de horário
   *
   * Exemplos reconhecidos:
   * - "14h", "14:00", "14h30"
   * - "às 14", "as 14 horas"
   * - "2 da tarde", "10 da manhã"
   * - "2 e meia", "3 e 15"
   * - "meio dia", "meia noite"
   */
  detectTime(message: string): string | null {
    const lowerMessage = message.toLowerCase();

    // 🆕 Padrão especial: "meio dia" ou "meia noite"
    if (lowerMessage.includes('meio dia') || lowerMessage.includes('meio-dia')) {
      return '12:00';
    }
    if (lowerMessage.includes('meia noite') || lowerMessage.includes('meia-noite')) {
      return '00:00';
    }

    // 🆕 Padrão: "X e meia" ou "X e Y" (ex: "2 e meia", "3 e 15")
    const halfHourMatch = lowerMessage.match(/(\d{1,2})\s*(?:e\s*meia|e\s*30)/);
    if (halfHourMatch) {
      let hour = parseInt(halfHourMatch[1]);
      // Se hora < 7, provavelmente é da tarde (2 e meia = 14:30)
      if (hour < 7) hour += 12;
      return `${hour.toString().padStart(2, '0')}:30`;
    }

    const quarterMatch = lowerMessage.match(/(\d{1,2})\s*e\s*(\d{1,2})/);
    if (quarterMatch) {
      let hour = parseInt(quarterMatch[1]);
      const minute = parseInt(quarterMatch[2]);
      if (minute <= 59) {
        // Se hora < 7, provavelmente é da tarde
        if (hour < 7) hour += 12;
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      }
    }

    // Formato HH:mm ou HHhMM ou "Hh"
    const timeMatch = message.match(/(\d{1,2})[h:](\d{2})|(\d{1,2})h(?!\d)/i);
    if (timeMatch) {
      const hour = timeMatch[1] || timeMatch[3];
      const minute = timeMatch[2] || '00';
      return `${hour.padStart(2, '0')}:${minute}`;
    }

    // Padrões como "as 10", "às 14", "10 horas", "pras 14"
    const simpleTimeMatch = lowerMessage.match(/(?:as|às|pras|para as)\s+(\d{1,2})|(\d{1,2})\s*(?:horas?|hrs?)/);
    if (simpleTimeMatch) {
      let hour = parseInt(simpleTimeMatch[1] || simpleTimeMatch[2]);
      // Se hora < 7 e não tem indicador de manhã, assume tarde
      if (hour < 7 && !lowerMessage.includes('manh')) {
        hour += 12;
      }
      return `${hour.toString().padStart(2, '0')}:00`;
    }

    // Apenas número seguido de período do dia: "10 da manhã", "2 da tarde"
    const periodTimeMatch = lowerMessage.match(/(\d{1,2})\s*(?:da|de)?\s*(manh[ãa]|tarde|noite)/);
    if (periodTimeMatch) {
      let hour = parseInt(periodTimeMatch[1]);
      const period = periodTimeMatch[2];

      // Ajusta hora baseado no período
      if (period.includes('tarde') && hour < 12) {
        hour += 12;
      } else if (period.includes('noite') && hour < 12) {
        hour += 12;
      }

      return `${hour.toString().padStart(2, '0')}:00`;
    }

    // Períodos do dia genéricos (sem hora específica) - só usa se não tem hora específica
    // Verifica se não tem número na mensagem para evitar falsos positivos
    const hasNumber = /\d/.test(message);
    if (!hasNumber) {
      // IMPORTANTE: Não detectar "manhã" se a mensagem contém "amanhã" (falso positivo)
      const isAmanha = lowerMessage.includes('amanhã') || lowerMessage.includes('amanha');

      if (!isAmanha && (lowerMessage.includes('manhã') || lowerMessage.includes('manha'))) {
        return '09:00';
      }
      if (lowerMessage.includes('tarde')) {
        return '14:00';
      }
      if (lowerMessage.includes('noite')) {
        return '18:00';
      }
    }

    return null;
  }

  /**
   * Detecta CEP na mensagem (formato: 12345-678 ou 12345678)
   */
  detectCEP(message: string): string | null {
    const cepMatch = message.match(/\b(\d{5})-?(\d{3})\b/);
    if (cepMatch) {
      return `${cepMatch[1]}-${cepMatch[2]}`;
    }
    return null;
  }

  /**
   * Detecta número de endereço na mensagem
   *
   * Detecta padrões como:
   * - "Rua das Flores, 123"
   * - "Av. Brasil 456"
   * - "número 789"
   * - "nº 100"
   * - "123" (número isolado)
   */
  detectAddressNumber(message: string): string | null {

    const patterns = [
      // "número 123", "numero 123"
      /\bn[úu]mero\s+(\d{1,5})/i,
      // "nº 123", "n° 123", "n 123"
      /\bn[ºo°]?\s+(\d{1,5})/i,
      // Número após vírgula: "Rua X, 123" ou "Rua X , 123"
      /,\s*(\d{1,5})(?:\s|,|$|[^0-9])/,
      // Número após nome de rua/avenida com espaço: "Rua das Flores 123"
      /(?:rua|avenida|av\.?|alameda|travessa|praça)\s+[a-zà-ÿ\s]+?\s+(\d{1,5})(?:\s|,|$|[^0-9])/i,
      // Número no final da mensagem (mais restrito)
      /\b(\d{1,5})\s*$/,
      // Número isolado completo (quando cliente só manda o número)
      /^(\d{1,5})$/,
    ];

    // Remove espaços extras e converte para minúsculas
    const trimmedMessage = message.trim().toLowerCase();

    // Palavras que indicam que NÃO é um número de endereço
    const excludeKeywords = ['amanhã', 'hoje', 'semana', 'mês', 'ano', 'dia', 'hora', 'às', 'as', 'horário', 'horario', 'manhã', 'tarde', 'noite'];

    // Se a mensagem contém apenas palavras que não são endereço, retorna null
    const hasOnlyNonAddressWords = excludeKeywords.some(keyword =>
      trimmedMessage === keyword || (trimmedMessage.includes(keyword) && trimmedMessage.length < 20)
    );

    if (hasOnlyNonAddressWords) {
      return null;
    }

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = message.match(pattern);
      if (match && match[1]) {
        const num = parseInt(match[1]);


        // Ignora números muito grandes (provavelmente CEP ou telefone)
        // e números inválidos (0 ou muito grandes)
        if (num > 0 && num < 100000) {
          return match[1];
        } else {
        }
      }
    }

    return null;
  }

  /**
   * Detecta complemento (apartamento, bloco, etc.)
   */
  detectComplement(message: string): string | null {
    // Padrões comuns: "ap 101", "apto 101", "apartamento 101", "bloco A"
    const patterns = [
      /\bap(?:to?)?\s*(\d+[a-z]?)/i,
      /\bapartamento\s+(\d+[a-z]?)/i,
      /\bbloco\s+([a-z0-9]+)/i,
      /\bsala\s+(\d+)/i,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[0]; // Retorna a correspondência completa
      }
    }

    return null;
  }

  /**
   * Valida se o endereço está completo
   */
  validateAddress(address: AppointmentState['address']): { valid: boolean; missing: string[] } {
    const missing: string[] = [];

    if (!address?.cep && !address?.street) {
      missing.push('CEP ou endereço completo');
    }

    // Valida número: não pode ser vazio
    if (!address?.number) {
      missing.push('número');
    } else if (address.number === '1' && !address.street && !address.cep) {
      // APENAS rejeita "1" se NÃO tiver nenhum contexto de endereço
      // Se tem rua OU CEP, aceita o número 1 (pode ser endereço real)
      missing.push('número (por favor confirme o número correto)');
    }

    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * Converte um slot (Date ou string) para horário formatado
   */
  private slotToTimeString(slot: Date | string): string {
    const date = typeof slot === 'string' ? new Date(slot) : slot;
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Busca o estado de agendamento para um cliente
   *
   * 🆕 EXPIRAÇÃO: Estados com mais de 24 horas são automaticamente limpos
   * para evitar estados "travados" indefinidamente
   */
  async getAppointmentState(customerId: string): Promise<AppointmentState | null> {
    const conversation = await prisma.conversation.findUnique({
      where: { customerId },
      select: { appointmentState: true, updatedAt: true },
    });

    if (!conversation?.appointmentState) {
      return null;
    }

    const state = conversation.appointmentState as unknown as AppointmentState;

    // 🆕 VERIFICAÇÃO DE EXPIRAÇÃO (24 horas)
    const stateCreatedAt = state.createdAt ? new Date(state.createdAt) : conversation.updatedAt;
    const stateAge = Date.now() - new Date(stateCreatedAt).getTime();

    if (stateAge > this.STATE_EXPIRATION_MS) {

      // Limpa o estado expirado
      await this.clearAppointmentState(customerId);
      return null;
    }

    return state;
  }

  /**
   * Salva o estado de agendamento
   */
  async saveAppointmentState(customerId: string, state: AppointmentState): Promise<void> {
    try {
      // Verifica se a conversa existe
      const conversation = await prisma.conversation.findUnique({
        where: { customerId },
      });

      if (!conversation) {
        console.warn(`[AIAppointment] Conversation not found for customer ${customerId}. Skipping state save.`);
        return;
      }

      // Atualiza o estado
      await prisma.conversation.update({
        where: { customerId },
        data: { appointmentState: state as any },
      });
    } catch (error) {
      console.error('[AIAppointment] Error saving appointment state:', error);
      throw error;
    }
  }

  /**
   * Limpa o estado de agendamento
   */
  async clearAppointmentState(customerId: string): Promise<void> {
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { customerId },
      });

      if (!conversation) {
        console.warn(`[AIAppointment] Conversation not found for customer ${customerId}. Skipping state clear.`);
        return;
      }

      await prisma.conversation.update({
        where: { customerId },
        data: { appointmentState: null as any },
      });
    } catch (error) {
      console.error('[AIAppointment] Error clearing appointment state:', error);
      // Não propaga o erro, apenas loga
    }
  }

  /**
   * Detecta se o cliente quer cancelar/parar o processo de agendamento
   * Usa uma lista ampla de variações para entender a intenção mesmo em linguagem natural
   */
  private detectCancelIntent(lowerMessage: string): boolean {
    // Frases de cancelamento que são seguras (não geram falsos positivos)
    const safeCancelPhrases = [
      // Cancelamento explícito
      'cancelar', 'cancela', 'cancelei', 'cancelo',
      'cancelar agendamento', 'cancela agendamento',
      // Desistência
      'desistir', 'desisto', 'desisti',
      'não quero mais', 'nao quero mais',
      'mudei de ideia', 'mudei de idéia',
      // Parar/Interromper (frases completas para evitar falso positivo com "para mim")
      'parar isso', 'para isso', 'pare isso',
      'para ai', 'para aí', 'para por aqui',
      'pode parar', 'quero parar',
      'interromper', 'interrompe',
      // Sair/Voltar
      'sair', 'sai daqui', 'sair disso',
      'voltar', 'volta', 'voltar atrás',
      // Deixar/Abandonar
      'deixa pra lá', 'deixa pra la', 'deixa pra depois',
      'deixar pra lá', 'deixar pra la',
      'deixa quieto', 'deixar quieto',
      'esquece', 'esqueça', 'esqueci',
      'esquece isso', 'esqueça isso',
      // Negações fortes
      'não preciso mais', 'nao preciso mais',
      'não vou mais', 'nao vou mais',
      'não é mais', 'nao e mais',
      'não era isso', 'nao era isso',
      'não quero agendar', 'nao quero agendar',
      // Recusas claras
      'agora não dá', 'agora nao da', 'agora não posso', 'agora nao posso',
      'depois eu vejo', 'depois vejo',
      // Stop
      'stop', 'parar tudo', 'para tudo'
    ];

    // Verifica frases seguras
    for (const phrase of safeCancelPhrases) {
      if (lowerMessage.includes(phrase)) {
        return true;
      }
    }

    // Mensagem é exatamente uma palavra de cancelamento
    const exactCancelWords = ['para', 'parar', 'pare', 'sair', 'sai', 'volta', 'voltar', 'cancelar', 'cancela', 'desistir', 'desisto', 'tchau', 'stop'];
    const trimmedMessage = lowerMessage.trim();
    if (exactCancelWords.includes(trimmedMessage)) {
      return true;
    }

    // Verifica padrões específicos
    // "não" ou "nao" no início seguido de verbos de ação
    if (/^n[aã]o\s+(quero|vou|preciso|posso|consigo)/i.test(trimmedMessage)) {
      return true;
    }

    return false;
  }

  /**
   * Processa a mensagem do cliente no contexto de agendamento
   *
   * 🆕 FLUXO INTELIGENTE: Mesmo durante o fluxo, detecta múltiplos dados
   * para acelerar o processo quando o cliente manda tudo de uma vez
   */
  async processAppointmentMessage(
    customerId: string,
    companyId: string,
    message: string
  ): Promise<{ shouldContinue: boolean; response?: string }> {
    const lowerMessage = message.toLowerCase();

    // 🚪 COMANDO DE ESCAPE: Cliente quer sair do fluxo
    // Detecção inteligente de intenção de cancelar/parar o processo
    if (this.detectCancelIntent(lowerMessage)) {
      await this.clearAppointmentState(customerId);
      return {
        shouldContinue: true,
        response: `Tranquilo! Cancelei o agendamento 👍\n\nQualquer coisa é só chamar!`
      };
    }

    let state = await this.getAppointmentState(customerId);

    // Se não tem estado ativo, não processa (IA principal deve iniciar)
    if (!state) {
      return { shouldContinue: false };
    }

    // 🆕 DETECÇÃO MÚLTIPLA: Mas RESPEITA o step atual
    // Quando estamos selecionando serviço, variação OU horário, NÃO tentamos detectar outros dados
    // Isso evita confusão onde:
    // - Nome do serviço pode ser interpretado como data
    // - Número de escolha de horário (1, 2, 3) pode ser detectado como número de casa
    const shouldAutoDetect = !['SELECTING_SERVICE', 'SELECTING_SERVICE_VARIATION', 'COLLECTING_TIME'].includes(state.step);

    let detected: DetectedAppointmentData;
    let dataUpdated = false;
    let dateWasJustSet = false;

    if (shouldAutoDetect) {
      detected = this.detectAllFromMessage(message);

      // Aplica dados detectados que ainda não existem no estado
      if (detected.serviceType && !state.serviceType && !state.serviceName) {
        state.serviceType = detected.serviceType;
        state.duration = this.getDefaultDuration(detected.serviceType);
        dataUpdated = true;
      }

      if (detected.date && !state.date) {
        state.date = detected.date;
        dataUpdated = true;
        dateWasJustSet = true;
      }
    } else {
      // Cria objeto vazio compatível com DetectedAppointmentData
      detected = {
        serviceType: null,
        date: null,
        time: null,
        address: null
      };
    }

    // 🚨 IMPORTANTE: Quando detectar data, SEMPRE buscar horários disponíveis PRIMEIRO
    // NÃO aceitar horário automático - cliente DEVE escolher
    if (dateWasJustSet && state.serviceType && state.date) {

      try {
        const selectedDate = new Date(state.date);
        const slots = await appointmentService.getAvailableSlots(companyId, selectedDate, state.duration || 60);

        if (slots.length === 0) {
          // Dia sem horários - pede outra data
          state.date = undefined;
          await this.saveAppointmentState(customerId, state);

          return {
            shouldContinue: true,
            response: `Putz, esse dia tá sem horários disponíveis 😔\n\nTem outro dia que funciona pra você?`
          };
        }

        // Salva os slots e vai para COLLECTING_TIME
        state.availableSlots = slots;
        state.currentSlotPage = 0;
        state.step = 'COLLECTING_TIME';
        await this.saveAppointmentState(customerId, state);

        // Formata a data para exibição
        const dateFormatted = selectedDate.toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: '2-digit',
          month: 'long'
        });

        // Mostra os horários disponíveis
        const slotsToShow = slots.slice(0, 6);
        const slotsText = slotsToShow
          .map((slot, index) => {
            const time = this.slotToTimeString(slot.start);
            return `${index + 1}️⃣ ${time}`;
          })
          .join('\n');

        let responseMessage = `Boa! ${dateFormatted} 📅\n\nHorários disponíveis:\n\n${slotsText}\n\nQual desses é melhor pra você?`;

        if (slots.length > 6) {
          responseMessage += `\n\n💡 Tenho mais ${slots.length - 6} horários. Fala "mais tarde" pra ver mais`;
        }

        return {
          shouldContinue: true,
          response: responseMessage
        };

      } catch (error: any) {
        console.error('[AIAppointment] Erro ao buscar horários:', error);
        return {
          shouldContinue: true,
          response: `Ops, tive um problema ao buscar os horários. Pode me falar o dia de novo?`
        };
      }
    }

    if (detected.address && !state.address?.number) {
      state.address = { ...state.address, ...detected.address };
      dataUpdated = true;
    }

    // Se detectou apenas endereço (não data), verifica se pode ir para confirmação
    if (dataUpdated && !dateWasJustSet) {
      const nextStep = this.determineNextStep(state);

      // Se o próximo step pulou etapas, atualiza o state
      if (nextStep !== state.step) {
        state.step = nextStep;

        // Se pulou direto para confirmação
        if (nextStep === 'CONFIRMING') {
          await this.saveAppointmentState(customerId, state);
          return await this.sendConfirmation(customerId, state);
        }
      }
    }

    // 🔄 DETECÇÃO DE MUDANÇA: Cliente quer alterar algo que já informou
    const changeDetected = this.detectChangeIntent(message, state);
    if (changeDetected) {
      const { field, value } = changeDetected;


      // Aplica a mudança
      if (field === 'date' && value) {
        const date = this.detectDate(value);
        if (date) {
          state.date = date;
          state.time = undefined; // Limpa horário pois precisa buscar novos slots
          state.availableSlots = undefined;
          state.step = 'COLLECTING_DATE';
          await this.saveAppointmentState(customerId, state);

          return {
            shouldContinue: true,
            response: `Tranquilo! Vou mudar pra esse dia. Me dá só um segundo pra ver os horários disponíveis...`
          };
        }
      } else if (field === 'time' && value) {
        const time = this.detectTime(value);
        if (time) {
          state.time = time;
          state.step = state.address?.number ? 'CONFIRMING' : 'COLLECTING_ADDRESS';
          await this.saveAppointmentState(customerId, state);

          if (state.step === 'CONFIRMING') {
            return await this.sendConfirmation(customerId, state);
          } else {
            return {
              shouldContinue: true,
              response: `Show! Mudei o horário pra ${time} 👍\n\nAgora só preciso do endereço. Me manda aí!`
            };
          }
        }
      } else if (field === 'type' && value) {
        const serviceType = this.detectServiceType(value);
        if (serviceType) {
          state.serviceType = serviceType;
          state.duration = this.getDefaultDuration(serviceType);
          state.time = undefined; // Limpa horário pois duração mudou
          state.availableSlots = undefined;
          await this.saveAppointmentState(customerId, state);

          const serviceLabel = state.serviceName || this.getServiceTypeLabel(serviceType);
          return {
            shouldContinue: true,
            response: `Beleza! Mudei pra ${serviceLabel} 👍\n\nQual dia é melhor pra você?`
          };
        }
      }
    }

    // Processa baseado no step atual
    switch (state.step) {
      case 'SELECTING_SERVICE':
        return await this.handleSelectingService(customerId, companyId, message, state);

      case 'COLLECTING_TYPE':
        return await this.handleCollectingType(customerId, companyId, message, state);

      case 'SELECTING_SERVICE_VARIATION':
        return await this.handleSelectingServiceVariation(customerId, companyId, message, state);

      case 'COLLECTING_DATE':
        return await this.handleCollectingDate(customerId, companyId, message, state);

      case 'COLLECTING_TIME':
        return await this.handleCollectingTime(customerId, companyId, message, state);

      case 'COLLECTING_ADDRESS':
        return await this.handleCollectingAddress(customerId, companyId, message, state);

      case 'CONFIRMING':
        return await this.handleConfirming(customerId, companyId, message, state);

      default:
        return { shouldContinue: false };
    }
  }

  /**
   * Detecta se o cliente quer mudar alguma informação já fornecida
   */
  private detectChangeIntent(message: string, state: AppointmentState): { field: string; value: string } | null {
    const lowerMessage = message.toLowerCase();

    // Palavras que indicam mudança
    const changeKeywords = [
      'mudar', 'trocar', 'alterar', 'na verdade', 'melhor',
      'prefiro', 'mudei de ideia', 'outro', 'outra'
    ];

    const hasChangeKeyword = changeKeywords.some(keyword => lowerMessage.includes(keyword));

    if (!hasChangeKeyword) {
      return null;
    }

    // Detecta qual campo quer mudar
    if (state.date && (lowerMessage.includes('dia') || lowerMessage.includes('data'))) {
      return { field: 'date', value: message };
    }

    if (state.time && (lowerMessage.includes('horário') || lowerMessage.includes('horario') || lowerMessage.includes('hora'))) {
      return { field: 'time', value: message };
    }

    if (state.serviceType && (lowerMessage.includes('serviço') || lowerMessage.includes('servico') || lowerMessage.includes('tipo'))) {
      return { field: 'type', value: message };
    }

    // Se detectou palavra de mudança mas não especificou o campo, tenta detectar pelo valor
    const detectedDate = this.detectDate(message);
    if (detectedDate && state.date) {
      return { field: 'date', value: message };
    }

    const detectedTime = this.detectTime(message);
    if (detectedTime && state.time) {
      return { field: 'time', value: message };
    }

    return null;
  }

  /**
   * Step 1: Selecionando serviço da lista dinâmica
   */
  private async handleSelectingService(
    customerId: string,
    companyId: string,
    message: string,
    state: AppointmentState
  ): Promise<{ shouldContinue: boolean; response: string }> {
    // Verifica se tem serviços disponíveis no estado
    if (!state.availableServices || state.availableServices.length === 0) {
      // Busca novamente (fallback)
      const services = await this.getAvailableServicesForCompany(companyId);
      if (services.length === 0) {
        // Fallback para fluxo antigo
        state.step = 'COLLECTING_TYPE';
        await this.saveAppointmentState(customerId, state);
        return {
          shouldContinue: true,
          response: `Me conta qual serviço você precisa?`
        };
      }
      state.availableServices = services;
    }

    // Tenta identificar qual serviço o cliente escolheu
    const selectedService = this.matchServiceFromMessage(message, state.availableServices);

    if (selectedService) {
      // Serviço identificado!
      state.serviceId = selectedService.id;
      state.serviceName = selectedService.name;
      state.servicePrice = selectedService.price;
      state.duration = selectedService.duration;
      state.serviceType = AppointmentType.OTHER; // Tipo genérico para serviços dinâmicos

      // Verifica se este serviço tem variações (ex: AC 9K, 12K, 18K)
      // Se tiver, mostra as variações; senão, prossegue para data
      const hasVariations = this.checkIfServiceHasVariations(selectedService.name, state.availableServices);

      if (hasVariations && hasVariations.length > 1) {
        state.serviceVariations = hasVariations.map(v => ({
          name: v.name,
          price: v.price,
          duration: v.duration
        }));
        state.step = 'SELECTING_SERVICE_VARIATION';
        await this.saveAppointmentState(customerId, state);

        const variationsText = hasVariations.map((v, i) => {
          const priceInfo = v.price !== 'Consultar' ? ` - ${v.price}` : '';
          return `${i + 1}️⃣ ${v.name}${priceInfo}`;
        }).join('\n');

        return {
          shouldContinue: true,
          response: `Boa! Temos algumas opções de ${selectedService.name}:\n\n${variationsText}\n\nQual você prefere?`
        };
      }

      // Sem variações, prossegue para data
      state.step = 'COLLECTING_DATE';
      await this.saveAppointmentState(customerId, state);

      const priceInfo = selectedService.price !== 'Consultar' ? ` por ${selectedService.price}` : '';
      return {
        shouldContinue: true,
        response: `Perfeito! ${selectedService.name}${priceInfo} anotado ✅\n\nQual dia fica bom pra você?`
      };
    }

    // Não conseguiu identificar - pede novamente de forma mais natural
    const servicesText = state.availableServices.map((s, i) => {
      const priceInfo = s.price !== 'Consultar' ? ` - ${s.price}` : '';
      return `${i + 1}. ${s.name}${priceInfo}`;
    }).join('\n');

    return {
      shouldContinue: true,
      response: `Não consegui identificar qual serviço você precisa 🤔\n\nTemos esses disponíveis:\n\n${servicesText}\n\nVocê pode me dizer o número (ex: "1") ou o nome do serviço que deseja!`
    };
  }

  /**
   * Step 2: Coletando tipo de serviço (se não foi detectado)
   * NOTA: Este handler é usado como fallback quando não há serviços cadastrados
   */
  private async handleCollectingType(
    customerId: string,
    companyId: string,
    message: string,
    state: AppointmentState
  ): Promise<{ shouldContinue: boolean; response: string }> {
    const lowerMessage = message.toLowerCase();
    let serviceType: AppointmentType | null = null;

    // Tenta detectar por palavras-chave (sem números hardcoded)
    if (lowerMessage.includes('instalação') || lowerMessage.includes('instalacao') || lowerMessage.includes('instalar')) {
      serviceType = AppointmentType.INSTALLATION;
    } else if (lowerMessage.includes('manutenção') || lowerMessage.includes('manutencao') || lowerMessage.includes('limpeza')) {
      serviceType = AppointmentType.MAINTENANCE;
    } else if (lowerMessage.includes('orçamento') || lowerMessage.includes('orcamento') || lowerMessage.includes('consulta') || lowerMessage.includes('visita')) {
      serviceType = AppointmentType.CONSULTATION;
    } else if (message.trim().length > 3) {
      // Aceita qualquer descrição como "outro" serviço
      serviceType = AppointmentType.OTHER;
      state.description = message.trim(); // Guarda a descrição do cliente
    }

    if (!serviceType) {
      return {
        shouldContinue: true,
        response: `Pode me contar mais sobre o que você precisa? Por exemplo: instalação, manutenção, limpeza...`
      };
    }

    state.serviceType = serviceType;
    state.duration = this.getDefaultDuration(serviceType);

    // 🆕 Verifica se há múltiplas variações desse serviço no catálogo
    const variations = await this.getServiceVariationsFromCatalog(companyId, serviceType);

    if (variations.length > 1) {
      // Há múltiplas opções - precisa perguntar qual
      state.serviceVariations = variations;
      state.step = 'SELECTING_SERVICE_VARIATION';
      await this.saveAppointmentState(customerId, state);

      const serviceLabel = state.serviceName || this.getServiceTypeLabel(serviceType);
      const variationsText = variations.slice(0, 10).map((v, i) =>
        `${i + 1}️⃣ ${v.name} - ${v.price}`
      ).join('\n');

      return {
        shouldContinue: true,
        response: `Temos várias opções de ${serviceLabel}! 📋\n\n${variationsText}\n\nQual desses você precisa? Pode mandar o número ou falar o nome`,
      };
    } else if (variations.length === 1) {
      // Apenas uma opção - usa automaticamente
      state.serviceName = variations[0].name;
      state.servicePrice = variations[0].price;
      if (variations[0].duration) state.duration = variations[0].duration;
    }

    state.step = 'COLLECTING_DATE';
    await this.saveAppointmentState(customerId, state);

    const serviceLabel = state.serviceName || this.getServiceTypeLabel(serviceType);
    const priceInfo = state.servicePrice ? ` (${state.servicePrice})` : '';

    return {
      shouldContinue: true,
      response: `Perfeito! ${serviceLabel}${priceInfo} anotado 👍\n\nQual dia é melhor pra você?`,
    };
  }

  /**
   * Step 2.5: Selecionando variação do serviço
   */
  private async handleSelectingServiceVariation(
    customerId: string,
    _companyId: string,
    message: string,
    state: AppointmentState
  ): Promise<{ shouldContinue: boolean; response: string }> {
    const lowerMessage = message.toLowerCase();

    if (!state.serviceVariations || state.serviceVariations.length === 0) {
      // Fallback - não deveria acontecer
      state.step = 'COLLECTING_DATE';
      await this.saveAppointmentState(customerId, state);
      return {
        shouldContinue: true,
        response: `Qual dia é melhor pra você?`
      };
    }

    // Tenta detectar qual variação o cliente escolheu
    let selectedVariation: ServiceVariation | undefined;

    // 1. Verifica se mandou número (ex: "1", "2", "3")
    const numberMatch = message.match(/^(\d+)$/);
    if (numberMatch) {
      const index = parseInt(numberMatch[1]) - 1;
      if (index >= 0 && index < state.serviceVariations.length) {
        selectedVariation = state.serviceVariations[index];
      }
    }

    // 2. Se não, procura por nome ou termo no nome da variação
    if (!selectedVariation) {
      selectedVariation = state.serviceVariations.find(v => {
        const vName = v.name.toLowerCase();
        // Verifica se alguma parte significativa do nome está na mensagem
        const terms = vName.split(/\s+/).filter(t => t.length > 3);
        return terms.some(term => lowerMessage.includes(term)) ||
               lowerMessage.includes(vName);
      });
    }

    // 3. Detecta termos específicos como "9k", "12k", "18k", "24k"
    if (!selectedVariation) {
      const btuMatch = lowerMessage.match(/(\d+)\s*k/i);
      if (btuMatch) {
        const btu = btuMatch[1];
        selectedVariation = state.serviceVariations.find(v =>
          v.name.toLowerCase().includes(btu + 'k') ||
          v.name.toLowerCase().includes(btu + ' ')
        );
      }
    }

    if (!selectedVariation) {
      // Não conseguiu identificar
      const variationsText = state.serviceVariations.slice(0, 10).map((v, i) =>
        `${i + 1}️⃣ ${v.name} - ${v.price}`
      ).join('\n');

      return {
        shouldContinue: true,
        response: `Não entendi qual opção você quer 🤔\n\n${variationsText}\n\nPode mandar o número ou falar mais específico (ex: "12k", "18000 BTUs")?`
      };
    }

    // Encontrou a variação
    state.serviceName = selectedVariation.name;
    state.servicePrice = selectedVariation.price;
    if (selectedVariation.duration) state.duration = selectedVariation.duration;
    state.serviceVariations = undefined; // Limpa as variações
    state.step = 'COLLECTING_DATE';
    await this.saveAppointmentState(customerId, state);

    return {
      shouldContinue: true,
      response: `Ótimo! ${selectedVariation.name} - ${selectedVariation.price} 👍\n\nQual dia é melhor pra você?`
    };
  }

  /**
   * Step 3: Coletando data
   */
  private async handleCollectingDate(
    customerId: string,
    companyId: string,
    message: string,
    state: AppointmentState
  ): Promise<{ shouldContinue: boolean; response: string }> {
    const date = this.detectDate(message);

    if (!date) {
      return {
        shouldContinue: true,
        response: `Não consegui entender a data 🤔\n\nPode me falar o dia de novo?`,
      };
    }

    // Valida se a data não é passada
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      return {
        shouldContinue: true,
        response: `Ops, essa data já passou 😅\n\nPode me falar uma data a partir de hoje?`,
      };
    }

    state.date = date;

    // Busca horários disponíveis
    try {
      const slots = await appointmentService.getAvailableSlots(companyId, selectedDate, state.duration || 60);

      if (slots.length === 0) {
        return {
          shouldContinue: true,
          response: `Putz, esse dia tá lotado 😔\n\nTem outro dia que funciona pra você?`,
        };
      }

      state.availableSlots = slots;
      state.currentSlotPage = 0; // Inicia na primeira página (primeiros 6 horários)
      state.step = 'COLLECTING_TIME';
      await this.saveAppointmentState(customerId, state);

      // Formata a data para exibição
      const dateFormatted = selectedDate.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long'
      });

      // Mostra os primeiros 6 slots
      const slotsToShow = slots.slice(0, 6);
      const slotsText = slotsToShow
        .map((slot, index) => {
          const time = this.slotToTimeString(slot.start);
          return `${index + 1}️⃣ ${time}`;
        })
        .join('\n');

      // Mensagem com dica sobre horários alternativos
      let responseMessage = `Boa! Entendi que é pra ${dateFormatted} 📅\n\nHorários disponíveis:\n\n${slotsText}\n\nQual desses é melhor pra você? Pode mandar o número ou o horário direto`;

      // Se tem mais horários disponíveis, avisa
      if (slots.length > 6) {
        responseMessage += `\n\n💡 Tenho mais ${slots.length - 6} horários disponíveis. Se quiser ver mais opções, fala "mais tarde" ou "mais cedo"`;
      }

      return {
        shouldContinue: true,
        response: responseMessage,
      };
    } catch (error: any) {
      console.error('[AIAppointment] Error fetching slots:', error);
      return {
        shouldContinue: true,
        response: `Ops, tive um problema ao buscar os horários. Pode tentar de novo?`,
      };
    }
  }

  /**
   * Step 4: Coletando horário
   */
  private async handleCollectingTime(
    customerId: string,
    _companyId: string,
    message: string,
    state: AppointmentState
  ): Promise<{ shouldContinue: boolean; response: string }> {
    const lowerMessage = message.toLowerCase();

    if (!state.availableSlots || state.availableSlots.length === 0) {
      return {
        shouldContinue: true,
        response: `Ops, perdi os horários disponíveis 😅\n\nPode me falar o dia de novo?`,
      };
    }

    const currentPage = state.currentSlotPage || 0;

    // Detecta solicitação de "mais tarde" ou "mais cedo"
    const wantsLater = lowerMessage.includes('mais tarde') || lowerMessage.includes('depois') || lowerMessage.includes('outro') || lowerMessage.includes('outros horários');
    const wantsEarlier = lowerMessage.includes('mais cedo') || lowerMessage.includes('antes') || lowerMessage.includes('anterior');

    if (wantsLater) {
      // Mostra próximos 6 horários
      const startIndex = (currentPage + 1) * 6;

      if (startIndex >= state.availableSlots.length) {
        return {
          shouldContinue: true,
          response: `Esses são todos os horários disponíveis que tenho 😊\n\nPode escolher um dos que mostrei?`,
        };
      }

      const slotsToShow = state.availableSlots.slice(startIndex, startIndex + 6);
      const slotsText = slotsToShow
        .map((slot, index) => {
          const time = this.slotToTimeString(slot.start);
          return `${index + 1}️⃣ ${time}`;
        })
        .join('\n');

      state.currentSlotPage = currentPage + 1;
      await this.saveAppointmentState(customerId, state);

      const hasMore = state.availableSlots.length > startIndex + 6;
      let response = `Aqui vão horários mais tarde:\n\n${slotsText}\n\nQual desses funciona pra você?`;

      if (hasMore) {
        response += `\n\n💡 Ainda tenho mais opções. Quer ver?`;
      }

      return {
        shouldContinue: true,
        response,
      };
    }

    if (wantsEarlier) {
      // Mostra 6 horários anteriores
      if (currentPage === 0) {
        return {
          shouldContinue: true,
          response: `Esses já são os horários mais cedo que tenho disponíveis 😊\n\nPode escolher um deles?`,
        };
      }

      const startIndex = (currentPage - 1) * 6;
      const slotsToShow = state.availableSlots.slice(startIndex, startIndex + 6);
      const slotsText = slotsToShow
        .map((slot, index) => {
          const time = this.slotToTimeString(slot.start);
          return `${index + 1}️⃣ ${time}`;
        })
        .join('\n');

      state.currentSlotPage = currentPage - 1;
      await this.saveAppointmentState(customerId, state);

      return {
        shouldContinue: true,
        response: `Aqui vão horários mais cedo:\n\n${slotsText}\n\nQual desses funciona?`,
      };
    }

    // Tenta detectar seleção por número (1-6)
    const numberMatch = message.match(/^[1-6]$/);
    if (numberMatch) {
      const index = parseInt(numberMatch[0]) - 1;
      const startIndex = currentPage * 6;
      const selectedSlot = state.availableSlots[startIndex + index];

      if (selectedSlot) {
        state.time = this.slotToTimeString(selectedSlot.start);
        state.step = 'COLLECTING_ADDRESS';
        await this.saveAppointmentState(customerId, state);

        return {
          shouldContinue: true,
          response: `Fechado! Horário das ${state.time} tá reservado 👍\n\nAgora só preciso do endereço completo onde vou fazer o serviço 📍`
        };
      }
    }

    // Tenta detectar horário no formato HH:mm
    const time = this.detectTime(message);
    if (time) {
      // Verifica se o horário está nos slots disponíveis
      const matchingSlot = state.availableSlots.find(slot => {
        const slotTime = this.slotToTimeString(slot.start);
        return slotTime === time;
      });

      if (matchingSlot) {
        state.time = time;
        state.step = 'COLLECTING_ADDRESS';
        await this.saveAppointmentState(customerId, state);

        return {
          shouldContinue: true,
          response: `Beleza! Horário das ${time} tá reservado 👍\n\nAgora só preciso do endereço completo onde vou fazer o serviço 📍`
        };
      }

      return {
        shouldContinue: true,
        response: `Poxa, esse horário ${time} não tá disponível 😔\n\nDá uma olhada nos horários que mostrei e escolhe um deles? Ou fala "mais tarde" pra ver outras opções`,
      };
    }

    return {
      shouldContinue: true,
      response: `Não entendi o horário 🤔\n\nPode escolher um dos horários que mostrei?`,
    };
  }

  /**
   * Step 5: Coletando endereço
   *
   * Usa a mesma lógica robusta do detectAddressFromMessage para extrair
   * todos os dados de endereço de uma vez (rua, número, CEP, complemento)
   */
  private async handleCollectingAddress(
    customerId: string,
    _companyId: string,
    message: string,
    state: AppointmentState
  ): Promise<{ shouldContinue: boolean; response: string }> {
    // Inicializa o objeto de endereço se não existir
    if (!state.address) {
      state.address = {};
    }

    // Usa a detecção robusta que extrai tudo de uma vez
    const detectedAddress = this.detectAddressFromMessage(message);

    if (detectedAddress) {
      // Aplica os dados detectados (não sobrescreve dados já existentes)
      if (detectedAddress.cep && !state.address.cep) {
        state.address.cep = detectedAddress.cep;
      }
      if (detectedAddress.street && !state.address.street) {
        state.address.street = detectedAddress.street;
      }
      if (detectedAddress.number && !state.address.number) {
        state.address.number = detectedAddress.number;
      }
      if (detectedAddress.complement && !state.address.complement) {
        state.address.complement = detectedAddress.complement;
      }
    }

    // Fallback: se não detectou com a função robusta, tenta detectar campos individuais
    if (!state.address.number) {
      const number = this.detectAddressNumber(message);
      if (number) {
        // Validação adicional: se o número for "1" e a mensagem não contém contexto claro de endereço,
        // não aceita para evitar valores padrão incorretos
        const hasAddressContext =
          state.address.street !== undefined || // Já tem rua no estado
          state.address.cep !== undefined || // Já tem CEP no estado
          message.toLowerCase().includes('número 1') ||
          message.toLowerCase().includes('numero 1') ||
          message.toLowerCase().includes('nº 1') ||
          message.toLowerCase().includes('n° 1') ||
          message.match(/,\s*1\s*[,\s]/) !== null || // "Rua X, 1"
          message.match(/\s+1\s*$/) !== null || // "Rua X 1" no final
          message.match(/^1\s*$/) !== null; // Apenas "1" (cliente respondendo pergunta)

        const isValidNumber = number !== '1' || hasAddressContext;

        if (isValidNumber) {
          state.address.number = number;
        } else {
        }
      }
    }

    if (!state.address.cep) {
      const cep = this.detectCEP(message);
      if (cep) {
        state.address.cep = cep;
      }
    }

    if (!state.address.complement) {
      const complement = this.detectComplement(message);
      if (complement) {
        state.address.complement = complement;
      }
    }

    // Se ainda não tem rua, usa a mensagem como endereço (último recurso)
    if (!state.address.street && !state.address.cep && message.length > 5) {
      // Remove número e complemento já detectados
      let street = message;
      if (state.address.number) {
        street = street.replace(new RegExp(`[,\\s]*${state.address.number}[,\\s]*`, 'g'), ' ').trim();
      }
      if (state.address.complement) {
        street = street.replace(state.address.complement, '').trim();
      }
      street = street.replace(/[,;]+$/, '').trim();

      if (street.length > 3) {
        state.address.street = street;
      }
    }

    // Valida se o endereço está completo
    const validation = this.validateAddress(state.address);

    if (validation.valid) {
      // Endereço completo, vai para confirmação
      state.step = 'CONFIRMING';
      await this.saveAppointmentState(customerId, state);

      return await this.sendConfirmation(customerId, state);
    }

    // Endereço incompleto, pede informações faltantes
    await this.saveAppointmentState(customerId, state);

    // Se tem algum dado, mostra o que já anotou
    const hasAnyData = state.address.cep || state.address.street || state.address.number || state.address.complement;

    if (hasAnyData) {
      let response = `Anotei aqui 📝\n\n`;

      if (state.address.street) {
        response += `✓ ${state.address.street}`;
        if (state.address.number) {
          response += `, ${state.address.number}`;
        }
        response += '\n';
      } else {
        if (state.address.cep) response += `✓ CEP: ${state.address.cep}\n`;
        if (state.address.number) response += `✓ Número: ${state.address.number}\n`;
      }
      if (state.address.complement) {
        response += `✓ ${state.address.complement}\n`;
      }

      // Só pede o que falta
      if (validation.missing.length > 0) {
        if (validation.missing.includes('número')) {
          response += `\n⚠️ Preciso do NÚMERO da casa/apartamento para continuar.\n\nQual o número?`;
        } else {
          response += `\nSó falta o ${validation.missing.join(' e ')} 🏠`;
        }
      }

      return { shouldContinue: true, response };
    }

    // Não conseguiu extrair nada, pede novamente
    return {
      shouldContinue: true,
      response: `Não consegui entender o endereço 🤔\n\nPode me mandar o endereço completo com rua e número?`
    };
  }

  /**
   * Step 6: Confirmação
   */
  private async sendConfirmation(
    _customerId: string,
    state: AppointmentState
  ): Promise<{ shouldContinue: boolean; response: string }> {
    const date = new Date(state.date!);
    const dateFormatted = date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    // 🎯 PRIORIDADE: Usa o nome real/específico do serviço
    // Se não tiver, usa o label genérico como fallback
    const serviceLabel = state.serviceName || this.getServiceTypeLabel(state.serviceType!);

    // Adiciona aviso se estiver usando nome genérico (não deveria acontecer)
    if (!state.serviceName && state.serviceType) {
      console.warn('[AIAppointment] ⚠️ Confirmação sem nome específico do serviço! Usando tipo genérico:', state.serviceType);
    }

    // Formata endereço no padrão solicitado
    let addressText = '';
    if (state.address?.street || state.address?.cep) {
      addressText = '\n📍 Endereço:\n';
      if (state.address.street) {
        // Formato: "   alcides s coelho, 4"
        addressText += `   ${state.address.street}`;
        if (state.address.number) {
          addressText += `, ${state.address.number}`;
        }
      } else if (state.address.cep) {
        addressText += `   CEP: ${state.address.cep}`;
        if (state.address.number) {
          addressText += `, ${state.address.number}`;
        }
      }
      // Adiciona complemento na mesma linha se tiver
      if (state.address.complement) {
        addressText += `, ${state.address.complement}`;
      }
    }

    // Monta a mensagem de confirmação no padrão bonito e organizado
    let confirmationMessage = '✅ Confirmação do Agendamento\n\n';
    confirmationMessage += `📋 Serviço: ${serviceLabel}\n`;

    // Adiciona preço se disponível (sempre mostrar na confirmação)
    if (state.servicePrice && state.servicePrice !== 'Consultar') {
      confirmationMessage += `💰 Valor: ${state.servicePrice}\n`;
    }

    confirmationMessage += `📅 Data: ${dateFormatted}\n`;
    confirmationMessage += `🕐 Horário: ${state.time}\n`;
    confirmationMessage += `⏱️ Duração: ${state.duration} minutos`;
    confirmationMessage += addressText;
    confirmationMessage += '\n\nResponda SIM pra confirmar ou NÃO se quiser mudar algo';

    return {
      shouldContinue: true,
      response: confirmationMessage,
    };
  }

  /**
   * Step 6: Processando confirmação
   */
  private async handleConfirming(
    customerId: string,
    companyId: string,
    message: string,
    state: AppointmentState
  ): Promise<{ shouldContinue: boolean; response: string }> {
    const lowerMessage = message.toLowerCase();

    const confirmationWords = ['sim', 'confirmar', 'confirmo', 'isso', 'exato', 'correto', 'perfeito', 'fechou', 'pode marcar', 'ok', 'pode ser'];
    const isConfirmation = confirmationWords.some(word => lowerMessage.includes(word));

    if (isConfirmation) {
      try {
        // Cria o agendamento
        const customer = await prisma.customer.findUnique({
          where: { id: customerId },
        });

        if (!customer) {
          throw new Error('Customer not found');
        }

        // Monta a data e hora completas no timezone do Brasil
        const startTime = createBrazilDateTime(state.date!, state.time!);
        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + (state.duration || 60));


        const serviceLabel = state.serviceName || this.getServiceTypeLabel(state.serviceType!);
        const description = `Agendamento via WhatsApp - ${serviceLabel}`;

        // Formata o endereço para o campo location
        let location = '';
        if (state.address) {
          if (state.address.street) {
            location = state.address.street;
            if (state.address.number) {
              location += `, ${state.address.number}`;
            }
          } else if (state.address.cep) {
            location = `CEP: ${state.address.cep}`;
            if (state.address.number) {
              location += ` - Nº ${state.address.number}`;
            }
          }
          if (state.address.complement) {
            location += ` - ${state.address.complement}`;
          }
        }

        // Monta as notas com todos os dados do endereço
        let notes = `Agendado automaticamente via IA em ${new Date().toLocaleString('pt-BR')}\n\n`;
        if (state.address) {
          notes += '--- ENDEREÇO COMPLETO ---\n';
          if (state.address.cep) notes += `CEP: ${state.address.cep}\n`;
          if (state.address.street) notes += `Rua: ${state.address.street}\n`;
          if (state.address.number) notes += `Número: ${state.address.number}\n`;
          if (state.address.complement) notes += `Complemento: ${state.address.complement}\n`;
          if (state.address.neighborhood) notes += `Bairro: ${state.address.neighborhood}\n`;
          if (state.address.city) notes += `Cidade: ${state.address.city}\n`;
          if (state.address.state) notes += `Estado: ${state.address.state}\n`;
        }

        const appointmentResult = await appointmentService.create(companyId, {
          customerId,
          title: `${serviceLabel} - ${customer.name}`,
          description,
          type: state.serviceType!,
          startTime,
          endTime,
          duration: state.duration || 60,
          location: location || undefined,
          notes,
        });

        // Limpa o estado
        await this.clearAppointmentState(customerId);

        // Log detalhado do resultado

        if (appointmentResult.googleCalendarSynced) {
        } else if (appointmentResult.googleCalendarError) {
          console.warn('[AIAppointment] ⚠️ Erro Google Calendar:', appointmentResult.googleCalendarError);
        }

        // Formata a data para a mensagem
        const dateFormatted = startTime.toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: '2-digit',
          month: 'long'
        });

        // Monta resposta de sucesso
        let successMessage = `Pronto! Agendamento confirmado 🎉\n\nSua ${serviceLabel.toLowerCase()} tá marcada pra ${dateFormatted} às ${state.time}`;

        // Adiciona nota sobre endereço se informado
        if (location) {
          successMessage += `\n📍 Local: ${location}`;
        }

        return {
          shouldContinue: true,
          response: successMessage,
        };
      } catch (error: any) {
        console.error('[AIAppointment] Error creating appointment:', error);
        await this.clearAppointmentState(customerId);

        return {
          shouldContinue: true,
          response: `Opa, deu um problema aqui 😔\n\nPode tentar de novo? Ou posso chamar um atendente pra te ajudar`,
        };
      }
    }

    if (lowerMessage.includes('não') || lowerMessage.includes('nao') || lowerMessage.includes('cancelar')) {
      await this.clearAppointmentState(customerId);

      return {
        shouldContinue: true,
        response: `Tranquilo! Cancelei o agendamento 👍\n\nQuando quiser marcar é só chamar`,
      };
    }

    return {
      shouldContinue: true,
      response: `Não entendi... 🤔\n\nÉ só responder SIM pra confirmar ou NÃO pra cancelar`,
    };
  }

  /**
   * Helpers
   */
  /**
   * Retorna a duração padrão para agendamentos (60 minutos)
   * A duração real deve ser configurada no cadastro de cada serviço/produto
   * Este método é usado apenas como fallback quando não há duração configurada
   */
  private getDefaultDuration(_type: AppointmentType): number {
    // Duração padrão de 60 minutos (1 hora)
    // A duração personalizada deve ser configurada no serviço/produto
    return 60;
  }

  /**
   * Retorna um label genérico para o tipo de serviço
   * NOTA: Este método é apenas um fallback - sempre priorize usar state.serviceName
   * que contém o nome real do serviço cadastrado pelo cliente
   */
  private getServiceTypeLabel(_type: AppointmentType | undefined): string {
    // Fallback genérico - o nome real do serviço deve vir de state.serviceName
    if (!_type) return 'Serviço';
    return 'Serviço';
  }

  /**
   * Busca serviços ativos cadastrados na empresa para exibir dinamicamente
   * Prioriza a tabela Service, com fallback para AIKnowledge.products
   */
  async getAvailableServicesForCompany(companyId: string): Promise<AvailableService[]> {
    try {
      // Primeiro, busca na tabela Service (serviços estruturados)
      const services = await prisma.service.findMany({
        where: {
          companyId,
          isActive: true,
          type: 'SERVICE' // Apenas serviços, não produtos
        },
        select: {
          id: true,
          name: true,
          basePrice: true,
          duration: true,
          category: true
        },
        orderBy: [
          { order: 'asc' },
          { name: 'asc' }
        ],
        take: 10 // Limita para não sobrecarregar
      });

      if (services.length > 0) {
        return services.map(s => ({
          id: s.id,
          name: s.name,
          price: `R$ ${Number(s.basePrice).toFixed(2).replace('.', ',')}`,
          duration: s.duration || 60,
          category: s.category || undefined
        }));
      }

      // Fallback: busca no AIKnowledge.products
      const aiKnowledge = await prisma.aIKnowledge.findUnique({
        where: { companyId },
        select: { products: true }
      });

      if (aiKnowledge?.products) {
        const products = Array.isArray(aiKnowledge.products)
          ? aiKnowledge.products
          : JSON.parse(typeof aiKnowledge.products === 'string' ? aiKnowledge.products : '[]');

        // Filtra apenas serviços (não produtos físicos)
        const serviceProducts = products.filter((p: any) => {
          const name = (p.name || '').toLowerCase();
          const category = (p.category || '').toLowerCase();
          // Inclui se parece ser um serviço
          return name.includes('instalação') || name.includes('instalacao') ||
                 name.includes('manutenção') || name.includes('manutencao') ||
                 name.includes('limpeza') || name.includes('consult') ||
                 name.includes('visita') || name.includes('serviço') ||
                 category.includes('serviço') || category.includes('servico');
        });

        if (serviceProducts.length > 0) {
          return serviceProducts.slice(0, 10).map((p: any, index: number) => ({
            id: `legacy-${index}`,
            name: p.name,
            price: p.price ? `R$ ${p.price}`.replace('R$ R$', 'R$') : 'Consultar',
            duration: p.duration ? parseInt(p.duration) : 60,
            category: p.category
          }));
        }
      }

      return [];

    } catch (error) {
      console.error('[AIAppointment] Erro ao buscar serviços disponíveis:', error);
      return [];
    }
  }

  /**
   * Formata a lista de serviços para exibição humanizada com números
   */
  private formatServicesForDisplay(services: AvailableService[]): string {
    if (services.length === 0) return '';

    return services.map((s, i) => {
      const priceInfo = s.price !== 'Consultar' ? ` - ${s.price}` : '';
      return `${i + 1}. ${s.name}${priceInfo}`;
    }).join('\n');
  }

  /**
   * Tenta identificar qual serviço o cliente escolheu pela mensagem
   * NOVO ALGORITMO: Prioriza palavras-chave críticas (tipo de serviço) antes de características (BTU)
   */
  private matchServiceFromMessage(message: string, services: AvailableService[]): AvailableService | null {
    const lowerMessage = message.toLowerCase().trim();

    // 1. Verifica se mandou número (ex: "1", "2", "3")
    const numberMatch = lowerMessage.match(/^(\d+)$/);
    if (numberMatch) {
      const index = parseInt(numberMatch[1]) - 1;
      if (index >= 0 && index < services.length) {
        return services[index];
      }
    }

    // 2. Normaliza mensagem e extrai informações importantes
    const normalizedMessage = lowerMessage
      .replace(/[^\wà-ÿ\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Detecta BTU/capacidade (se houver)
    const btuMatch = lowerMessage.match(/(\d+)\s*k(?:btus?)?|\b(\d{4,5})\s*btus?\b/i);
    const btu = btuMatch ? (btuMatch[1] || btuMatch[2]) : null;
    if (btu) {
    }

    // Identifica palavras-chave CRÍTICAS (tipo de serviço)
    const criticalKeywords = [
      'instalação', 'instalacao', 'instalar',
      'manutenção', 'manutencao', 'preventiva', 'revisão', 'revisao',
      'carga', 'recarga', 'gás', 'gas',
      'limpeza', 'higienização', 'higienizacao',
      'desinstalação', 'desinstalacao', 'remoção', 'remocao',
      'correção', 'correcao', 'vazamento',
      'conserto', 'reparo'
    ];

    const detectedKeywords = criticalKeywords.filter(kw => normalizedMessage.includes(kw));
    if (detectedKeywords.length > 0) {
    }

    // 3. SCORE-BASED MATCHING: Calcula score para cada serviço
    const scoredServices = services.map(service => {
      const serviceLower = service.name.toLowerCase();
      const normalizedServiceName = serviceLower
        .replace(/[^\wà-ÿ\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      let score = 0;
      const reasons: string[] = [];

      // CRITÉRIO 1: Palavras-chave críticas (PESO ALTO: 100 pontos cada)
      for (const keyword of detectedKeywords) {
        if (normalizedServiceName.includes(keyword)) {
          score += 100;
          reasons.push(`keyword:${keyword}`);
        }
      }

      // CRITÉRIO 2: BTU/capacidade (PESO MÉDIO: 50 pontos)
      if (btu) {
        const normalizedService = serviceLower.replace(/[\s\-]/g, '');
        const normalizedBTU = btu.replace(/[\s\-]/g, '');
        const hasBTUMatch = (
          serviceLower.includes(btu + 'k') ||
          serviceLower.includes(btu + ' k') ||
          normalizedService.includes(normalizedBTU + 'k') ||
          serviceLower.includes(btu + '000') ||
          serviceLower.includes(btu.substring(0, 2) + 'k')
        );

        if (hasBTUMatch) {
          score += 50;
          reasons.push(`btu:${btu}`);
        }
      }

      // CRITÉRIO 3: Palavras comuns (PESO BAIXO: 10 pontos cada)
      const messageWords = normalizedMessage.split(' ').filter(w =>
        w.length > 2 &&
        !/^\d+$/.test(w) &&
        !criticalKeywords.includes(w)
      );
      const serviceWords = normalizedServiceName.split(' ').filter(w =>
        w.length > 2 &&
        !/^\d+$/.test(w)
      );

      for (const mw of messageWords) {
        for (const sw of serviceWords) {
          if (mw === sw || mw.includes(sw) || sw.includes(mw)) {
            score += 10;
            reasons.push(`word:${sw}`);
            break;
          }
        }
      }

      // CRITÉRIO 4: Match exato (BÔNUS: 200 pontos)
      if (normalizedMessage === normalizedServiceName) {
        score += 200;
        reasons.push('exact_match');
      }

      return { service, score, reasons };
    });

    // Ordena por score (maior para menor)
    scoredServices.sort((a, b) => b.score - a.score);

    // Log dos top 3 scores
    scoredServices.slice(0, 3).forEach((item, i) => {
    });

    // Retorna o melhor match se tiver score mínimo
    const bestMatch = scoredServices[0];
    const MIN_SCORE = 50; // Requer pelo menos 50 pontos (mínimo: 1 keyword ou 1 BTU)

    if (bestMatch && bestMatch.score >= MIN_SCORE) {
      // Verifica se há empate nos top matches
      const secondBest = scoredServices[1];
      if (secondBest && secondBest.score === bestMatch.score) {
        return null;
      }

      return bestMatch.service;
    }

    return null;
  }

  /**
   * Verifica se um serviço tem variações disponíveis
   * Ex: "Instalação de Ar Condicionado" pode ter variações "9K BTUs", "12K BTUs", etc.
   */
  private checkIfServiceHasVariations(
    serviceName: string,
    allServices: AvailableService[]
  ): AvailableService[] | null {
    const baseNameLower = serviceName.toLowerCase();

    // Remove números e capacidades do nome para encontrar o "nome base"
    const baseName = baseNameLower
      .replace(/\d+\s*k\s*(btus?)?/gi, '')
      .replace(/\d+\.?\d*\s*btus?/gi, '')
      .replace(/\d+\s*mil\s*btus?/gi, '')
      .trim();

    // Busca todos os serviços que compartilham o mesmo nome base
    const variations = allServices.filter(s => {
      const sNameClean = s.name.toLowerCase()
        .replace(/\d+\s*k\s*(btus?)?/gi, '')
        .replace(/\d+\.?\d*\s*btus?/gi, '')
        .replace(/\d+\s*mil\s*btus?/gi, '')
        .trim();

      return sNameClean === baseName || sNameClean.includes(baseName) || baseName.includes(sNameClean);
    });

    return variations.length > 1 ? variations : null;
  }

  /**
   * Busca TODAS as variações de um serviço no catálogo da empresa
   * Ex: Se o cliente pede "instalação", retorna todas as instalações disponíveis
   */
  async getServiceVariationsFromCatalog(
    companyId: string,
    serviceType: AppointmentType
  ): Promise<ServiceVariation[]> {
    try {
      const aiKnowledge = await prisma.aIKnowledge.findUnique({
        where: { companyId },
        select: { products: true }
      });

      if (!aiKnowledge?.products) return [];

      const products = Array.isArray(aiKnowledge.products)
        ? aiKnowledge.products
        : JSON.parse(typeof aiKnowledge.products === 'string' ? aiKnowledge.products : '[]');

      // Termos de busca baseados no tipo de serviço
      const searchTerms: string[] = [];
      switch (serviceType) {
        case AppointmentType.INSTALLATION:
          searchTerms.push('inst', 'instalação', 'instalacao', 'instalar');
          break;
        case AppointmentType.MAINTENANCE:
          searchTerms.push('manut', 'manutenção', 'manutencao', 'limpeza');
          break;
        case AppointmentType.CONSULTATION:
          searchTerms.push('consulta', 'orçamento', 'orcamento', 'visita');
          break;
        default:
          break;
      }

      // Busca TODAS as variações no catálogo
      const variations: ServiceVariation[] = [];

      for (const product of products) {
        const productName = (product.name || '').toLowerCase();
        const productCategory = (product.category || '').toLowerCase();

        const matches = searchTerms.some(term =>
          productName.includes(term) || productCategory.includes(term)
        );

        if (matches) {
          variations.push({
            name: product.name,
            price: product.price ? `R$ ${product.price}`.replace('R$ R$', 'R$') : 'Consultar',
            duration: product.duration ? parseInt(product.duration) : undefined,
            description: product.description
          });
        }
      }

      return variations;

    } catch (error) {
      console.error('[AIAppointment] Erro ao buscar variações do catálogo:', error);
      return [];
    }
  }

  /**
   * Busca informações do serviço no catálogo da empresa
   * Retorna nome, preço e duração se encontrado (primeira correspondência)
   */
  async getServiceFromCatalog(
    companyId: string,
    serviceType: AppointmentType,
    searchTerm?: string
  ): Promise<{ name?: string; price?: string; duration?: number } | null> {
    try {
      const aiKnowledge = await prisma.aIKnowledge.findUnique({
        where: { companyId },
        select: { products: true }
      });

      if (!aiKnowledge?.products) return null;

      const products = Array.isArray(aiKnowledge.products)
        ? aiKnowledge.products
        : JSON.parse(typeof aiKnowledge.products === 'string' ? aiKnowledge.products : '[]');

      // Termos de busca baseados no tipo de serviço
      const searchTerms: string[] = [];
      if (searchTerm) searchTerms.push(searchTerm.toLowerCase());

      switch (serviceType) {
        case AppointmentType.INSTALLATION:
          searchTerms.push('instalação', 'instalacao', 'instalar');
          break;
        case AppointmentType.MAINTENANCE:
          searchTerms.push('manutenção', 'manutencao', 'manutenção preventiva');
          break;
        case AppointmentType.CONSULTATION:
          searchTerms.push('consulta', 'orçamento', 'orcamento', 'visita técnica');
          break;
        default:
          break;
      }

      // Busca no catálogo
      for (const product of products) {
        const productName = (product.name || '').toLowerCase();
        const productCategory = (product.category || '').toLowerCase();

        const matches = searchTerms.some(term =>
          productName.includes(term) || productCategory.includes(term)
        );

        if (matches) {
          return {
            name: product.name,
            price: product.price ? `R$ ${product.price}`.replace('R$ R$', 'R$') : undefined,
            duration: product.duration ? parseInt(product.duration) : undefined
          };
        }
      }

      return null;
    } catch (error) {
      console.error('[AIAppointment] Erro ao buscar serviço no catálogo:', error);
      return null;
    }
  }

  /**
   * Enriquece o estado com informações do catálogo
   */
  async enrichStateWithCatalogInfo(
    state: AppointmentState,
    companyId: string,
    searchTerm?: string
  ): Promise<void> {
    if (!state.serviceType) return;

    const catalogInfo = await this.getServiceFromCatalog(companyId, state.serviceType, searchTerm);

    if (catalogInfo) {
      if (catalogInfo.name) state.serviceName = catalogInfo.name;
      if (catalogInfo.price) state.servicePrice = catalogInfo.price;
      if (catalogInfo.duration) state.duration = catalogInfo.duration;
    }
  }
}

export const aiAppointmentService = new AIAppointmentService();
