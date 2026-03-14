import { Router } from 'express';
import pipelineController from '../controllers/pipeline.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { asyncHandler } from '../middlewares/errorHandler';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// Estágios
router.get('/stages', checkPermission('PIPELINE', false), asyncHandler(pipelineController.getStages));
router.post('/stages', checkPermission('PIPELINE', true), asyncHandler(pipelineController.createStage));
router.patch('/stages/:id', checkPermission('PIPELINE', true), asyncHandler(pipelineController.updateStage));
router.delete('/stages/:id', checkPermission('PIPELINE', true), asyncHandler(pipelineController.deleteStage));
router.post('/stages/reorder', checkPermission('PIPELINE', true), asyncHandler(pipelineController.reorderStages));

// Board (Kanban)
router.get('/board', checkPermission('PIPELINE', false), asyncHandler(pipelineController.getBoard));

// Mover clientes
router.patch('/customers/:customerId/stage', checkPermission('PIPELINE', true), asyncHandler(pipelineController.moveCustomer));

// Inicializar pipeline
router.post('/init', checkPermission('PIPELINE', true), asyncHandler(pipelineController.initPipeline));

// Deal Values (Lucro/Receita)
router.post('/deal-values', checkPermission('PIPELINE', true), asyncHandler(pipelineController.createDealValue));
router.get('/deal-values/stats', asyncHandler(pipelineController.getDealValueStats));
router.get('/deal-values', asyncHandler(pipelineController.listDealValues));
router.get('/deal-values/customer/:customerId', asyncHandler(pipelineController.getDealValuesByCustomer));
router.put('/deal-values/:dealId', checkPermission('PIPELINE', true), asyncHandler(pipelineController.updateDealValue));
router.delete('/deal-values/:dealId', checkPermission('PIPELINE', true), asyncHandler(pipelineController.deleteDealValue));

export default router;
