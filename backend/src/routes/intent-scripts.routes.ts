import { Router } from 'express';
import intentScriptsController from '../controllers/intent-scripts.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { asyncHandler } from '../middlewares/errorHandler';

const router = Router();

router.use(authenticate);

// GET /api/ai/intent-scripts - Lista scripts com configurações da empresa
router.get(
  '/intent-scripts',
  checkPermission('AI_CONFIG', false),
  asyncHandler(intentScriptsController.listScripts)
);

// PUT /api/ai/intent-scripts - Salva configurações dos scripts
router.put(
  '/intent-scripts',
  checkPermission('AI_CONFIG', true),
  asyncHandler(intentScriptsController.updateScripts)
);

// GET /api/ai/intent-scripts/available - Lista scripts disponíveis (sem autenticação forte)
router.get(
  '/intent-scripts/available',
  checkPermission('AI_CONFIG', false),
  asyncHandler(intentScriptsController.listAvailable)
);

export default router;
