/**
 * Erros customizados com códigos e mensagens amigáveis em português
 * Esses erros são enviados ao frontend com informações claras para o usuário
 */

export enum ErrorCode {
  // WhatsApp Errors
  WHATSAPP_DISCONNECTED = 'WHATSAPP_DISCONNECTED',
  WHATSAPP_CONNECTING = 'WHATSAPP_CONNECTING',
  WHATSAPP_INSTANCE_NOT_FOUND = 'WHATSAPP_INSTANCE_NOT_FOUND',
  WHATSAPP_NO_INSTANCE = 'WHATSAPP_NO_INSTANCE',
  WHATSAPP_SEND_FAILED = 'WHATSAPP_SEND_FAILED',
  WHATSAPP_INVALID_NUMBER = 'WHATSAPP_INVALID_NUMBER',
  WHATSAPP_NUMBER_NOT_ON_WHATSAPP = 'WHATSAPP_NUMBER_NOT_ON_WHATSAPP',
  WHATSAPP_BLOCKED = 'WHATSAPP_BLOCKED',
  WHATSAPP_RATE_LIMIT = 'WHATSAPP_RATE_LIMIT',

  // Customer Errors
  CUSTOMER_NOT_FOUND = 'CUSTOMER_NOT_FOUND',
  CUSTOMER_INVALID_PHONE = 'CUSTOMER_INVALID_PHONE',

  // Auth Errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // General Errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

export interface AppErrorDetails {
  code: ErrorCode;
  message: string; // Mensagem técnica (para logs)
  userMessage: string; // Mensagem amigável para o usuário
  action?: string; // Texto do botão de ação
  actionUrl?: string; // URL da ação
  details?: any; // Detalhes adicionais
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly userMessage: string;
  public readonly action?: string;
  public readonly actionUrl?: string;
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(details: AppErrorDetails & { statusCode?: number }) {
    super(details.message);
    this.name = 'AppError';
    this.code = details.code;
    this.userMessage = details.userMessage;
    this.action = details.action;
    this.actionUrl = details.actionUrl;
    this.statusCode = details.statusCode || 400;
    this.details = details.details;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.userMessage,
        action: this.action,
        actionUrl: this.actionUrl,
        details: this.details,
      },
    };
  }
}

// Factory functions para erros comuns - todas as mensagens em português
export const Errors = {
  /**
   * WhatsApp desconectado - precisa escanear QR Code novamente
   */
  whatsappDisconnected: (instanceName?: string) =>
    new AppError({
      code: ErrorCode.WHATSAPP_DISCONNECTED,
      message: `WhatsApp instance ${instanceName || ''} is disconnected`,
      userMessage: instanceName
        ? `O WhatsApp "${instanceName}" está desconectado. Escaneie o QR Code novamente para reconectar.`
        : 'Seu WhatsApp está desconectado. Escaneie o QR Code novamente para reconectar.',
      action: 'Reconectar WhatsApp',
      actionUrl: '/dashboard/configuracoes',
      statusCode: 400,
    }),

  /**
   * WhatsApp ainda conectando - aguardar conexão
   */
  whatsappConnecting: (instanceName?: string) =>
    new AppError({
      code: ErrorCode.WHATSAPP_CONNECTING,
      message: `WhatsApp instance ${instanceName || ''} is still connecting`,
      userMessage: instanceName
        ? `O WhatsApp "${instanceName}" ainda está conectando. Aguarde alguns segundos e tente novamente.`
        : 'Seu WhatsApp ainda está conectando. Aguarde alguns segundos e tente novamente.',
      action: 'Ver Status',
      actionUrl: '/dashboard/configuracoes',
      statusCode: 400,
    }),

  /**
   * Instância não encontrada no banco de dados
   */
  whatsappInstanceNotFound: () =>
    new AppError({
      code: ErrorCode.WHATSAPP_INSTANCE_NOT_FOUND,
      message: 'WhatsApp instance not found in database',
      userMessage: 'A conexão do WhatsApp não foi encontrada. Ela pode ter sido removida.',
      action: 'Ir para Configurações',
      actionUrl: '/dashboard/configuracoes',
      statusCode: 404,
    }),

  /**
   * Nenhuma instância configurada para a empresa
   */
  whatsappNoInstance: () =>
    new AppError({
      code: ErrorCode.WHATSAPP_NO_INSTANCE,
      message: 'No WhatsApp instance configured for this company',
      userMessage: 'Você ainda não tem um WhatsApp conectado. Conecte seu WhatsApp para enviar mensagens.',
      action: 'Conectar WhatsApp',
      actionUrl: '/dashboard/configuracoes',
      statusCode: 400,
    }),

  /**
   * Número não está no WhatsApp
   */
  whatsappNumberNotOnWhatsApp: (phone?: string) =>
    new AppError({
      code: ErrorCode.WHATSAPP_NUMBER_NOT_ON_WHATSAPP,
      message: `Number ${phone} is not registered on WhatsApp`,
      userMessage: 'Este número não está cadastrado no WhatsApp. Verifique se o número está correto.',
      statusCode: 400,
    }),

  /**
   * Bloqueado pelo destinatário
   */
  whatsappBlocked: () =>
    new AppError({
      code: ErrorCode.WHATSAPP_BLOCKED,
      message: 'Message blocked by recipient',
      userMessage: 'Não foi possível enviar a mensagem. Você pode ter sido bloqueado por este contato.',
      statusCode: 400,
    }),

  /**
   * Limite de mensagens excedido
   */
  whatsappRateLimit: () =>
    new AppError({
      code: ErrorCode.WHATSAPP_RATE_LIMIT,
      message: 'WhatsApp rate limit exceeded',
      userMessage: 'Muitas mensagens enviadas. Aguarde alguns minutos antes de tentar novamente.',
      statusCode: 429,
    }),

  /**
   * Erro genérico de envio - analisa a mensagem de erro
   */
  whatsappSendFailed: (evolutionError?: string) => {
    // Analisa o erro da Evolution API para dar mensagem mais específica
    const errorLower = (evolutionError || '').toLowerCase();

    // Mapeamento de erros da Evolution API para mensagens em português
    if (errorLower.includes('not connected') || errorLower.includes('disconnected') || errorLower.includes('close')) {
      return Errors.whatsappDisconnected();
    }

    if (errorLower.includes('connecting') || errorLower.includes('qr code')) {
      return Errors.whatsappConnecting();
    }

    if (errorLower.includes('not on whatsapp') || errorLower.includes('not registered') || errorLower.includes('invalid jid')) {
      return Errors.whatsappNumberNotOnWhatsApp();
    }

    if (errorLower.includes('blocked')) {
      return Errors.whatsappBlocked();
    }

    if (errorLower.includes('rate') || errorLower.includes('limit') || errorLower.includes('too many')) {
      return Errors.whatsappRateLimit();
    }

    if (errorLower.includes('invalid') && errorLower.includes('number')) {
      return Errors.whatsappInvalidNumber();
    }

    // Erro genérico com mensagem amigável
    return new AppError({
      code: ErrorCode.WHATSAPP_SEND_FAILED,
      message: `Failed to send WhatsApp message: ${evolutionError}`,
      userMessage: 'Não foi possível enviar a mensagem. Verifique sua conexão do WhatsApp e tente novamente.',
      action: 'Verificar Conexão',
      actionUrl: '/dashboard/configuracoes',
      statusCode: 400,
    });
  },

  /**
   * Número de telefone inválido
   */
  whatsappInvalidNumber: (phone?: string) =>
    new AppError({
      code: ErrorCode.WHATSAPP_INVALID_NUMBER,
      message: `Invalid phone number: ${phone}`,
      userMessage: 'O número de telefone é inválido. Verifique se digitou corretamente com DDD.',
      statusCode: 400,
    }),

  /**
   * Cliente não encontrado
   */
  customerNotFound: (customerId?: string) =>
    new AppError({
      code: ErrorCode.CUSTOMER_NOT_FOUND,
      message: `Customer not found: ${customerId}`,
      userMessage: 'Cliente não encontrado. Ele pode ter sido removido.',
      action: 'Ver Clientes',
      actionUrl: '/dashboard/customers',
      statusCode: 404,
    }),

  /**
   * Não autorizado
   */
  unauthorized: () =>
    new AppError({
      code: ErrorCode.UNAUTHORIZED,
      message: 'Unauthorized access',
      userMessage: 'Sua sessão expirou. Faça login novamente para continuar.',
      action: 'Fazer Login',
      actionUrl: '/login',
      statusCode: 401,
    }),

  /**
   * Erro interno
   */
  internal: (message?: string) =>
    new AppError({
      code: ErrorCode.INTERNAL_ERROR,
      message: message || 'Internal server error',
      userMessage: 'Ocorreu um erro inesperado. Por favor, tente novamente em alguns instantes.',
      statusCode: 500,
    }),
};
