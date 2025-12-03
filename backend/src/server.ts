import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { createServer } from "http";
import routes from "./routes";
import linkRedirectRoutes from "./routes/link-redirect.routes";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { websocketService } from "./services/websocket.service";
import campaignExecutionService from "./services/campaign-execution.service";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3030;

// Cria servidor HTTP para compartilhar com Socket.IO
const httpServer = createServer(app);

// Inicializa WebSocket
websocketService.initialize(httpServer);

// Inicializa Workers de Campanha (BullMQ)
campaignExecutionService.startWorkers();

app.use(helmet());
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
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
