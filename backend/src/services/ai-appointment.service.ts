import { prisma } from '../utils/prisma';
import { appointmentService } from './appointment.service';
import { AppointmentType } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Cria uma data no timezone do Brasil (America/Sao_Paulo)
 *
 * ABORDAGEM SIMPLIFICADA:
 * - Cria a Date diretamente usando o offset de São Paulo (-03:00)
 * - Evita conversões desnecessárias que causam bugs de timezone
 * - O Google Calendar receberá a data no formato correto
 */
function createBrazilDateTime(dateString: string, timeString: string): Date {
  // São Paulo está em UTC-3 (Brasil não usa mais horário de verão desde 2019)
  const SAO_PAULO_OFFSET = '-03:00';

  // Cria a data diretamente no formato ISO com o offset correto
  // Exemplo: "2025-01-02T14:00:00-03:00"
  const isoString = `${dateString}T${timeString}:00${SAO_PAULO_OFFSET}`;

  const date = new Date(isoString);

  console.log('[AIAppointment] ============================================');
  console.log('[AIAppointment] CRIANDO AGENDAMENTO - TIMEZONE BRASIL');
  console.log('[AIAppointment] ============================================');
  console.log('[AIAppointment] Input:', dateString, timeString);
  console.log('[AIAppointment] ISO String criada:', isoString);
  console.log('[AIAppointment] Date UTC (interno):', date.toISOString());
  console.log('[AIAppointment] Hora em São Paulo:', timeString, '(o que o cliente pediu)');
  console.log('[AIAppointment] ============================================');

  return date;
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
 * Estado do processo de agendamento
 */
interface AppointmentState {
  step: 'COLLECTING_TYPE' | 'SELECTING_SERVICE_VARIATION' | 'COLLECTING_DATE' | 'COLLECTING_TIME' | 'COLLECTING_ADDRESS' | 'CONFIRMING' | 'COMPLETED';
  serviceType?: AppointmentType;
  serviceName?: string; // Nome real do serviço (ex: "Instalação de Ar Condicionado 12000 BTUs")
  servicePrice?: string; // Preço do serviço (ex: "R$ 350,00")
  serviceVariations?: ServiceVariation[]; // Variações disponíveis quando há múltiplos serviços do mesmo tipo
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
    console.log('[AIAppointment] 🔍 Detectando todos os dados da mensagem:', message);

    const result: DetectedAppointmentData = {
      serviceType: this.detectServiceType(message),
      date: this.detectDate(message),
      time: this.detectTime(message),
      address: this.detectAddressFromMessage(message),
    };

    console.log('[AIAppointment] 📊 Dados detectados:', {
      serviceType: result.serviceType,
      date: result.date,
      time: result.time,
      hasAddress: result.address !== null,
    });

    return result;
  }

  /**
   * 🆕 Detecta endereço completo de uma mensagem
   *
   * Reconhece padrões como:
   * - "Rua das Flores, 123"
   * - "Av. Brasil 456 apto 12"
   * - "na Rua X número 789"
   * - CEP: "12345-678"
   */
  private detectAddressFromMessage(message: string): DetectedAppointmentData['address'] | null {
    const address: DetectedAppointmentData['address'] = {};
    let hasAnyData = false;

    // Detecta CEP
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

    // Detecta rua/avenida com padrões mais robustos
    const streetPatterns = [
      // "Rua das Flores, 123" ou "Rua das Flores 123"
      /(?:rua|r\.?|avenida|av\.?|alameda|al\.?|travessa|tv\.?|praça|pç\.?)\s+([^,\d]+?)[\s,]+(\d+)/i,
      // "na Rua X número 123"
      /(?:na|em|no)\s+(?:rua|avenida|av\.?|alameda)\s+([^,\d]+?)[\s,]+(?:n[ºo°]?\s*)?(\d+)/i,
      // Padrão mais genérico para endereços
      /([A-Za-zÀ-ÿ\s]+?)[\s,]+(?:n[ºo°]?\s*)?(\d+)(?:\s|,|$)/,
    ];

    for (const pattern of streetPatterns) {
      const match = message.match(pattern);
      if (match) {
        const potentialStreet = match[1].trim();
        const number = match[2];

        // Valida que não é só um número ou palavra muito curta
        if (potentialStreet.length > 3 && !potentialStreet.match(/^\d+$/)) {
          // Ignora se for uma palavra comum que não é endereço
          const ignoreWords = ['quero', 'agendar', 'marcar', 'instalar', 'instalação', 'manutenção', 'às', 'dia', 'hora'];
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

    // Se não detectou rua mas detectou número isolado
    if (!address.street && !address.number) {
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
    if (!state.serviceType) return 'COLLECTING_TYPE';
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
      case 'COLLECTING_TYPE':
        response += `Que tipo de serviço você precisa?\n\n1️⃣ Instalação\n2️⃣ Manutenção\n3️⃣ Consulta/Orçamento\n4️⃣ Outro`;
        break;
      case 'COLLECTING_DATE':
        response += `Qual dia é melhor pra você? Pode falar "amanhã", "segunda-feira" ou mandar a data (ex: 10/12)`;
        break;
      case 'COLLECTING_TIME':
        response += `Vou buscar os horários disponíveis...`;
        break;
      case 'COLLECTING_ADDRESS':
        response += `Agora só preciso do endereço completo.\n\nMe manda a rua e o número!`;
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
    console.log(`[AIAppointment] ============================================`);
    console.log(`[AIAppointment] 🚀 INICIANDO FLUXO INTELIGENTE DE AGENDAMENTO`);
    console.log(`[AIAppointment] Customer: ${customerId}`);
    console.log(`[AIAppointment] Mensagem: "${message}"`);
    console.log(`[AIAppointment] ============================================`);

    // 🔥 VERIFICAÇÃO PROATIVA: Checa se Google Calendar está configurado
    const { googleCalendarService } = await import('./google-calendar.service');
    const isGoogleCalendarConfigured = await googleCalendarService.isConfigured(companyId);

    if (!isGoogleCalendarConfigured) {
      console.warn('[AIAppointment] ⚠️ Google Calendar não configurado - agendamento será apenas no sistema');
    }

    // 🆕 DETECÇÃO MÚLTIPLA: Extrai todos os dados possíveis de uma vez
    const detected = this.detectAllFromMessage(message);

    // Monta o estado inicial com tudo que foi detectado
    const state: AppointmentState = {
      step: 'COLLECTING_TYPE', // Será ajustado abaixo
      createdAt: new Date().toISOString(), // Para expiração
    };

    // Aplica dados detectados ao estado
    if (detected.serviceType) {
      state.serviceType = detected.serviceType;
      state.duration = this.getDefaultDuration(detected.serviceType);
    }
    if (detected.date) {
      state.date = detected.date;
    }
    // 🚨 NÃO aplicar horário automaticamente - cliente DEVE escolher da lista
    // O horário detectado será usado apenas para sugerir/validar
    if (detected.address) {
      state.address = detected.address;
    }

    // 🆕 Busca nome e preço do serviço no catálogo da empresa
    if (state.serviceType) {
      await this.enrichStateWithCatalogInfo(state, companyId, message);
    }

    // Determina o próximo step baseado no que foi detectado
    // IMPORTANTE: Se tem data mas não tem horário escolhido, força COLLECTING_TIME
    if (state.serviceType && state.date && !state.time) {
      state.step = 'COLLECTING_TIME';
    } else {
      state.step = this.determineNextStep(state);
    }

    console.log(`[AIAppointment] 📊 Estado inicial:`, {
      step: state.step,
      serviceType: state.serviceType,
      serviceName: state.serviceName,
      servicePrice: state.servicePrice,
      date: state.date,
      time: state.time,
      hasAddress: !!state.address,
    });

    // 🆕 CENÁRIO 1: Detectou tipo e data → SEMPRE buscar e mostrar horários disponíveis
    if (state.serviceType && state.date && state.step === 'COLLECTING_TIME') {
      // Busca horários disponíveis
      const selectedDate = new Date(state.date);
      try {
        const slots = await appointmentService.getAvailableSlots(companyId, selectedDate, state.duration || 60);

        if (slots.length === 0) {
          // Dia lotado, volta pra pedir outra data
          state.date = undefined;
          state.step = 'COLLECTING_DATE';
          await this.saveAppointmentState(customerId, state);

          const typeLabel = this.getServiceTypeLabel(state.serviceType);
          return {
            response: `Entendi! ${typeLabel} anotado 👍\n\nMas putz, esse dia tá sem horários disponíveis 😔\n\nTem outro dia que funciona pra você?`
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

            const typeLabel = this.getServiceTypeLabel(state.serviceType);
            const dateFormatted = selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

            return {
              response: `Show! Tudo anotado:\n📋 ${typeLabel}\n📅 ${dateFormatted}\n🕐 ${state.time}\n\nAgora só preciso do endereço onde vou fazer o serviço.\n\nMe manda a rua e o número! 📍`
            };
          } else {
            // Horário não disponível, mostra opções
            console.log(`[AIAppointment] Horário ${detected.time} não disponível, mostrando alternativas`);
          }
        }

        await this.saveAppointmentState(customerId, state);

        // Mostra horários disponíveis
        const typeLabel = this.getServiceTypeLabel(state.serviceType);
        const dateFormatted = selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

        const slotsToShow = slots.slice(0, 6);
        const slotsText = slotsToShow
          .map((slot, index) => `${index + 1}️⃣ ${this.slotToTimeString(slot.start)}`)
          .join('\n');

        let response = `Beleza! ${typeLabel} pra ${dateFormatted} 👍\n\n`;

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

    // 🆕 CENÁRIO 4: Detectou apenas o tipo → Pede a data
    if (state.serviceType && state.step === 'COLLECTING_DATE') {
      await this.saveAppointmentState(customerId, state);

      const typeLabel = this.getServiceTypeLabel(state.serviceType);
      return {
        response: `Opa, beleza! Vou agendar ${typeLabel} pra você 👍\n\nQual dia fica bom? Pode falar "amanhã", "segunda-feira" ou mandar a data (ex: 10/12)`
      };
    }

    // 🆕 CENÁRIO 5: Não detectou tipo → Pergunta
    await this.saveAppointmentState(customerId, state);

    return {
      response: `Show! Posso agendar pra você sim 😊\n\nQue tipo de serviço você precisa?\n\n1️⃣ Instalação\n2️⃣ Manutenção\n3️⃣ Consulta/Orçamento\n4️⃣ Outro\n\nPode mandar o número ou falar direto o que precisa!`
    };
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
      console.log('[AIAppointment] ✅ Explicit appointment keyword detected:', message);
      return true;
    }

    // Se é só pergunta sem intenção de agendamento, retorna false
    if (hasQuestionIndicator) {
      console.log('[AIAppointment] ❌ Question/doubt detected - NOT appointment intent:', message);
      return false;
    }

    // Mais nada! Se não tem palavra EXPLÍCITA de agendamento, retorna false
    console.log('[AIAppointment] ❌ No explicit appointment intent detected');
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
      console.log(`[AIAppointment] Detectado: amanhã = ${result}`);
      return result;
    }

    // Hoje
    if (lowerMessage.includes('hoje')) {
      const result = format(nowInBrazil, 'yyyy-MM-dd');
      console.log(`[AIAppointment] Detectado: hoje = ${result}`);
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
        console.log(`[AIAppointment] Detectado: data formatada ${day}/${month + 1}/${year} = ${result}`);
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
        console.log(`[AIAppointment] Detectado: "dia ${dayNumber}"`);
        console.log(`[AIAppointment]   - Mês alvo: ${format(targetDate, 'MMMM/yyyy', { locale: ptBR })}`);
        console.log(`[AIAppointment]   - Data final: ${result} (${format(targetDate, 'EEEE, dd/MM/yyyy', { locale: ptBR })})`);

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

        console.log(`[AIAppointment] Detectado: ${weekdayName}`);
        console.log(`[AIAppointment]   - Índice do dia: ${weekdayIndex}`);
        console.log(`[AIAppointment]   - Hoje é: ${todayWeekday} (${format(nowInBrazil, 'EEEE', { locale: ptBR })})`);
        console.log(`[AIAppointment]   - Dias até: ${daysUntil}`);
        console.log(`[AIAppointment]   - Data final: ${result} (${format(targetDate, 'EEEE, dd/MM/yyyy', { locale: ptBR })})`);

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
      console.log(`[AIAppointment] Detectado: próxima semana (segunda-feira) = ${result}`);
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
   */
  detectAddressNumber(message: string): string | null {
    // Procura por padrões como "n 123", "numero 123", "número 123", "nº 123"
    const patterns = [
      /\bn[úu]mero\s+(\d+)/i,
      /\bn[ºo°]?\s*(\d+)/i,
      /\b(\d+)\s*$/,  // Número no final da mensagem
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1];
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

    if (!address?.number) {
      missing.push('número');
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
      console.log(`[AIAppointment] ⏰ Estado expirado após 24h para customer ${customerId}`);
      console.log(`[AIAppointment]   - Criado em: ${stateCreatedAt}`);
      console.log(`[AIAppointment]   - Idade: ${Math.round(stateAge / (60 * 60 * 1000))} horas`);

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
    if (
      lowerMessage.includes('cancelar agendamento') ||
      lowerMessage.includes('desistir') ||
      lowerMessage.includes('não quero mais') ||
      lowerMessage.includes('nao quero mais') ||
      lowerMessage.includes('voltar') ||
      lowerMessage.includes('sair')
    ) {
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

    // 🆕 DETECÇÃO MÚLTIPLA: Tenta extrair todos os dados possíveis da mensagem
    const detected = this.detectAllFromMessage(message);

    // Aplica dados detectados que ainda não existem no estado
    let dataUpdated = false;
    let dateWasJustSet = false;

    if (detected.serviceType && !state.serviceType) {
      state.serviceType = detected.serviceType;
      state.duration = this.getDefaultDuration(detected.serviceType);
      dataUpdated = true;
      console.log('[AIAppointment] 🆕 Tipo de serviço detectado durante fluxo:', detected.serviceType);
    }

    if (detected.date && !state.date) {
      state.date = detected.date;
      dataUpdated = true;
      dateWasJustSet = true;
      console.log('[AIAppointment] 🆕 Data detectada durante fluxo:', detected.date);
    }

    // 🚨 IMPORTANTE: Quando detectar data, SEMPRE buscar horários disponíveis PRIMEIRO
    // NÃO aceitar horário automático - cliente DEVE escolher
    if (dateWasJustSet && state.serviceType && state.date) {
      console.log('[AIAppointment] 📅 Data detectada - buscando horários disponíveis...');

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
      console.log('[AIAppointment] 🆕 Endereço detectado durante fluxo:', detected.address);
    }

    // Se detectou apenas endereço (não data), verifica se pode ir para confirmação
    if (dataUpdated && !dateWasJustSet) {
      const nextStep = this.determineNextStep(state);

      // Se o próximo step pulou etapas, atualiza o state
      if (nextStep !== state.step) {
        console.log(`[AIAppointment] ⏭️ Pulando de ${state.step} para ${nextStep}`);
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

      console.log(`[AIAppointment] Mudança detectada: ${field} = ${value}`);

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

          const typeLabel = this.getServiceTypeLabel(serviceType);
          return {
            shouldContinue: true,
            response: `Beleza! Mudei pra ${typeLabel} 👍\n\nQual dia é melhor pra você?`
          };
        }
      }
    }

    // Processa baseado no step atual
    switch (state.step) {
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
   * Step 2: Coletando tipo de serviço (se não foi detectado)
   */
  private async handleCollectingType(
    customerId: string,
    companyId: string,
    message: string,
    state: AppointmentState
  ): Promise<{ shouldContinue: boolean; response: string }> {
    const lowerMessage = message.toLowerCase();
    let serviceType: AppointmentType | null = null;

    // Tenta detectar por número ou palavra-chave
    if (lowerMessage.includes('1') || lowerMessage.includes('instalação') || lowerMessage.includes('instalacao')) {
      serviceType = AppointmentType.INSTALLATION;
    } else if (lowerMessage.includes('2') || lowerMessage.includes('manutenção') || lowerMessage.includes('manutencao')) {
      serviceType = AppointmentType.MAINTENANCE;
    } else if (lowerMessage.includes('3') || lowerMessage.includes('orçamento') || lowerMessage.includes('consulta')) {
      serviceType = AppointmentType.CONSULTATION;
    } else if (lowerMessage.includes('4') || lowerMessage.includes('outro')) {
      serviceType = AppointmentType.OTHER;
    }

    if (!serviceType) {
      return {
        shouldContinue: true,
        response: `Não entendi qual serviço você precisa 😅\n\nEscolhe uma opção:\n\n1️⃣ Instalação\n2️⃣ Manutenção\n3️⃣ Consulta/Orçamento\n4️⃣ Outro\n\nPode mandar o número`,
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

      const typeLabel = this.getServiceTypeLabel(serviceType);
      const variationsText = variations.slice(0, 10).map((v, i) =>
        `${i + 1}️⃣ ${v.name} - ${v.price}`
      ).join('\n');

      return {
        shouldContinue: true,
        response: `Temos várias opções de ${typeLabel}! 📋\n\n${variationsText}\n\nQual desses você precisa? Pode mandar o número ou falar o nome`,
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
      response: `Perfeito! ${serviceLabel}${priceInfo} anotado 👍\n\nQual dia é melhor pra você? Pode falar o dia da semana ou mandar a data direto (tipo: terça-feira ou 10/12)`,
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
      response: `Ótimo! ${selectedVariation.name} - ${selectedVariation.price} 👍\n\nQual dia é melhor pra você? Pode falar o dia da semana ou mandar a data (ex: amanhã, segunda, 10/12)`
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
        response: `Não consegui entender a data 🤔\n\nPode tentar de novo? Pode ser:\n- Segunda-feira\n- Amanhã\n- 10/12\n- 10/12/2025`,
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
          response: `Fechado! Horário das ${state.time} tá reservado 👍\n\nAgora só preciso do endereço onde vou fazer o serviço\n\nMe manda:\n📍 Rua/Avenida e número da casa\n🏢 Se for apartamento, manda o AP e bloco também\n🏢 CEP se souber\n\nPode mandar tudo junto!`
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
          response: `Beleza! Horário das ${time} tá reservado 👍\n\nAgora preciso do endereço onde vou fazer o serviço\n\nMe manda:\n📍 Rua/Avenida e número da casa\n🏢 Se for apartamento/prédio, o AP e bloco\n🏢 CEP se souber\n\nPode mandar tudo de uma vez!`
        };
      }

      return {
        shouldContinue: true,
        response: `Poxa, esse horário ${time} não tá disponível 😔\n\nDá uma olhada nos horários que mostrei e escolhe um deles? Ou fala "mais tarde" pra ver outras opções`,
      };
    }

    return {
      shouldContinue: true,
      response: `Não entendi o horário 🤔\n\nPode escolher um dos números (1 a 6) que mostrei? Ou mandar o horário tipo 10:00\n\nSe quiser ver outros horários, fala "mais tarde" ou "mais cedo"`,
    };
  }

  /**
   * Step 5: Coletando endereço
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

    // Detecta CEP
    const cep = this.detectCEP(message);
    if (cep && !state.address.cep) {
      state.address.cep = cep;
      console.log('[AIAppointment] CEP detected:', cep);
    }

    // Detecta número do endereço
    const number = this.detectAddressNumber(message);
    if (number && !state.address.number) {
      state.address.number = number;
      console.log('[AIAppointment] Address number detected:', number);
    }

    // Detecta complemento (apartamento, bloco, etc.)
    const complement = this.detectComplement(message);
    if (complement && !state.address.complement) {
      state.address.complement = complement;
      console.log('[AIAppointment] Complement detected:', complement);
    }

    // Se não tem CEP mas tem texto, considera como endereço completo
    if (!state.address.cep && !state.address.street && message.length > 10) {
      // Remove número e complemento já detectados para pegar só a rua
      let street = message;
      if (number) {
        street = street.replace(new RegExp(`\\b${number}\\b`, 'g'), '').trim();
      }
      if (complement) {
        street = street.replace(complement, '').trim();
      }

      // Limpa pontuação extra
      street = street.replace(/[,;]+$/, '').trim();

      if (street.length > 5) {
        state.address.street = street;
        console.log('[AIAppointment] Street detected:', street);
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

    let response = `Legal! Já anotei aqui: 📝\n\n`;

    if (state.address.cep) {
      response += `✓ CEP: ${state.address.cep}\n`;
    }
    if (state.address.street) {
      response += `✓ Endereço: ${state.address.street}\n`;
    }
    if (state.address.number) {
      response += `✓ Número: ${state.address.number}\n`;
    }
    if (state.address.complement) {
      response += `✓ Complemento: ${state.address.complement}\n`;
    }

    // Mensagens customizadas baseadas no que está faltando
    if (!state.address.number && validation.missing.includes('número')) {
      response += `\n\nPra finalizar, só falta o número da casa/prédio. Pode mandar? 🏠`;
    } else {
      const missingInfo = validation.missing.join(' e ');
      response += `\n\nSó falta o ${missingInfo} e a gente fecha!`;
    }

    return {
      shouldContinue: true,
      response
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

    // Usa o nome real do serviço se disponível, senão usa o label genérico
    const serviceLabel = state.serviceName || this.getServiceTypeLabel(state.serviceType!);

    // Formata endereço
    let addressText = '';
    if (state.address?.street || state.address?.cep) {
      addressText = '\n📍 Endereço:\n';
      if (state.address.street) {
        addressText += `   ${state.address.street}`;
        if (state.address.number) {
          addressText += `, ${state.address.number}`;
        }
        addressText += '\n';
      } else if (state.address.cep) {
        addressText += `   CEP: ${state.address.cep}`;
        if (state.address.number) {
          addressText += ` - Nº ${state.address.number}`;
        }
        addressText += '\n';
      }
      if (state.address.complement) {
        addressText += `   ${state.address.complement}\n`;
      }
    }

    // Adiciona preço se disponível
    const priceText = state.servicePrice ? `\n💰 Valor: ${state.servicePrice}` : '';

    return {
      shouldContinue: true,
      response: `Show! Deixa eu confirmar os dados:\n\n📋 Serviço: ${serviceLabel}\n📅 Data: ${dateFormatted}\n🕐 Horário: ${state.time}\n⏱️ Duração: ${state.duration} minutos${priceText}${addressText}\nTá tudo certo?\n\nÉ só responder SIM pra confirmar ou NÃO se quiser mudar algo`,
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

    if (lowerMessage.includes('sim') || lowerMessage.includes('confirmar') || lowerMessage.includes('confirmo')) {
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

        console.log('[AIAppointment] Agendamento sendo criado:');
        console.log('[AIAppointment]   Início:', startTime.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
        console.log('[AIAppointment]   Fim:', endTime.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));

        const serviceLabel = this.getServiceTypeLabel(state.serviceType!);
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
        console.log('[AIAppointment] ============================================');
        console.log('[AIAppointment] 📋 RESULTADO DO AGENDAMENTO');
        console.log('[AIAppointment] ============================================');
        console.log('[AIAppointment] Appointment ID:', appointmentResult.id);
        console.log('[AIAppointment] Google Calendar sincronizado:', appointmentResult.googleCalendarSynced ? 'SIM ✅' : 'NÃO ❌');

        if (appointmentResult.googleCalendarSynced) {
          console.log('[AIAppointment] ✅ Evento criado no Google Calendar com sucesso!');
        } else if (appointmentResult.googleCalendarError) {
          console.warn('[AIAppointment] ⚠️ Erro Google Calendar:', appointmentResult.googleCalendarError);
        }
        console.log('[AIAppointment] ============================================');

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
  private getDefaultDuration(type: AppointmentType): number {
    switch (type) {
      case AppointmentType.INSTALLATION: return 120; // 2 horas
      case AppointmentType.MAINTENANCE: return 60; // 1 hora
      case AppointmentType.CONSULTATION: return 30; // 30 minutos
      case AppointmentType.VISIT: return 60; // 1 hora
      case AppointmentType.OTHER: return 60; // 1 hora
      default: return 60;
    }
  }

  private getServiceTypeLabel(type: AppointmentType): string {
    switch (type) {
      case AppointmentType.INSTALLATION: return 'Instalação';
      case AppointmentType.MAINTENANCE: return 'Manutenção';
      case AppointmentType.CONSULTATION: return 'Consulta/Orçamento';
      case AppointmentType.VISIT: return 'Visita';
      case AppointmentType.OTHER: return 'Serviço';
      default: return 'Serviço';
    }
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

      console.log(`[AIAppointment] Encontradas ${variations.length} variações de ${serviceType} no catálogo`);
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
          console.log('[AIAppointment] Serviço encontrado no catálogo:', product.name);
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

      console.log('[AIAppointment] Estado enriquecido com dados do catálogo:', {
        serviceName: state.serviceName,
        servicePrice: state.servicePrice,
        duration: state.duration
      });
    }
  }
}

export const aiAppointmentService = new AIAppointmentService();
