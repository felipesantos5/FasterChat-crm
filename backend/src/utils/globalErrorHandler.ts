/**
 * ============================================
 * GLOBAL ERROR HANDLER
 * ============================================
 *
 * Sistema robusto de tratamento de exceções globais
 * para manter a aplicação rodando 24/7 sem crashes.
 *
 * Captura:
 * - uncaughtException: Erros síncronos não tratados
 * - unhandledRejection: Promises rejeitadas sem catch
 * - SIGTERM/SIGINT: Sinais de encerramento (graceful shutdown)
 */

import { Server } from "http";

// Configurações
const CONFIG = {
  // Tempo máximo para graceful shutdown (ms)
  SHUTDOWN_TIMEOUT: 30000,
  // Em produção com Docker, é mais seguro morrer e reiniciar limpo
  EXIT_ON_FATAL: process.env.NODE_ENV === 'production',
  // Máximo de erros não tratados antes de forçar reinício
  MAX_UNCAUGHT_ERRORS: process.env.NODE_ENV === 'production' ? 15 : 10,
  // Janela de tempo para contar erros (ms)
  // Em produção, janela maior (5 min) para detectar crash loops reais
  ERROR_WINDOW_MS: process.env.NODE_ENV === 'production' ? 300000 : 60000,
};

// Rastreamento de erros para detectar loops de falha
let uncaughtErrorCount = 0;
let lastErrorTime = Date.now();

// Referências para cleanup
let httpServer: Server | null = null;
let cleanupCallbacks: Array<() => Promise<void>> = [];
let isShuttingDown = false;

/**
 * Registra o servidor HTTP para graceful shutdown
 */
export function registerServer(server: Server): void {
  httpServer = server;
}

/**
 * Registra callbacks de cleanup para graceful shutdown
 * Ex: fechar conexões de banco, parar workers, etc.
 */
export function registerCleanup(callback: () => Promise<void>): void {
  cleanupCallbacks.push(callback);
}

/**
 * Logger estruturado para erros críticos
 */
function logCriticalError(type: string, error: any, context?: any): void {
  const timestamp = new Date().toISOString();
  const errorInfo = {
    timestamp,
    type,
    message: error?.message || String(error),
    stack: error?.stack,
    code: error?.code,
    name: error?.name,
    context,
    processInfo: {
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
    },
  };

  // Log formatado para fácil identificação
  console.error("\n");
  console.error("╔════════════════════════════════════════════════════════════════╗");
  console.error(`║ 🚨 ${type.toUpperCase().padEnd(56)} ║`);
  console.error("╠════════════════════════════════════════════════════════════════╣");
  console.error(`║ Time: ${timestamp.padEnd(54)} ║`);
  console.error(`║ Error: ${(error?.message || String(error)).slice(0, 53).padEnd(53)} ║`);
  if (error?.code) {
    console.error(`║ Code: ${String(error.code).padEnd(54)} ║`);
  }
  console.error("╚════════════════════════════════════════════════════════════════╝");
  console.error("\nFull error details:", JSON.stringify(errorInfo, null, 2));
  console.error("\nStack trace:", error?.stack || "No stack trace available");
  console.error("\n");
}

/**
 * Verifica se há muitos erros em sequência (possível loop de falha)
 */
function checkErrorThreshold(): boolean {
  const now = Date.now();

  // Reset contador se passou a janela de tempo
  if (now - lastErrorTime > CONFIG.ERROR_WINDOW_MS) {
    uncaughtErrorCount = 0;
  }

  uncaughtErrorCount++;
  lastErrorTime = now;

  if (uncaughtErrorCount >= CONFIG.MAX_UNCAUGHT_ERRORS) {
    console.error(`\n🔴 CRITICAL: ${uncaughtErrorCount} uncaught errors in ${CONFIG.ERROR_WINDOW_MS}ms window!`);
    console.error("This may indicate a crash loop. Consider investigating the root cause.\n");
    return true;
  }

  return false;
}

/**
 * Executa graceful shutdown
 */
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    console.log(`[Shutdown] Already shutting down, ignoring ${signal}`);
    return;
  }

  isShuttingDown = true;
  console.log(`\n[Shutdown] ${signal} received, starting graceful shutdown...`);

  // Timeout de segurança
  const forceExitTimeout = setTimeout(() => {
    console.error("[Shutdown] Timeout reached, forcing exit...");
    process.exit(1);
  }, CONFIG.SHUTDOWN_TIMEOUT);

  try {
    // 1. Para de aceitar novas conexões
    if (httpServer) {
      console.log("[Shutdown] Closing HTTP server...");
      await new Promise<void>((resolve) => {
        httpServer!.close(() => {
          console.log("[Shutdown] HTTP server closed");
          resolve();
        });
      });
    }

    // 2. Executa callbacks de cleanup em paralelo com timeout individual
    if (cleanupCallbacks.length > 0) {
      console.log(`[Shutdown] Running ${cleanupCallbacks.length} cleanup callbacks...`);

      const cleanupPromises = cleanupCallbacks.map(async (callback, index) => {
        try {
          const timeoutPromise = new Promise<void>((_, reject) => {
            setTimeout(() => reject(new Error("Cleanup timeout")), 10000);
          });

          await Promise.race([callback(), timeoutPromise]);
          console.log(`[Shutdown] Cleanup ${index + 1} completed`);
        } catch (err: any) {
          console.error(`[Shutdown] Cleanup ${index + 1} failed:`, err.message);
        }
      });

      await Promise.allSettled(cleanupPromises);
    }

    clearTimeout(forceExitTimeout);
    console.log("[Shutdown] Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    clearTimeout(forceExitTimeout);
    console.error("[Shutdown] Error during shutdown:", error);
    process.exit(1);
  }
}

/**
 * Handler para erros síncronos não tratados
 */
function handleUncaughtException(error: Error): void {
  logCriticalError("UNCAUGHT EXCEPTION", error);

  // Verifica threshold de erros
  const isCrashLoop = checkErrorThreshold();

  if (CONFIG.EXIT_ON_FATAL || isCrashLoop) {
    console.error("Fatal error detected, initiating shutdown...");
    gracefulShutdown("UNCAUGHT_EXCEPTION");
  } else {
    console.log("⚠️ Application continuing despite uncaught exception (not recommended for production)");
    console.log("💡 Consider fixing the root cause to prevent unexpected behavior\n");
  }
}

/**
 * Handler para Promises rejeitadas sem catch
 */
function handleUnhandledRejection(reason: any, promise: Promise<any>): void {
  logCriticalError("UNHANDLED REJECTION", reason, {
    promise: String(promise),
  });

  // Verifica threshold de erros
  const isCrashLoop = checkErrorThreshold();

  if (isCrashLoop) {
    console.error("Too many unhandled rejections, initiating shutdown...");
    gracefulShutdown("UNHANDLED_REJECTION");
  } else {
    console.log("⚠️ Promise rejection handled globally - application continues\n");
  }
}

/**
 * Handler para warnings do Node.js
 */
function handleWarning(warning: Error): void {
  console.warn("\n⚠️ NODE WARNING:");
  console.warn(`  Name: ${warning.name}`);
  console.warn(`  Message: ${warning.message}`);
  if (warning.stack) {
    console.warn(`  Stack: ${warning.stack.split("\n").slice(1, 3).join("\n")}`);
  }
  console.warn("");
}

/**
 * Inicializa todos os handlers globais de erro
 */
export function initializeGlobalErrorHandlers(): void {
  console.log("🛡️ Initializing global error handlers...");

  // Handler para erros síncronos não capturados
  process.on("uncaughtException", handleUncaughtException);

  // Handler para Promises rejeitadas sem catch
  process.on("unhandledRejection", handleUnhandledRejection);

  // Handler para warnings (memory leaks, deprecations, etc.)
  process.on("warning", handleWarning);

  // Handlers para sinais de encerramento
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // SIGHUP - Geralmente usado para reload de config, mas tratamos como shutdown
  process.on("SIGHUP", () => gracefulShutdown("SIGHUP"));

  // Previne que erros em event emitters matem o processo
  process.on("uncaughtExceptionMonitor", (error, origin) => {
    console.error(`[Monitor] Uncaught exception from ${origin}:`, error.message);
  });

  console.log("✅ Global error handlers initialized");
  console.log(`   - uncaughtException: ${CONFIG.EXIT_ON_FATAL ? "will exit" : "will log and continue"}`);
  console.log(`   - unhandledRejection: will log and continue`);
  console.log(`   - SIGTERM/SIGINT: graceful shutdown (${CONFIG.SHUTDOWN_TIMEOUT}ms timeout)`);
  console.log(`   - Error threshold: ${CONFIG.MAX_UNCAUGHT_ERRORS} errors in ${CONFIG.ERROR_WINDOW_MS}ms`);
  console.log("");
}

/**
 * Exporta configurações para permitir ajustes em runtime
 */
export const globalErrorConfig = {
  setExitOnFatal: (value: boolean) => {
    CONFIG.EXIT_ON_FATAL = value;
  },
  setShutdownTimeout: (ms: number) => {
    CONFIG.SHUTDOWN_TIMEOUT = ms;
  },
  setMaxUncaughtErrors: (count: number) => {
    CONFIG.MAX_UNCAUGHT_ERRORS = count;
  },
  getStats: () => ({
    uncaughtErrorCount,
    lastErrorTime: new Date(lastErrorTime).toISOString(),
    isShuttingDown,
    cleanupCallbacksCount: cleanupCallbacks.length,
  }),
};
