import { Router } from 'express';
import { FlowWebhookController } from '../controllers/FlowWebhookController';

const flowWebhookRouter = Router();
const flowWebhookController = new FlowWebhookController();

// Public route to trigger a flow
flowWebhookRouter.post('/:slug', flowWebhookController.handleTrigger);
flowWebhookRouter.get('/:slug', flowWebhookController.handleTrigger); // Support GET for simple webhook triggers

export { flowWebhookRouter };
