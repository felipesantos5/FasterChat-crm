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
   * Inicializa o servidor Socket.IO
   */
  initialize(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
    console.log('✅ WebSocket Server initialized');
  }

  /**
   * Configura os event handlers do Socket.IO
   */
  private setupEventHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

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

          console.log(`✅ User authenticated: ${socket.userId} (Company: ${socket.companyId})`);
          socket.emit('authenticated', { userId: socket.userId, companyId: socket.companyId });
        } catch (error) {
          console.error('❌ Authentication failed:', error);
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
        console.log(`📱 User ${socket.userId} subscribed to conversation ${customerId}`);
      });

      // Cliente quer parar de receber atualizações de uma conversa
      socket.on('unsubscribe_conversation', (customerId: string) => {
        socket.leave(`conversation:${customerId}`);
        console.log(`📱 User ${socket.userId} unsubscribed from conversation ${customerId}`);
      });

      // Desconexão
      socket.on('disconnect', () => {
        if (socket.userId) {
          const userSocketSet = this.userSockets.get(socket.userId);
          if (userSocketSet) {
            userSocketSet.delete(socket.id);
            if (userSocketSet.size === 0) {
              this.userSockets.delete(socket.userId);
            }
          }
        }
        console.log(`🔌 Client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Emite uma nova mensagem para todos os clientes da empresa
   */
  emitNewMessage(companyId: string, message: any) {
    if (!this.io) return;

    console.log(`📤 Emitting new message to company ${companyId}`);
    this.io.to(`company:${companyId}`).emit('new_message', message);

    // Também emite para sala específica da conversa
    if (message.customerId) {
      this.io.to(`conversation:${message.customerId}`).emit('message_update', message);
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

    console.log(`📤 Emitting conversation update for ${customerId}`);
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

    console.log(`📤 Emitting new customer to company ${companyId}`);
    this.io.to(`company:${companyId}`).emit('new_customer', customer);
  }

  /**
   * Emite evento de nova conversa criada
   */
  emitNewConversation(companyId: string, conversation: any) {
    if (!this.io) return;

    console.log(`📤 Emitting new conversation to company ${companyId}:`, {
      conversationId: conversation.id,
      customerId: conversation.customerId,
      customerName: conversation.customer?.name,
    });

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
