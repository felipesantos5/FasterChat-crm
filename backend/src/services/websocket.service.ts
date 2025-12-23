import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  companyId?: string;
}

class WebSocketService {
  private io: SocketIOServer | null = null;
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set<socketId>

  /**
   * Obtém as origens permitidas para CORS
   */
  private getCorsOrigins(): string[] | string {
    const origins = process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000';
    const originList = origins.split(',').map(o => o.trim()).filter(Boolean);

    // Se for apenas uma origem, retorna string; senão, retorna array
    return originList.length === 1 ? originList[0] : originList;
  }

  /**
   * Inicializa o servidor Socket.IO
   */
  initialize(httpServer: HTTPServer) {
    const corsOrigins = this.getCorsOrigins();

    console.log('[WebSocket] Initializing with CORS origins:', corsOrigins);

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: corsOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      // Configurações para melhor suporte a proxies (Coolify/Docker)
      pingTimeout: 60000,
      pingInterval: 25000,
      allowEIO3: true,
    });

    this.setupEventHandlers();
    console.log('[WebSocket] Server initialized successfully');
  }

  /**
   * Configura os event handlers do Socket.IO
   */
  private setupEventHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`[WebSocket] New connection: ${socket.id} from ${socket.handshake.address}`);

      // Autenticação via token JWT
      socket.on('authenticate', (token: string) => {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
          socket.userId = decoded.userId;
          socket.companyId = decoded.companyId;

          // Adiciona socket ao mapa de usuários
          if (socket.userId) {
            if (!this.userSockets.has(socket.userId)) {
              this.userSockets.set(socket.userId, new Set());
            }
            this.userSockets.get(socket.userId)!.add(socket.id);
          }

          // Entra em sala específica da empresa
          socket.join(`company:${socket.companyId}`);

          console.log(`[WebSocket] User ${socket.userId} authenticated, joined company:${socket.companyId}`);
          socket.emit('authenticated', { userId: socket.userId, companyId: socket.companyId });
        } catch (error) {
          console.error('[WebSocket] Authentication failed:', error);
          socket.emit('auth_error', { message: 'Invalid token' });
          socket.disconnect();
        }
      });

      // Cliente quer se inscrever em uma conversa específica
      socket.on('subscribe_conversation', (customerId: string) => {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        socket.join(`conversation:${customerId}`);
      });

      // Cliente quer parar de receber atualizações de uma conversa
      socket.on('unsubscribe_conversation', (customerId: string) => {
        socket.leave(`conversation:${customerId}`);
      });

      // Desconexão
      socket.on('disconnect', (reason) => {
        console.log(`[WebSocket] Client ${socket.id} disconnected. Reason: ${reason}`);
        if (socket.userId) {
          const userSocketSet = this.userSockets.get(socket.userId);
          if (userSocketSet) {
            userSocketSet.delete(socket.id);
            if (userSocketSet.size === 0) {
              this.userSockets.delete(socket.userId);
            }
          }
        }
      });

      // Log de erros
      socket.on('error', (error) => {
        console.error(`[WebSocket] Socket error for ${socket.id}:`, error);
      });
    });
  }

  /**
   * Emite uma nova mensagem para todos os clientes da empresa
   */
  emitNewMessage(companyId: string, message: any) {
    if (!this.io) {
      console.warn('[WebSocket] Cannot emit new_message - Socket.IO not initialized');
      return;
    }

    const companyRoom = `company:${companyId}`;
    const roomSize = this.io.sockets.adapter.rooms.get(companyRoom)?.size || 0;

    console.log(`[WebSocket] Emitting new_message to ${companyRoom} (${roomSize} clients)`);
    this.io.to(companyRoom).emit('new_message', message);

    // Também emite para sala específica da conversa
    if (message.customerId) {
      const conversationRoom = `conversation:${message.customerId}`;
      const convRoomSize = this.io.sockets.adapter.rooms.get(conversationRoom)?.size || 0;
      console.log(`[WebSocket] Emitting message_update to ${conversationRoom} (${convRoomSize} clients)`);
      this.io.to(conversationRoom).emit('message_update', message);
    }
  }

  /**
   * Emite atualização de status de mensagem
   */
  emitMessageStatusUpdate(companyId: string, messageId: string, status: string) {
    if (!this.io) return;

    this.io.to(`company:${companyId}`).emit('message_status', {
      messageId,
      status,
      timestamp: new Date(),
    });
  }

  /**
   * Emite atualização de conversa (needsHelp, aiEnabled, etc)
   */
  emitConversationUpdate(companyId: string, customerId: string, update: any) {
    if (!this.io) return;

    this.io.to(`company:${companyId}`).emit('conversation_update', {
      customerId,
      ...update,
      timestamp: new Date(),
    });

    this.io.to(`conversation:${customerId}`).emit('conversation_updated', {
      customerId,
      ...update,
      timestamp: new Date(),
    });
  }

  /**
   * Emite notificação de que IA está digitando
   */
  emitTypingIndicator(companyId: string, customerId: string, isTyping: boolean) {
    if (!this.io) return;

    this.io.to(`company:${companyId}`).emit('typing', {
      customerId,
      isTyping,
    });

    this.io.to(`conversation:${customerId}`).emit('ai_typing', {
      isTyping,
    });
  }

  /**
   * Emite evento de novo cliente
   */
  emitNewCustomer(companyId: string, customer: any) {
    if (!this.io) return;

    this.io.to(`company:${companyId}`).emit('new_customer', customer);
  }

  /**
   * Emite evento de nova conversa criada
   */
  emitNewConversation(companyId: string, conversation: any) {
    if (!this.io) return;

    this.io.to(`company:${companyId}`).emit('new_conversation', conversation);
  }

  /**
   * Emite estatísticas atualizadas
   */
  emitStatsUpdate(companyId: string, stats: any) {
    if (!this.io) return;

    this.io.to(`company:${companyId}`).emit('stats_update', stats);
  }

  /**
   * Verifica se o servidor está inicializado
   */
  isInitialized(): boolean {
    return this.io !== null;
  }

  /**
   * Retorna a instância do Socket.IO (para uso direto se necessário)
   */
  getIO(): SocketIOServer | null {
    return this.io;
  }
}

export const websocketService = new WebSocketService();

