import { Router } from 'express';
import conversationExampleController from '../controllers/conversation-example.controller';
import { authenticate } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// POST /api/conversations/:id/mark-example - Marca conversa como exemplo
router.post('/:id/mark-example', asyncHandler(conversationExampleController.markAsExample));

// DELETE /api/conversations/:id/mark-example - Remove marcação de exemplo
router.delete('/:id/mark-example', asyncHandler(conversationExampleController.removeExample));

// GET /api/conversations/:id/is-example - Verifica se é exemplo
router.get('/:id/is-example', asyncHandler(conversationExampleController.checkIsExample));

export default router;
