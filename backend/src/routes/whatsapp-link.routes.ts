import { Router } from 'express';
import whatsappLinkController from '../controllers/whatsapp-link.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// CRUD de links
router.post('/', whatsappLinkController.create.bind(whatsappLinkController));
router.get('/', whatsappLinkController.findAll.bind(whatsappLinkController));
router.get('/:id', whatsappLinkController.findById.bind(whatsappLinkController));
router.put('/:id', whatsappLinkController.update.bind(whatsappLinkController));
router.delete('/:id', whatsappLinkController.delete.bind(whatsappLinkController));

// Analytics
router.get('/:id/analytics', whatsappLinkController.getAnalytics.bind(whatsappLinkController));

// Utilitários
router.post('/generate-slug', whatsappLinkController.generateSlug.bind(whatsappLinkController));

export default router;
