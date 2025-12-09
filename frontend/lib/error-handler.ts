import { toast } from "sonner";

/**
 * Interface para erros estruturados do backend
 */
export interface AppErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    action?: string;
    actionUrl?: string;
    details?: any;
  };
}

/**
 * Verifica se é um erro estruturado do backend
 */
export function isAppError(error: any): error is { response: { data: AppErrorResponse } } {
  return error?.response?.data?.error?.code !== undefined;
}

/**
 * Extrai a mensagem de erro de qualquer tipo de erro
 */
export function getErrorMessage(error: any): string {
  if (isAppError(error)) {
    return error.response.data.error.message;
  }

  if (error?.response?.data?.message) {
    return error.response.data.message;
  }

  if (error?.message) {
    return error.message;
  }

  return "Ocorreu um erro inesperado. Tente novamente.";
}

/**
 * Exibe um toast de erro com suporte a ações
 * @param error - O erro capturado
 * @param router - Instância do router para navegação (opcional)
 * @param defaultMessage - Mensagem padrão se não houver mensagem de erro
 */
export function showErrorToast(
  error: any,
  router?: { push: (url: string) => void },
  defaultMessage?: string
) {
  console.error("Error:", error);

  if (isAppError(error)) {
    const { message, action, actionUrl } = error.response.data.error;

    if (actionUrl && action && router) {
      toast.error(message, {
        description: `Clique para ${action.toLowerCase()}`,
        action: {
          label: action,
          onClick: () => router.push(actionUrl),
        },
        duration: 8000,
      });
    } else {
      toast.error(message, { duration: 5000 });
    }
    return;
  }

  // Fallback para erros não estruturados
  const message = getErrorMessage(error) || defaultMessage || "Erro inesperado";
  toast.error(message, { duration: 5000 });
}

/**
 * Códigos de erro conhecidos
 */
export const ErrorCodes = {
  WHATSAPP_DISCONNECTED: "WHATSAPP_DISCONNECTED",
  WHATSAPP_INSTANCE_NOT_FOUND: "WHATSAPP_INSTANCE_NOT_FOUND",
  WHATSAPP_NO_INSTANCE: "WHATSAPP_NO_INSTANCE",
  WHATSAPP_SEND_FAILED: "WHATSAPP_SEND_FAILED",
  WHATSAPP_INVALID_NUMBER: "WHATSAPP_INVALID_NUMBER",
  CUSTOMER_NOT_FOUND: "CUSTOMER_NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

/**
 * Verifica se o erro tem um código específico
 */
export function hasErrorCode(error: any, code: keyof typeof ErrorCodes): boolean {
  if (isAppError(error)) {
    return error.response.data.error.code === ErrorCodes[code];
  }
  return false;
}
