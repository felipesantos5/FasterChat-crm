import { Router } from 'express';
import conversationController from '../controllers/conversation.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/conversations/:customerId - Obtém ou cria conversa
router.get('/:customerId', conversationController.getConversation);

// POST /api/conversations/:customerId/assign - Atribui conversa a usuário
router.post('/:customerId/assign', conversationController.assignConversation);

// POST /api/conversations/:customerId/unassign - Remove atribuição
router.post('/:customerId/unassign', conversationController.unassignConversation);

// GET /api/conversations/assigned/:userId - Lista conversas atribuídas
router.get('/assigned/:userId', conversationController.getAssignedConversations);

// PATCH /api/conversations/:customerId/toggle-ai - Ativa/Desativa IA
router.patch('/:customerId/toggle-ai', conversationController.toggleAI);

export default router;
