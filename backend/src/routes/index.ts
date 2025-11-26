import { Router } from 'express';
import authRoutes from './auth.routes';
import customerRoutes from './customer.routes';
import whatsappRoutes from './whatsapp.routes';
import messageRoutes from './message.routes';
import webhookRoutes from './webhook.routes';
import conversationRoutes from './conversation.routes';
import conversationExampleRoutes from './conversation-example.routes';
import aiKnowledgeRoutes from './ai-knowledge.routes';
import campaignRoutes from './campaign.routes';
import tagRoutes from './tag.routes';
import conversationExampleController from '../controllers/conversation-example.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use('/auth', authRoutes);
router.use('/customers', customerRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/messages', messageRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/conversations', conversationRoutes);
router.use('/conversations', conversationExampleRoutes);
router.use('/ai', aiKnowledgeRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/tags', tagRoutes);

// Rota adicional para listar exemplos
router.get('/ai/examples', authenticate, conversationExampleController.getExamples);

export default router;
