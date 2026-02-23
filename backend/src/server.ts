import express from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { createServer } from "http";
import routes from "./routes";
import linkRedirectRoutes from "./routes/link-redirect.routes";
import { errorHandler, notFoundHandler, requestTimeout } from "./middlewares/errorHandler";
import { blockApiForRestrictedDomains } from "./middlewares/domainRestriction";
import { websocketService } from "./services/websocket.service";
import campaignExecutionService from "./services/campaign-execution.service";
import campaignSchedulerService from "./services/campaign-scheduler.service";
import flowSchedulerService from "./services/flow-scheduler.service";
import { config } from "./config";
import {
  initializeGlobalErrorHandlers,
  registerServer,
  registerCleanup,
  globalErrorConfig,
} from "./utils/globalErrorHandler";
import { prisma } from "./utils/prisma";

dotenv.config();

// ============================================
// VALIDAÇÃO DE VARIÁVEIS DE AMBIENTE
// Fail-fast: melhor não iniciar do que falhar em runtime
// ============================================
function validateEnvironment() {
  const required = ["DATABASE_URL", "JWT_SECRET", "JWT_REFRESH_SECRET"];
  const recommended = ["EVOLUTION_API_URL", "EVOLUTION_API_KEY"];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error("");
    console.error("╔════════════════════════════════════════════════════════════════╗");
    console.error("║           FATAL: MISSING REQUIRED ENVIRONMENT VARIABLES        ║");
    console.error("╠════════════════════════════════════════════════════════════════╣");
    for (const key of missing) {
      console.error(`║  ❌ ${key.padEnd(58)} ║`);
    }
    console.error("╚════════════════════════════════════════════════════════════════╝");
    console.error("");
    process.exit(1);
  }

  const missingRecommended = recommended.filter((key) => !process.env[key]);
  if (missingRecommended.length > 0) {
    console.warn("[Startup] ⚠️  Missing recommended env vars (some features may not work):");
    for (const key of missingRecommended) {
      console.warn(`  - ${key}`);
    }
  }
}

validateEnvironment();

// ============================================
// INICIALIZAÇÃO DOS HANDLERS GLOBAIS
// Deve ser a primeira coisa a ser executada!
// ============================================
initializeGlobalErrorHandlers();

const app = express();
const PORT = process.env.PORT || 3051;

// Cria servidor HTTP para compartilhar com Socket.IO
const httpServer = createServer(app);

// Registra o servidor para graceful shutdown
registerServer(httpServer);

// ============================================
// REGISTRA CALLBACKS DE CLEANUP
// ============================================
registerCleanup(async () => {
  console.log("[Cleanup] Stopping campaign scheduler...");
  campaignSchedulerService.stop();
  flowSchedulerService.stop();
});

registerCleanup(async () => {
  console.log("[Cleanup] Stopping campaign workers...");
  await campaignExecutionService.stopWorkers();
});

registerCleanup(async () => {
  console.log("[Cleanup] Closing WebSocket connections...");
  // WebSocket será fechado automaticamente quando o httpServer fechar
});

registerCleanup(async () => {
  console.log("[Cleanup] Disconnecting from database...");
  await prisma.$disconnect();
});

// Inicializa WebSocket
websocketService.initialize(httpServer);

// Inicializa Workers de Campanha (BullMQ)
campaignExecutionService.startWorkers();

// Inicializa Scheduler de Campanhas (backup para jobs agendados)
campaignSchedulerService.start();

// Inicializa Scheduler do Fluxo de Automação (WhatsApp Builder)
flowSchedulerService.start();

// ===========================================
// SECURITY MIDDLEWARES
// ===========================================

// Helmet - Headers de segurança (Ajustado para permitir carregamento de mídia cross-origin)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Desabilitado para simplificar carregamento de blobs/URLs externas em dev
}));

// CORS - Lista de origens permitidas
const allowedOrigins = [
  ...config.cors.origins, // Do .env (separadas por vírgula)
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  // Domínios de produção
  "https://admin.fasterchat.com.br",
  "https://api.fasterchat.com.br",
  "https://www.fasterchat.com.br",
  "https://fasterchat.com.br",
  // Domínio de redirect WhatsApp
  "https://whatsconversas.com.br",
  "https://www.whatsconversas.com.br",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite requisições sem origin (como de apps mobile, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Em desenvolvimento, permite qualquer localhost
      if (config.nodeEnv === "development" && origin.includes("localhost")) {
        return callback(null, true);
      }

      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Rate Limiting mais restrito para rotas de autenticação (previne brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Apenas 10 tentativas de login por IP a cada 15 min
  message: {
    success: false,
    message: "Muitas tentativas de login. Por favor, tente novamente em 15 minutos.",
    code: "AUTH_RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting específico para rotas de autenticação
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);

// ===========================================
// BODY PARSERS
// ===========================================

// Aumentado limite para suportar envio de áudios (base64)
// 10MB é suficiente para áudios de até 1-2 minutos
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Servir arquivos estáticos (Uploads de Áudio/Imagem)
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

// ===========================================
// REQUEST TIMEOUT (60 segundos)
// Previne requisições penduradas
// ===========================================
app.use(requestTimeout(60000));

// ===========================================
// HEALTH CHECK ENDPOINT (Melhorado)
// ===========================================
app.get("/health", async (_req, res) => {
  const startTime = Date.now();

  // Status básico
  const health: any = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "1.0.0",
  };

  // Verifica WebSocket
  health.services = {
    websocket: websocketService.isInitialized() ? "connected" : "disconnected",
  };

  // Verifica banco de dados
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = "connected";
  } catch (error) {
    health.services.database = "disconnected";
    health.status = "degraded";
  }

  // Redis status - assume conectado se campaign workers iniciaram
  health.services.redis = "connected";

  // Estatísticas de erro global
  health.errorStats = globalErrorConfig.getStats();

  // Uso de memória
  const memUsage = process.memoryUsage();
  health.memory = {
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
  };

  // Tempo de resposta
  health.responseTime = `${Date.now() - startTime}ms`;

  // Status code baseado na saúde geral
  const statusCode = health.status === "ok" ? 200 : 503;

  res.status(statusCode).json(health);
});

// Health check simplificado para load balancers
app.get("/health/live", (_req, res) => {
  res.status(200).send("OK");
});

// Readiness check (para Kubernetes)
app.get("/health/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).send("READY");
  } catch (error) {
    res.status(503).send("NOT READY");
  }
});

// Debug: Log todas as requisições para /l
app.use("/l", (req, _res, next) => {
  console.log(`[LinkRedirect] Request: ${req.method} ${req.path} from ${req.headers.host}`);
  next();
});

// Rota pública de redirecionamento de links (SEM autenticação)
// IMPORTANTE: Deve vir ANTES das rotas /api para não ser bloqueada
// Esta rota é acessível de qualquer domínio (incluindo domínios restritos)
//
// Duas rotas disponíveis:
// - /l/:slug (caminho tradicional para domínio da API)
// - /:slug  (caminho curto para domínio dedicado de redirect via RESTRICTED_DOMAINS)
app.use("/l", linkRedirectRoutes);

// Debug route para testar se /l está funcionando
app.get("/l-test", (_req, res) => {
  res.json({
    message: "Link redirect route is working",
    timestamp: new Date().toISOString(),
  });
});

// API routes (COM autenticação)
// SEGURANÇA: Bloqueia acesso à API de domínios restritos (ex: domínio de redirect)
// Configure RESTRICTED_DOMAINS no .env para ativar (ex: RESTRICTED_DOMAINS=wpplink.com.br)
app.use("/api", blockApiForRestrictedDomains, routes);

// Rota raiz para redirect (domínios dedicados como whatsconversas.com.br)
// Permite links curtos como: whatsconversas.com.br/instagram
// IMPORTANTE: Vem DEPOIS de /api para não conflitar
app.use("/", (req: any, res, next) => {
  // Evita reprocessamento (flag para prevenir loop)
  if (req._redirectRewritten) {
    return next();
  }

  // Ignora rotas conhecidas
  const knownPaths = ["/l/", "/l-test", "/api", "/health", "/socket.io"];
  if (knownPaths.some((p) => req.path.startsWith(p)) || req.path === "/" || req.path === "/l") {
    return next();
  }

  // Ignora requisições de recursos estáticos (favicon, robots, etc)
  const staticPaths = ["/favicon", "/robots.txt", "/sitemap", "/.well-known"];
  if (staticPaths.some((p) => req.path.startsWith(p))) {
    return next();
  }

  // Trata como slug de redirect
  // Redireciona internamente para /l/:slug
  const newUrl = `/l${req.path}`;
  console.log(`[LinkRedirect] Rewriting ${req.path} -> ${newUrl} (host: ${req.headers.host})`);
  req.url = newUrl;
  req._redirectRewritten = true; // Marca para evitar reprocessamento
  return app._router.handle(req, res, next);
});

// ===========================================
// ERROR HANDLING (deve ser o último)
// ===========================================
app.use(notFoundHandler);
app.use(errorHandler);

// ===========================================
// SERVER START
// ===========================================
httpServer.listen(PORT, () => {
  console.log("");
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║                    CRM-AI BACKEND SERVER                       ║");
  console.log("╠════════════════════════════════════════════════════════════════╣");
  console.log(`║ 🚀 Server running on port ${String(PORT).padEnd(36)} ║`);
  console.log(`║ 📊 Environment: ${(process.env.NODE_ENV || "development").padEnd(45)} ║`);
  console.log(`║ 🔗 API: http://localhost:${PORT}/api`.padEnd(65) + " ║");
  console.log(`║ 🔌 WebSocket: ws://localhost:${PORT}`.padEnd(65) + " ║");
  console.log(`║ ❤️  Health: http://localhost:${PORT}/health`.padEnd(65) + " ║");
  console.log("╠════════════════════════════════════════════════════════════════╣");
  console.log("║ 📬 Campaign workers ready (BullMQ + Redis)                     ║");
  console.log("║ 🕐 Campaign scheduler running (checks every minute)            ║");
  console.log("║ 🛡️  Global error handlers active                               ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log("");
});

// ===========================================
// GRACEFUL SHUTDOWN (backup handler)
// O globalErrorHandler já cuida disso, mas mantemos aqui como fallback
// ===========================================
const shutdownHandler = async (signal: string) => {
  console.log(`\n${signal} received (backup handler)`);
  // O globalErrorHandler já deve ter capturado isso
  // Este é apenas um fallback
};

process.on("SIGTERM", () => shutdownHandler("SIGTERM"));
process.on("SIGINT", () => shutdownHandler("SIGINT"));
