import { Router } from 'express';
import conversationController from '../controllers/conversation.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { asyncHandler } from '../middlewares/errorHandler';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/conversations/handoffs/count - Conta conversas que transbordaram
// IMPORTANTE: Esta rota deve vir ANTES de /:customerId para não ser interpretada como customerId
router.get('/handoffs/count', checkPermission('CONVERSATIONS', false), asyncHandler(conversationController.getHandoffsCount));

// GET /api/conversations/:customerId - Obtém ou cria conversa
router.get('/:customerId', checkPermission('CONVERSATIONS', false), asyncHandler(conversationController.getConversation));

// POST /api/conversations/:customerId/assign - Atribui conversa a usuário
router.post('/:customerId/assign', checkPermission('CONVERSATIONS', true), asyncHandler(conversationController.assignConversation));

// POST /api/conversations/:customerId/unassign - Remove atribuição
router.post('/:customerId/unassign', checkPermission('CONVERSATIONS', true), asyncHandler(conversationController.unassignConversation));

// GET /api/conversations/assigned/:userId - Lista conversas atribuídas
router.get('/assigned/:userId', checkPermission('CONVERSATIONS', false), asyncHandler(conversationController.getAssignedConversations));

// PATCH /api/conversations/:customerId/toggle-ai - Ativa/Desativa IA
router.patch('/:customerId/toggle-ai', checkPermission('CONVERSATIONS', true), asyncHandler(conversationController.toggleAI));

// PATCH /api/conversations/:customerId/dismiss-help - Marca transbordo como resolvido
router.patch('/:customerId/dismiss-help', checkPermission('CONVERSATIONS', true), asyncHandler(conversationController.dismissNeedsHelp));

export default router;
