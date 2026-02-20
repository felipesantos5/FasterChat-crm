import { Router } from 'express';
import intentScriptsController from '../controllers/intent-scripts.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { asyncHandler } from '../middlewares/errorHandler';

const router = Router();

router.use(authenticate);

// GET /api/ai/intent-scripts — lista todos os scripts da empresa
router.get(
  '/intent-scripts',
  checkPermission('AI_CONFIG', false),
  asyncHandler(intentScriptsController.listScripts.bind(intentScriptsController))
);

// POST /api/ai/intent-scripts — cria um novo script
router.post(
  '/intent-scripts',
  checkPermission('AI_CONFIG', true),
  asyncHandler(intentScriptsController.createScript.bind(intentScriptsController))
);

// PUT /api/ai/intent-scripts — bulk save (compatibilidade)
router.put(
  '/intent-scripts',
  checkPermission('AI_CONFIG', true),
  asyncHandler(intentScriptsController.updateScripts.bind(intentScriptsController))
);

// PUT /api/ai/intent-scripts/:id — atualiza um script específico
router.put(
  '/intent-scripts/:id',
  checkPermission('AI_CONFIG', true),
  asyncHandler(intentScriptsController.updateScript.bind(intentScriptsController))
);

// DELETE /api/ai/intent-scripts/:id — remove um script
router.delete(
  '/intent-scripts/:id',
  checkPermission('AI_CONFIG', true),
  asyncHandler(intentScriptsController.deleteScript.bind(intentScriptsController))
);

export default router;
