import { Router } from 'express';
import messageController from '../controllers/message.controller';
import { authenticate } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/messages - Obtém mensagens com filtros
router.get('/', asyncHandler(messageController.getMessages));

// GET /api/messages/customer/:customerId - Obtém mensagens de um customer
router.get('/customer/:customerId', asyncHandler(messageController.getCustomerMessages));

// GET /api/messages/conversations/:companyId - Obtém resumo de conversas
router.get('/conversations/:companyId', asyncHandler(messageController.getConversations));

// POST /api/messages/send - Envia mensagem
router.post('/send', asyncHandler(messageController.sendMessage));

// POST /api/messages/send-media - Envia imagem
router.post('/send-media', asyncHandler(messageController.sendMedia));

// POST /api/messages/mark-read - Marca mensagens como lidas
router.post('/mark-read', asyncHandler(messageController.markAsRead));

// POST /api/messages/:id/feedback - Adiciona feedback a uma mensagem
router.post('/:id/feedback', asyncHandler(messageController.addFeedback));

// GET /api/messages/feedback/stats/:companyId - Obtém estatísticas de feedback
router.get('/feedback/stats/:companyId', asyncHandler(messageController.getFeedbackStats));

// GET /api/messages/feedback/bad/:companyId - Obtém mensagens com feedback negativo
router.get('/feedback/bad/:companyId', asyncHandler(messageController.getMessagesWithBadFeedback));

export default router;
