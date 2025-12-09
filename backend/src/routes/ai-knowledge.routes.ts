import { Router } from 'express';
import aiKnowledgeController from '../controllers/ai-knowledge.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/ai/knowledge - Obtém base de conhecimento
router.get('/knowledge', aiKnowledgeController.getKnowledge);

// PUT /api/ai/knowledge - Atualiza base de conhecimento
router.put('/knowledge', aiKnowledgeController.updateKnowledge);

// POST /api/ai/knowledge/generate-context - Gera contexto completo com IA
router.post('/knowledge/generate-context', aiKnowledgeController.generateContext);

export default router;
