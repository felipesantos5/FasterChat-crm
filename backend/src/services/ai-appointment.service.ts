import { prisma } from '../utils/prisma';
import { appointmentService } from './appointment.service';
import { AppointmentType } from '@prisma/client';

/**
 * Cria uma data no timezone do Brasil (America/Sao_Paulo)
 * Garante que quando o cliente fala "08:00", é realmente 08:00 no horário de Brasília
 */
function createBrazilDateTime(dateString: string, timeString: string): Date {
  // Parse da data YYYY-MM-DD
  const [year, month, day] = dateString.split('-').map(Number);
  // Parse da hora HH:mm
  const [hours, minutes] = timeString.split(':').map(Number);

  // Cria a data no timezone local
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);

  console.log('[AIAppointment] Criando data Brasil:', dateString, timeString);
  console.log('[AIAppointment]   ISO:', date.toISOString());
  console.log('[AIAppointment]   BR:', date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));

  return date;
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
        response: `Beleza! Vou agendar uma **${typeLabel}** pra você. 👍\n\nQue dia funciona melhor? Me fala o dia da semana ou a data mesmo (ex: segunda-feira, 05/12).`
      };
    }

    // Não detectou tipo, pergunta
    const state: AppointmentState = {
      step: 'COLLECTING_TYPE'
    };

    await this.saveAppointmentState(customerId, state);

    return {
      response: `Show! Vou agendar pra você. 😊\n\nQue tipo de serviço você precisa?\n\n1️⃣ Instalação\n2️⃣ Manutenção\n3️⃣ Consulta/Orçamento\n4️⃣ Outro serviço\n\nÉ só mandar o número ou falar o que precisa!`
    };
  }

  /**
   * Detecta se a mensagem do cliente indica intenção de agendamento
   */
  detectAppointmentIntent(message: string): boolean {
    const lowerMessage = message.toLowerCase();

    // Palavras MUITO FORTES - praticamente garantem intenção de agendamento
    const veryStrongKeywords = [
      'quero agendar', 'quero marcar', 'gostaria de agendar', 'gostaria de marcar',
      'preciso agendar', 'preciso marcar', 'vou agendar', 'vou marcar',
      'posso agendar', 'posso marcar', 'como agendar', 'como marcar',
      'queria agendar', 'queria marcar', 'agendar uma', 'marcar uma',
      'fazer um agendamento', 'fazer uma marcação'
    ];

    // Se tem palavra MUITO forte, é intenção clara
    if (veryStrongKeywords.some(keyword => lowerMessage.includes(keyword))) {
      console.log('[AIAppointment] Very strong intent detected:', message);
      return true;
    }

    // Palavras FORTES - verbos de ação + serviço
    const strongKeywords = [
      'agendar', 'marcar',
      'visita técnica', 'vistoria',
      'quando podem vir', 'que dia podem', 'qual dia podem',
      'que horário', 'qual horário',
      'vocês atendem', 'você atende', 'vocês fazem', 'você faz',
      'tem disponibilidade', 'tem horário', 'tem vaga',
      'podem vir', 'pode vir', 'conseguem vir', 'consegue vir',
      'dá pra ir', 'da pra ir', 'dá pra vir', 'da pra vir'
    ];

    // Se tem palavra forte E menciona serviço, é intenção
    const serviceWords = [
      'instalação', 'instalacao', 'instalar',
      'manutenção', 'manutencao', 'manter',
      'reparo', 'reparação', 'reparacao', 'consertar', 'conserto',
      'limpeza', 'limpar', 'higienização', 'higienizacao',
      'visita', 'atendimento', 'serviço', 'servico'
    ];

    const hasStrongKeyword = strongKeywords.some(keyword => lowerMessage.includes(keyword));
    const hasService = serviceWords.some(word => lowerMessage.includes(word));

    if (hasStrongKeyword && hasService) {
      console.log('[AIAppointment] Strong keyword + service detected:', message);
      return true;
    }

    // Contexto: serviço + necessidade/desejo + (opcional: temporal)
    const needWords = [
      'preciso', 'precisa', 'necessito', 'necessita',
      'quero', 'quer', 'gostaria', 'queria',
      'preciso de', 'quero fazer', 'quero uma',
      'preciso fazer', 'preciso de uma'
    ];

    const temporalWords = [
      'hoje', 'amanhã', 'amanha',
      'essa semana', 'próxima semana', 'próximo', 'proximo',
      'segunda', 'terça', 'terca', 'quarta', 'quinta', 'sexta', 'sábado', 'sabado', 'domingo',
      'urgente', 'rápido', 'rapido', 'logo'
    ];

    const hasNeed = needWords.some(word => lowerMessage.includes(word));
    const hasTemporal = temporalWords.some(word => lowerMessage.includes(word));

    // Se tem necessidade + serviço (com ou sem temporal), é intenção
    if (hasNeed && hasService) {
      console.log('[AIAppointment] Need + service detected:', message);
      return true;
    }

    // Se tem serviço + temporal, também é intenção (ex: "limpeza amanhã")
    if (hasService && hasTemporal) {
      console.log('[AIAppointment] Service + temporal detected:', message);
      return true;
    }

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
   */
  detectDate(message: string): string | null {
    const today = new Date();
    const lowerMessage = message.toLowerCase();

    // Amanhã
    if (lowerMessage.includes('amanhã') || lowerMessage.includes('amanha')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }

    // Hoje
    if (lowerMessage.includes('hoje')) {
      return today.toISOString().split('T')[0];
    }

    // Formato DD/MM ou DD/MM/YYYY
    const dateMatch = message.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]) - 1; // JS months are 0-indexed
      const year = dateMatch[3] ? (dateMatch[3].length === 2 ? 2000 + parseInt(dateMatch[3]) : parseInt(dateMatch[3])) : today.getFullYear();

      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }

    // Dias da semana
    const weekdays = ['domingo', 'segunda', 'terça', 'terca', 'quarta', 'quinta', 'sexta', 'sábado', 'sabado'];
    for (let i = 0; i < weekdays.length; i++) {
      if (lowerMessage.includes(weekdays[i])) {
        const daysUntil = (i - today.getDay() + 7) % 7 || 7;
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() + daysUntil);
        return targetDate.toISOString().split('T')[0];
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
        response: `Tranquilo! Cancelei o agendamento. 👍\n\nSe precisar de qualquer outra coisa, é só me chamar! 😊`
      };
    }

    let state = await this.getAppointmentState(customerId);

    // Se não tem estado ativo, não processa (IA principal deve iniciar)
    if (!state) {
      return { shouldContinue: false };
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
        response: `Não consegui entender... 😅\n\nEscolhe uma dessas opções:\n\n1️⃣ Instalação\n2️⃣ Manutenção\n3️⃣ Consulta/Orçamento\n4️⃣ Outro serviço\n\nÉ só mandar o número!`,
      };
    }

    state.serviceType = serviceType;
    state.duration = this.getDefaultDuration(serviceType);
    state.step = 'COLLECTING_DATE';
    await this.saveAppointmentState(customerId, state);

    return {
      shouldContinue: true,
      response: `Perfeito! ${this.getServiceTypeLabel(serviceType)} agendada. 👍\n\nQue dia é melhor pra você? Me fala o dia da semana ou a data (ex: terça-feira, 10/12).`,
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
        response: `Não entendi a data... 🤔\n\nTenta me falar assim:\n- Segunda-feira\n- Amanhã\n- 10/12\n- 10/12/2025`,
      };
    }

    // Valida se a data não é passada
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      return {
        shouldContinue: true,
        response: `Opa! Essa data já passou... 😅\n\nMe fala uma data a partir de hoje?`,
      };
    }

    state.date = date;

    // Busca horários disponíveis
    try {
      const slots = await appointmentService.getAvailableSlots(companyId, selectedDate, state.duration || 60);

      if (slots.length === 0) {
        return {
          shouldContinue: true,
          response: `Puts, esse dia tá lotado... 😔\n\nTem algum outro dia que funciona pra você?`,
        };
      }

      state.availableSlots = slots;
      state.step = 'COLLECTING_TIME';
      await this.saveAppointmentState(customerId, state);

      // Formata os primeiros 6 slots
      const dateFormatted = selectedDate.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long'
      });

      const slotsText = slots
        .slice(0, 6)
        .map((slot, index) => {
          const time = this.slotToTimeString(slot.start);
          return `${index + 1}️⃣ ${time}`;
        })
        .join('\n');

      return {
        shouldContinue: true,
        response: `Show! 😊 Tenho vários horários livres para **${dateFormatted}**:\n\n${slotsText}\n\nQual desses funciona melhor pra você? Pode mandar o número ou o horário mesmo.`,
      };
    } catch (error: any) {
      console.error('[AIAppointment] Error fetching slots:', error);
      return {
        shouldContinue: true,
        response: `Tive um problema ao buscar os horários. Pode tentar novamente?`,
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

    // Tenta detectar por número (1-6)
    const numberMatch = message.match(/^[1-6]$/);
    if (numberMatch && state.availableSlots) {
      const index = parseInt(numberMatch[0]) - 1;
      const selectedSlot = state.availableSlots[index];

      if (selectedSlot) {
        state.time = this.slotToTimeString(selectedSlot.start);
        state.step = 'COLLECTING_ADDRESS';
        await this.saveAppointmentState(customerId, state);

        return {
          shouldContinue: true,
          response: `Perfeito! 👍 Horário das **${state.time}** reservado.\n\nAgora só preciso saber o endereço onde vou fazer o serviço.\n\nMe manda aí:\n📍 O endereço completo (rua e número)\n🏢 Se for apartamento, o número do AP e bloco também\n\nPode mandar tudo junto mesmo! 😊`
        };
      }
    }

    // Tenta detectar horário no formato HH:mm
    const time = this.detectTime(message);
    if (time && state.availableSlots) {
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
          response: `Beleza! 👍 Horário das **${time}** está reservado.\n\nAgora só preciso saber o endereço onde vou fazer o serviço.\n\nMe manda:\n📍 Endereço completo (rua e número)\n🏢 Se for apartamento/prédio, me passa o número do AP e bloco\n\nPode mandar tudo junto! 😊`
        };
      }

      return {
        shouldContinue: true,
        response: `Poxa, esse horário não tá disponível... 😔\n\nDá uma olhada nos horários que te mostrei e escolhe um deles?`,
      };
    }

    return {
      shouldContinue: true,
      response: `Não consegui entender o horário... 🤔\n\nPode escolher um dos números (1 a 6) que mostrei? Ou me falar o horário tipo "10:00"?`,
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

    const missingInfo = validation.missing.join(' e ');
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

    response += `\nSó falta me mandar o **${missingInfo}** e a gente fecha! 😊`;

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
      addressText = '\n📍 **Endereço:**\n';
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
      response: `Show! Deixa eu confirmar os dados com você:\n\n📋 **Serviço:** ${serviceLabel}\n📅 **Data:** ${dateFormatted}\n🕐 **Horário:** ${state.time}\n⏱️ **Duração:** ${state.duration} minutos${addressText}\nTá tudo certo? 🤔\n\nÉ só responder **SIM** pra confirmar ou **NÃO** se quiser mudar algo.`,
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

        // Log interno apenas - nunca expor detalhes técnicos para o cliente
        if (appointmentResult.googleCalendarSynced) {
          console.log('[AIAppointment] ✅ Agendamento sincronizado com Google Calendar');
        } else if (appointmentResult.googleCalendarError) {
          console.warn('[AIAppointment] ⚠️ Google Calendar error (interno):', appointmentResult.googleCalendarError);
        }

        return {
          shouldContinue: true,
          response: `✅ Pronto! Agendamento confirmado!\n\nSua ${serviceLabel.toLowerCase()} tá marcada pra ${startTime.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} às ${state.time}.\n\nVou te mandar um lembrete no dia anterior, beleza?\n\nPrecisa de mais alguma coisa?`,
        };
      } catch (error: any) {
        console.error('[AIAppointment] Error creating appointment:', error);
        await this.clearAppointmentState(customerId);

        return {
          shouldContinue: true,
          response: `Ops! Deu um problema aqui ao confirmar... 😔\n\nPode tentar de novo? Ou se preferir, falo com um atendente pra te ajudar!`,
        };
      }
    }

    if (lowerMessage.includes('não') || lowerMessage.includes('nao') || lowerMessage.includes('cancelar')) {
      await this.clearAppointmentState(customerId);

      return {
        shouldContinue: true,
        response: `Tranquilo! Cancelei o agendamento. 👍\n\nQuando quiser marcar é só me chamar! 😊`,
      };
    }

    return {
      shouldContinue: true,
      response: `Não entendi... 🤔\n\nÉ só responder **SIM** pra confirmar ou **NÃO** pra cancelar.`,
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
