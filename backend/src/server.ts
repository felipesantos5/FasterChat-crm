import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { createServer } from "http";
import routes from "./routes";
import linkRedirectRoutes from "./routes/link-redirect.routes";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { blockApiForRestrictedDomains } from "./middlewares/domainRestriction";
import { websocketService } from "./services/websocket.service";
import campaignExecutionService from "./services/campaign-execution.service";
import campaignSchedulerService from "./services/campaign-scheduler.service";
import { config } from "./config";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3051;

// Cria servidor HTTP para compartilhar com Socket.IO
const httpServer = createServer(app);

// Inicializa WebSocket
websocketService.initialize(httpServer);

// Inicializa Workers de Campanha (BullMQ)
campaignExecutionService.startWorkers();

// Inicializa Scheduler de Campanhas (backup para jobs agendados)
campaignSchedulerService.start();

// ===========================================
// SECURITY MIDDLEWARES
// ===========================================

// Helmet - Headers de segurança
app.use(helmet());

// CORS - Lista de origens permitidas
const allowedOrigins = [
  ...config.cors.origins, // Do .env (separadas por vírgula)
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  // Domínios de produção
  'https://admin.fasterchat.com.br',
  'https://api.fasterchat.com.br',
  'https://www.fasterchat.com.br',
  'https://fasterchat.com.br',
  // Domínio de redirect WhatsApp
  'https://whatsconversas.com.br',
  'https://www.whatsconversas.com.br',
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
      if (config.nodeEnv === 'development' && origin.includes('localhost')) {
        return callback(null, true);
      }
      
      console.warn(`[CORS] ⚠️ Blocked request from origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Rate Limiting - Proteção contra ataques de força bruta e DDoS
// const generalLimiter = rateLimit({
//   windowMs: config.rateLimit.windowMs, // Janela de tempo (padrão: 15 min)
//   max: config.rateLimit.maxRequests, // Máximo de requisições por janela (padrão: 100)
//   message: {
//     success: false,
//     message: 'Muitas requisições. Por favor, tente novamente em alguns minutos.',
//     code: 'RATE_LIMIT_EXCEEDED',
//   },
//   standardHeaders: true, // Retorna rate limit info nos headers `RateLimit-*`
//   legacyHeaders: false, // Desabilita headers `X-RateLimit-*`
//   skip: (req) => {
//     // Não aplica rate limit para health check
//     return req.path === '/health';
//   },
// });

// Rate Limiting mais restrito para rotas de autenticação (previne brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Apenas 10 tentativas de login por IP a cada 15 min
  message: {
    success: false,
    message: 'Muitas tentativas de login. Por favor, tente novamente em 15 minutos.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Aplica rate limiting geral
// app.use(generalLimiter);

// Rate limiting específico para rotas de autenticação
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);

// ===========================================
// BODY PARSERS
// ===========================================

// Aumentado limite para suportar envio de áudios (base64)
// 10MB é suficiente para áudios de até 1-2 minutos
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    websocket: websocketService.isInitialized() ? "connected" : "disconnected"
  });
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
    timestamp: new Date().toISOString()
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
  const knownPaths = ['/l/', '/l-test', '/api', '/health', '/socket.io'];
  if (knownPaths.some(p => req.path.startsWith(p)) || req.path === '/' || req.path === '/l') {
    return next();
  }

  // Ignora requisições de recursos estáticos (favicon, robots, etc)
  const staticPaths = ['/favicon', '/robots.txt', '/sitemap', '/.well-known'];
  if (staticPaths.some(p => req.path.startsWith(p))) {
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

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Usa httpServer em vez de app.listen
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 API available at http://localhost:${PORT}/api`);
  console.log(`🔌 WebSocket available at ws://localhost:${PORT}`);
  console.log(`📬 Campaign workers ready (BullMQ + Redis)`);
  console.log(`🕐 Campaign scheduler running (checks every minute)`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  campaignSchedulerService.stop();
  await campaignExecutionService.stopWorkers();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
