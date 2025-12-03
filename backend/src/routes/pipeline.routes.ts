import { Router } from 'express';
import pipelineController from '../controllers/pipeline.controller';

const router = Router();

// Estágios
router.get('/stages', pipelineController.getStages);
router.post('/stages', pipelineController.createStage);
router.patch('/stages/:id', pipelineController.updateStage);
router.delete('/stages/:id', pipelineController.deleteStage);
router.post('/stages/reorder', pipelineController.reorderStages);

// Board (Kanban)
router.get('/board', pipelineController.getBoard);

// Mover clientes
router.patch('/customers/:customerId/stage', pipelineController.moveCustomer);

// Inicializar pipeline
router.post('/init', pipelineController.initPipeline);

export default router;
