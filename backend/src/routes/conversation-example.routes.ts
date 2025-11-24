import { Router } from 'express';
import conversationExampleController from '../controllers/conversation-example.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// POST /api/conversations/:id/mark-example - Marca conversa como exemplo
router.post('/:id/mark-example', conversationExampleController.markAsExample);

// DELETE /api/conversations/:id/mark-example - Remove marcação de exemplo
router.delete('/:id/mark-example', conversationExampleController.removeExample);

// GET /api/conversations/:id/is-example - Verifica se é exemplo
router.get('/:id/is-example', conversationExampleController.checkIsExample);

export default router;
