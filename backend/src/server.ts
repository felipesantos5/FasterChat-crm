import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { createServer } from "http";
import routes from "./routes";
import linkRedirectRoutes from "./routes/link-redirect.routes";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { websocketService } from "./services/websocket.service";
import campaignExecutionService from "./services/campaign-execution.service";
import { config } from "./config";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3030;

// Cria servidor HTTP para compartilhar com Socket.IO
const httpServer = createServer(app);

// Inicializa WebSocket
websocketService.initialize(httpServer);

// Inicializa Workers de Campanha (BullMQ)
campaignExecutionService.startWorkers();

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
  // Adicione aqui os domínios de produção quando tiver
  // 'https://seu-dominio.com',
  // 'https://www.seu-dominio.com',
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    websocket: websocketService.isInitialized() ? "connected" : "disconnected"
  });
});

// Rota pública de redirecionamento de links (SEM autenticação)
// IMPORTANTE: Deve vir ANTES das rotas /api para não ser bloqueada
app.use("/l", linkRedirectRoutes);

// API routes (COM autenticação)
app.use("/api", routes);

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
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await campaignExecutionService.stopWorkers();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
