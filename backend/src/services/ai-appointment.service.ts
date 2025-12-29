import { prisma } from '../utils/prisma';
import { appointmentService } from './appointment.service';
import { AppointmentType } from '@prisma/client';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { parse, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Cria uma data no timezone do Brasil (America/Sao_Paulo)
 * Garante que quando o cliente fala "08:00", é realmente 08:00 no horário de Brasília
 *
 * Usa date-fns-tz para conversão precisa e confiável de timezones
 */
function createBrazilDateTime(dateString: string, timeString: string): Date {
  const timeZone = 'America/Sao_Paulo';

  // Combina data e hora em um único string: "2024-12-30 08:00"
  const dateTimeString = `${dateString} ${timeString}`;

  // Parseia a string de data/hora em um objeto Date
  // IMPORTANTE: Este Date está "sem timezone" (naive), precisamos especificar que é BR
  const naiveDate = parse(dateTimeString, 'yyyy-MM-dd HH:mm', new Date());

  // Converte a data "naive" para UTC, informando que ela está no timezone de São Paulo
  // fromZonedTime: pega uma data no timezone especificado e converte para UTC
  const utcDate = fromZonedTime(naiveDate, timeZone);

  console.log('[AIAppointment] ============================================');
  console.log('[AIAppointment] Criando agendamento no timezone do Brasil');
  console.log('[AIAppointment] ============================================');
  console.log('[AIAppointment] Input:', dateString, timeString);
  console.log('[AIAppointment] Timezone:', timeZone);
  console.log('[AIAppointment] Data parseada (naive):', format(naiveDate, 'dd/MM/yyyy HH:mm:ss', { locale: ptBR }));
  console.log('[AIAppointment] Data UTC (armazenamento):', utcDate.toISOString());
  console.log('[AIAppointment] Confirmação no horário BR:', formatInTimeZone(utcDate, timeZone, 'dd/MM/yyyy HH:mm:ss zzz', { locale: ptBR }));
  console.log('[AIAppointment] ============================================');

  return utcDate;
}

/**
 * Estado do processo de agendamento
 */
interface AppointmentState {
  step: 'COLLECTING_TYPE' | 'COLLECTING_DATE' | 'COLLECTING_TIME' | 'COLLECTING_ADDRESS' | 'CONFIRMING' | 'COMPLETED';
  serviceType?: AppointmentType;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  duration?: number; // minutos
  description?: string;
  availableSlots?: Array<{ start: Date; end: Date }>;
  currentSlotPage?: number; // Controla qual "página" de slots está mostrando (0 = primeiros 6, 1 = próximos 6, etc.)

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

export class AIAppointmentService {
  /**
   * Verifica se existe fluxo de agendamento ativo
   */
  async hasActiveAppointmentFlow(customerId: string): Promise<boolean> {
    const state = await this.getAppointmentState(customerId);
    return state !== null;
  }

  /**
   * Inicia um novo fluxo de agendamento
   */
  async startAppointmentFlow(
    customerId: string,
    companyId: string,
    message: string
  ): Promise<{ response?: string }> {
    console.log(`[AIAppointment] Starting new appointment flow for customer ${customerId}`);

    // 🔥 VERIFICAÇÃO PROATIVA: Checa se Google Calendar está configurado
    const { googleCalendarService } = await import('./google-calendar.service');
    const isGoogleCalendarConfigured = await googleCalendarService.isConfigured(companyId);

    if (!isGoogleCalendarConfigured) {
      console.warn('[AIAppointment] ⚠️ Google Calendar não configurado - agendamento será apenas no sistema');
    }

    // Detecta tipo de serviço na mensagem inicial
    const serviceType = this.detectServiceType(message);

    if (serviceType) {
      // Já detectou o tipo, pula direto para data
      const state: AppointmentState = {
        step: 'COLLECTING_DATE',
        serviceType,
        duration: this.getDefaultDuration(serviceType)
      };

      await this.saveAppointmentState(customerId, state);

      const typeLabel = this.getServiceTypeLabel(serviceType);
      return {
        response: `Opa, beleza! Vou agendar ${typeLabel} pra você 👍\n\nQual dia fica bom para você?`
      };
    }

    // Não detectou tipo, pergunta
    const state: AppointmentState = {
      step: 'COLLECTING_TYPE'
    };

    await this.saveAppointmentState(customerId, state);

    return {
      response: `Show! Posso agendar pra você sim 😊\n\nQue tipo de serviço você precisa?\n\n1️⃣ Instalação\n2️⃣ Manutenção\n3️⃣ Consulta/Orçamento\n4️⃣ Outro\n\nPode mandar o número ou falar direto o que precisa!`
    };
  }

  /**
   * Detecta se a mensagem do cliente indica intenção de agendamento
   *
   * ⚠️ REGRA CRÍTICA: Esta função DEVE ser EXTREMAMENTE restritiva!
   * Apenas detecta intenção quando o cliente EXPLICITAMENTE pede para agendar.
   * Perguntas, dúvidas, solicitações de informação NÃO são intenção de agendamento.
   */
  detectAppointmentIntent(message: string): boolean {
    const lowerMessage = message.toLowerCase();

    // 🚫 BLOQUEIO PRIORITÁRIO: Perguntas e dúvidas NUNCA são intenção de agendamento
    const questionIndicators = [
      'qual', 'quais', 'que', 'como', 'onde', 'quando', 'quanto', 'quantos', 'quantas',
      'tem', 'possui', 'possuem', 'oferece', 'oferecem', 'vende', 'vendem',
      'fazem', 'faz', 'atendem', 'atende', 'trabalham', 'trabalha',
      'me fala', 'me diz', 'pode falar', 'pode me dizer', 'pode me falar',
      'gostaria de saber', 'queria saber', 'quero saber',
      'me explica', 'explica', 'explicar', 'informação', 'informações', 'informacao', 'informacoes',
      'dúvida', 'duvida', 'dúvidas', 'duvidas'
    ];

    // Se detectar qualquer indicador de pergunta, NÃO é agendamento
    if (questionIndicators.some(word => lowerMessage.includes(word))) {
      console.log('[AIAppointment] ❌ Question/doubt detected - NOT appointment intent:', message);
      return false;
    }

    // ✅ APENAS palavras EXTREMAMENTE específicas de agendamento
    const explicitAppointmentKeywords = [
      'quero agendar', 'quero marcar',
      'gostaria de agendar', 'gostaria de marcar',
      'preciso agendar', 'preciso marcar',
      'vou agendar', 'vou marcar',
      'posso agendar', 'posso marcar',
      'queria agendar', 'queria marcar',
      'agendar uma', 'marcar uma',
      'fazer um agendamento', 'fazer uma marcação',
      'agendar um horário', 'marcar um horário',
      'agendar visita', 'marcar visita',
      'quero um horário', 'quero horário',
      'preciso de um horário'
    ];

    // Se tem palavra explícita de agendamento, É intenção clara
    if (explicitAppointmentKeywords.some(keyword => lowerMessage.includes(keyword))) {
      console.log('[AIAppointment] ✅ Explicit appointment keyword detected:', message);
      return true;
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

    return null;
  }

  /**
   * Detecta horário na mensagem
   */
  detectTime(message: string): string | null {
    const lowerMessage = message.toLowerCase();

    // Formato HH:mm ou HH:mm ou "Hh"
    const timeMatch = message.match(/(\d{1,2})[h:](\d{2})|(\d{1,2})h/);
    if (timeMatch) {
      const hour = timeMatch[1] || timeMatch[3];
      const minute = timeMatch[2] || '00';
      return `${hour.padStart(2, '0')}:${minute}`;
    }

    // Padrões como "as 10", "às 14", "10 horas"
    const simpleTimeMatch = lowerMessage.match(/(?:as|às)\s+(\d{1,2})|(\d{1,2})\s*(?:horas?|hrs?)/);
    if (simpleTimeMatch) {
      const hour = simpleTimeMatch[1] || simpleTimeMatch[2];
      return `${hour.padStart(2, '0')}:00`;
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

    // Períodos do dia genéricos (sem hora específica)
    if (lowerMessage.includes('manhã') || lowerMessage.includes('manha')) {
      return '09:00';
    }
    if (lowerMessage.includes('tarde')) {
      return '14:00';
    }
    if (lowerMessage.includes('noite')) {
      return '18:00';
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
   * Busca ou cria o estado de agendamento para um cliente
   */
  async getAppointmentState(customerId: string): Promise<AppointmentState | null> {
    const conversation = await prisma.conversation.findUnique({
      where: { customerId },
    });

    if (!conversation?.appointmentState) {
      return null;
    }

    return conversation.appointmentState as unknown as AppointmentState;
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
    _companyId: string,
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
    state.step = 'COLLECTING_DATE';
    await this.saveAppointmentState(customerId, state);

    return {
      shouldContinue: true,
      response: `Perfeito! ${this.getServiceTypeLabel(serviceType)} anotado aqui 👍\n\nQual dia é melhor pra você? Pode falar o dia da semana ou mandar a data direto (tipo: terça-feira ou 10/12)`,
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

    const serviceLabel = this.getServiceTypeLabel(state.serviceType!);

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

    return {
      shouldContinue: true,
      response: `Show! Deixa eu confirmar os dados:\n\n📋 Serviço: ${serviceLabel}\n📅 Data: ${dateFormatted}\n🕐 Horário: ${state.time}\n⏱️ Duração: ${state.duration} minutos${addressText}\nTá tudo certo?\n\nÉ só responder SIM pra confirmar ou NÃO se quiser mudar algo`,
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
}

export const aiAppointmentService = new AIAppointmentService();
