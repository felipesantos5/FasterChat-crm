import { Router } from 'express';
import aiKnowledgeController from '../controllers/ai-knowledge.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/ai/knowledge - Obtém base de conhecimento
router.get('/knowledge', checkPermission('AI_CONFIG', false), aiKnowledgeController.getKnowledge);

// PUT /api/ai/knowledge - Atualiza base de conhecimento
router.put('/knowledge', checkPermission('AI_CONFIG', true), aiKnowledgeController.updateKnowledge);

// POST /api/ai/knowledge/generate-context - Gera contexto completo com IA
router.post('/knowledge/generate-context', checkPermission('AI_CONFIG', true), aiKnowledgeController.generateContext);

// GET /api/ai/knowledge/objective-presets - Lista objetivos pré-definidos
router.get('/knowledge/objective-presets', checkPermission('AI_CONFIG', false), aiKnowledgeController.getObjectivePresets);

export default router;
