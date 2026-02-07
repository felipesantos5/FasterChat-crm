import { Router } from 'express';
import webhookController from '../controllers/webhook.controller';
import { asyncHandler } from '../middlewares/errorHandler';

const router = Router();

// Webhook routes (SEM autenticação - Evolution API precisa acessar)
router.post('/whatsapp', asyncHandler(webhookController.handleWhatsAppWebhook));
router.get('/whatsapp/test', asyncHandler(webhookController.testWebhook));

export default router;
