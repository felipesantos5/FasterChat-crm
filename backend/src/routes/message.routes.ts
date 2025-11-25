import { Router } from 'express';
import messageController from '../controllers/message.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/messages - Obtém mensagens com filtros
router.get('/', messageController.getMessages);

// GET /api/messages/customer/:customerId - Obtém mensagens de um customer
router.get('/customer/:customerId', messageController.getCustomerMessages);

// GET /api/messages/conversations/:companyId - Obtém resumo de conversas
router.get('/conversations/:companyId', messageController.getConversations);

// POST /api/messages/send - Envia mensagem
router.post('/send', messageController.sendMessage);

// POST /api/messages/mark-read - Marca mensagens como lidas
router.post('/mark-read', messageController.markAsRead);

// POST /api/messages/:id/feedback - Adiciona feedback a uma mensagem
router.post('/:id/feedback', messageController.addFeedback);

// GET /api/messages/feedback/stats/:companyId - Obtém estatísticas de feedback
router.get('/feedback/stats/:companyId', messageController.getFeedbackStats);

// GET /api/messages/feedback/bad/:companyId - Obtém mensagens com feedback negativo
router.get('/feedback/bad/:companyId', messageController.getMessagesWithBadFeedback);

export default router;
