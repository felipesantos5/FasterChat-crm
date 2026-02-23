import { Router } from 'express';
import { FlowController } from '../controllers/FlowController';
import { authenticate } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';

const flowRouter = Router();
const flowController = new FlowController();

flowRouter.use(authenticate);

flowRouter.get('/', asyncHandler(flowController.getFlows));
flowRouter.post('/', asyncHandler(flowController.createFlow));
flowRouter.get('/:id', asyncHandler(flowController.getFlowById));
flowRouter.put('/:id', asyncHandler(flowController.updateFlow));
flowRouter.get('/:id/variables', asyncHandler(flowController.getFlowVariables));
flowRouter.get('/:id/executions', asyncHandler(flowController.getFlowExecutions));
flowRouter.post('/:id/nodes', asyncHandler(flowController.saveFlowNodes));
flowRouter.delete('/:id', asyncHandler(flowController.deleteFlow));

export { flowRouter };
