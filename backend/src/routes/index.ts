import { Router } from 'express';
import authRoutes from './auth.routes';
import customerRoutes from './customer.routes';
import whatsappRoutes from './whatsapp.routes';
import messageRoutes from './message.routes';
import webhookRoutes from './webhook.routes';
import conversationRoutes from './conversation.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/customers', customerRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/messages', messageRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/conversations', conversationRoutes);

export default router;
