import { Router } from 'express';
import webhookController from '../controllers/webhook.controller';

const router = Router();

// Webhook routes (SEM autenticação - Evolution API precisa acessar)
router.post('/whatsapp', webhookController.handleWhatsAppWebhook);
router.get('/whatsapp/test', webhookController.testWebhook);

export default router;
