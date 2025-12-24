import { useState, useCallback } from "react";

interface ErrorState {
  hasError: boolean;
  error: Error | null;
  errorMessage: string | null;
}

interface UseErrorHandlerReturn extends ErrorState {
  setError: (error: Error | string) => void;
  clearError: () => void;
  handleError: (error: any) => void;
}

/**
 * Hook para gerenciar estados de erro de forma padronizada
 */
export function useErrorHandler(): UseErrorHandlerReturn {
  const [errorState, setErrorState] = useState<ErrorState>({
    hasError: false,
    error: null,
    errorMessage: null,
  });

  const setError = useCallback((error: Error | string) => {
    const errorObj = typeof error === "string" ? new Error(error) : error;
    const message = typeof error === "string" ? error : error.message;

    setErrorState({
      hasError: true,
      error: errorObj,
      errorMessage: message,
    });
  }, []);

  const clearError = useCallback(() => {
    setErrorState({
      hasError: false,
      error: null,
      errorMessage: null,
    });
  }, []);

  const handleError = useCallback((error: any) => {
    console.error("Error handled:", error);

    let message = "Ocorreu um erro inesperado";

    if (error?.response?.data?.error) {
      message = error.response.data.error;
    } else if (error?.response?.data?.message) {
      message = error.response.data.message;
    } else if (error?.message) {
      message = error.message;
    }

    setError(message);
  }, [setError]);

  return {
    hasError: errorState.hasError,
    error: errorState.error,
    errorMessage: errorState.errorMessage,
    setError,
    clearError,
    handleError,
  };
}
