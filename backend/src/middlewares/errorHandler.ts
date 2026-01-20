import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError, ErrorCode, Errors } from "../utils/errors";

/**
 * ============================================
 * EXPRESS ERROR HANDLER MIDDLEWARE
 * ============================================
 *
 * Middleware centralizado para tratamento de erros.
 * Captura e formata todos os tipos de erros de forma consistente.
 */

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Interface para resposta de erro padronizada
 */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    action?: string;
    actionUrl?: string;
    details?: any;
  };
  // Apenas em desenvolvimento
  debug?: {
    stack?: string;
    originalError?: string;
  };
}

/**
 * Formata erros do Zod (validação) para resposta amigável
 */
function formatZodError(error: ZodError): ErrorResponse {
  const issues = error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));

  return {
    success: false,
    error: {
      code: ErrorCode.VALIDATION_ERROR,
      message: "Dados inválidos. Verifique os campos e tente novamente.",
      details: issues,
    },
  };
}

/**
 * Formata erros do Prisma (banco de dados) para resposta amigável
 */
function formatPrismaError(error: Prisma.PrismaClientKnownRequestError): ErrorResponse {
  let message = "Erro ao processar sua solicitação.";
  let code = ErrorCode.INTERNAL_ERROR;

  switch (error.code) {
    case "P2002":
      // Unique constraint violation
      const field = (error.meta?.target as string[])?.join(", ") || "campo";
      message = `Este ${field} já está em uso. Tente outro valor.`;
      code = ErrorCode.VALIDATION_ERROR;
      break;

    case "P2025":
      // Record not found
      message = "Registro não encontrado.";
      code = ErrorCode.CUSTOMER_NOT_FOUND;
      break;

    case "P2003":
      // Foreign key constraint failed
      message = "Não é possível realizar esta ação pois existem registros relacionados.";
      code = ErrorCode.VALIDATION_ERROR;
      break;

    case "P2014":
      // Required relation violation
      message = "Operação inválida: violação de relacionamento obrigatório.";
      code = ErrorCode.VALIDATION_ERROR;
      break;

    case "P1001":
      // Can't reach database server
      message = "Não foi possível conectar ao banco de dados. Tente novamente em instantes.";
      code = ErrorCode.INTERNAL_ERROR;
      break;

    case "P1002":
      // Database server timed out
      message = "O servidor está lento. Por favor, tente novamente.";
      code = ErrorCode.INTERNAL_ERROR;
      break;

    default:
      console.error(`[ErrorHandler] Unhandled Prisma error code: ${error.code}`, error.message);
  }

  return {
    success: false,
    error: {
      code,
      message,
    },
    ...(isDevelopment && {
      debug: {
        originalError: `Prisma ${error.code}: ${error.message}`,
      },
    }),
  };
}

/**
 * Formata erros genéricos de sintaxe JSON
 */
function formatSyntaxError(error: SyntaxError): ErrorResponse {
  return {
    success: false,
    error: {
      code: ErrorCode.VALIDATION_ERROR,
      message: "Formato de dados inválido. Verifique o JSON enviado.",
    },
    ...(isDevelopment && {
      debug: {
        originalError: error.message,
      },
    }),
  };
}

/**
 * Formata erros de timeout
 */
function formatTimeoutError(): ErrorResponse {
  return {
    success: false,
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: "A requisição demorou muito para ser processada. Tente novamente.",
    },
  };
}

/**
 * Middleware principal de tratamento de erros
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log do erro com contexto
  const errorContext = {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    timestamp: new Date().toISOString(),
  };

  // 1. AppError - Erros customizados da aplicação
  if (err instanceof AppError) {
    console.error(`[AppError] ${err.code}: ${err.message}`, errorContext);

    res.status(err.statusCode).json(err.toJSON());
    return;
  }

  // 2. ZodError - Erros de validação
  if (err instanceof ZodError) {
    console.warn(`[ValidationError] ${err.issues.length} issues`, errorContext);

    res.status(400).json(formatZodError(err));
    return;
  }

  // 3. Prisma Errors - Erros de banco de dados
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(`[PrismaError] ${err.code}: ${err.message}`, errorContext);

    const statusCode = err.code === "P2025" ? 404 : 400;
    res.status(statusCode).json(formatPrismaError(err));
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error(`[PrismaValidationError] ${err.message}`, errorContext);

    res.status(400).json({
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: "Dados inválidos para operação no banco de dados.",
      },
      ...(isDevelopment && {
        debug: { originalError: err.message },
      }),
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error(`[PrismaInitError] Database connection failed`, errorContext);

    res.status(503).json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: "Serviço temporariamente indisponível. Tente novamente em instantes.",
      },
    });
    return;
  }

  // 4. SyntaxError - JSON inválido no body
  if (err instanceof SyntaxError && "body" in err) {
    console.warn(`[SyntaxError] Invalid JSON body`, errorContext);

    res.status(400).json(formatSyntaxError(err));
    return;
  }

  // 5. Timeout errors
  if (err.name === "TimeoutError" || err.message.includes("timeout")) {
    console.error(`[TimeoutError] Request timeout`, errorContext);

    res.status(408).json(formatTimeoutError());
    return;
  }

  // 6. JWT/Auth errors
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    console.warn(`[AuthError] ${err.name}: ${err.message}`, errorContext);

    res.status(401).json(Errors.unauthorized().toJSON());
    return;
  }

  // 7. Rate limit errors
  if (err.message.includes("rate") || err.message.includes("limit")) {
    console.warn(`[RateLimitError] ${err.message}`, errorContext);

    res.status(429).json({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Muitas requisições. Por favor, aguarde alguns minutos.",
      },
    });
    return;
  }

  // 8. Network/Connection errors
  if (
    err.message.includes("ECONNREFUSED") ||
    err.message.includes("ETIMEDOUT") ||
    err.message.includes("ENOTFOUND")
  ) {
    console.error(`[NetworkError] ${err.message}`, errorContext);

    res.status(503).json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: "Serviço externo indisponível. Tente novamente em instantes.",
      },
    });
    return;
  }

  // 9. Erro genérico - Fallback
  console.error(`[UnhandledError] ${err.name}: ${err.message}`, errorContext);
  console.error(err.stack);

  const response: ErrorResponse = {
    success: false,
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: isDevelopment ? err.message : "Ocorreu um erro inesperado. Por favor, tente novamente.",
    },
    ...(isDevelopment && {
      debug: {
        stack: err.stack,
        originalError: err.message,
      },
    }),
  };

  res.status(500).json(response);
};

/**
 * Middleware para rotas não encontradas
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.warn(`[404] Route not found: ${req.method} ${req.path}`);

  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "Rota não encontrada.",
      details: {
        method: req.method,
        path: req.path,
      },
    },
  });
};

/**
 * Wrapper para controllers async - captura erros automaticamente
 * Uso: router.get('/rota', asyncHandler(meuController))
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Middleware para timeout de requisições
 * Uso: app.use(requestTimeout(30000))
 */
export const requestTimeout = (ms: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        const err = new Error(`Request timeout after ${ms}ms`);
        err.name = "TimeoutError";
        next(err);
      }
    }, ms);

    res.on("finish", () => clearTimeout(timeout));
    res.on("close", () => clearTimeout(timeout));

    next();
  };
};
