import { Router } from 'express';
import whatsappLinkController from '../controllers/whatsapp-link.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// CRUD de links
router.post('/', checkPermission('WHATSAPP_LINKS', true), whatsappLinkController.create.bind(whatsappLinkController));
router.get('/', checkPermission('WHATSAPP_LINKS', false), whatsappLinkController.findAll.bind(whatsappLinkController));
router.get('/:id', checkPermission('WHATSAPP_LINKS', false), whatsappLinkController.findById.bind(whatsappLinkController));
router.put('/:id', checkPermission('WHATSAPP_LINKS', true), whatsappLinkController.update.bind(whatsappLinkController));
router.delete('/:id', checkPermission('WHATSAPP_LINKS', true), whatsappLinkController.delete.bind(whatsappLinkController));

// Analytics
router.get('/:id/analytics', checkPermission('WHATSAPP_LINKS', false), whatsappLinkController.getAnalytics.bind(whatsappLinkController));

// Utilitários
router.post('/generate-slug', checkPermission('WHATSAPP_LINKS', false), whatsappLinkController.generateSlug.bind(whatsappLinkController));

export default router;
