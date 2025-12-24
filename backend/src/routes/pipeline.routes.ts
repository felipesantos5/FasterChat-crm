import { Router } from 'express';
import pipelineController from '../controllers/pipeline.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// Estágios
router.get('/stages', checkPermission('PIPELINE', false), pipelineController.getStages);
router.post('/stages', checkPermission('PIPELINE', true), pipelineController.createStage);
router.patch('/stages/:id', checkPermission('PIPELINE', true), pipelineController.updateStage);
router.delete('/stages/:id', checkPermission('PIPELINE', true), pipelineController.deleteStage);
router.post('/stages/reorder', checkPermission('PIPELINE', true), pipelineController.reorderStages);

// Board (Kanban)
router.get('/board', checkPermission('PIPELINE', false), pipelineController.getBoard);

// Mover clientes
router.patch('/customers/:customerId/stage', checkPermission('PIPELINE', true), pipelineController.moveCustomer);

// Inicializar pipeline
router.post('/init', checkPermission('PIPELINE', true), pipelineController.initPipeline);

export default router;
