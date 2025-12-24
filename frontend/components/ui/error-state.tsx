import { AlertTriangle, RefreshCw, Home, ArrowLeft } from "lucide-react";
import { Button } from "./button";
import { Card, CardContent } from "./card";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onGoBack?: () => void;
  onGoHome?: () => void;
  variant?: "page" | "section" | "inline";
  showRetry?: boolean;
  showGoBack?: boolean;
  showGoHome?: boolean;
}

export function ErrorState({
  title = "Algo deu errado",
  message = "Encontramos um problema ao carregar esta página. Nossa equipe já foi notificada e está trabalhando para resolver.",
  onRetry,
  onGoBack,
  onGoHome,
  variant = "section",
  showRetry = true,
  showGoBack = false,
  showGoHome = false,
}: ErrorStateProps) {
  // Variante para página inteira (centralizado na tela)
  if (variant === "page") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>

              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {title}
              </h2>

              <p className="text-sm text-gray-600 mb-6">
                {message}
              </p>

              <div className="flex flex-col gap-2">
                {showRetry && onRetry && (
                  <Button onClick={onRetry} className="w-full">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Tentar Novamente
                  </Button>
                )}

                <div className="flex gap-2">
                  {showGoBack && onGoBack && (
                    <Button onClick={onGoBack} variant="outline" className="flex-1">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Voltar
                    </Button>
                  )}

                  {showGoHome && onGoHome && (
                    <Button onClick={onGoHome} variant="outline" className="flex-1">
                      <Home className="h-4 w-4 mr-2" />
                      Início
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Variante para seção (dentro de um card)
  if (variant === "section") {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {title}
            </h3>

            <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">
              {message}
            </p>

            {showRetry && onRetry && (
              <Button onClick={onRetry} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Variante inline (mais compacta)
  return (
    <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex-shrink-0">
        <AlertTriangle className="h-5 w-5 text-red-600" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-600 mt-0.5">{message}</p>
      </div>

      {showRetry && onRetry && (
        <Button onClick={onRetry} variant="ghost" size="sm" className="flex-shrink-0">
          <RefreshCw className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// Componente específico para erros de carregamento
export function LoadingErrorState({
  resource = "dados",
  onRetry,
}: {
  resource?: string;
  onRetry?: () => void;
}) {
  return (
    <ErrorState
      title="Erro ao carregar"
      message={`Não foi possível carregar ${resource} no momento. Nossa equipe já foi notificada e está trabalhando para resolver.`}
      onRetry={onRetry}
      variant="section"
      showRetry={!!onRetry}
    />
  );
}

// Componente para quando não há conexão
export function ConnectionErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      title="Sem conexão"
      message="Parece que você está sem conexão com a internet. Verifique sua conexão e tente novamente."
      onRetry={onRetry}
      variant="section"
      showRetry={!!onRetry}
    />
  );
}
