import { Router } from 'express';
import { FlowController } from '../controllers/FlowController';
import { authenticate } from '../middlewares/auth';

const flowRouter = Router();
const flowController = new FlowController();

flowRouter.use(authenticate);

flowRouter.get('/', flowController.getFlows);
flowRouter.post('/', flowController.createFlow);
flowRouter.get('/:id', flowController.getFlowById);
flowRouter.put('/:id', flowController.updateFlow);
flowRouter.post('/:id/nodes', flowController.saveFlowNodes);
flowRouter.delete('/:id', flowController.deleteFlow);

export { flowRouter };
