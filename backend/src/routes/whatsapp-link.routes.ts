import { Router } from 'express';
import whatsappLinkController from '../controllers/whatsapp-link.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { asyncHandler } from '../middlewares/errorHandler';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// CRUD de links
router.post('/', checkPermission('WHATSAPP_LINKS', true), asyncHandler(whatsappLinkController.create.bind(whatsappLinkController)));
router.get('/', checkPermission('WHATSAPP_LINKS', false), asyncHandler(whatsappLinkController.findAll.bind(whatsappLinkController)));
router.get('/:id', checkPermission('WHATSAPP_LINKS', false), asyncHandler(whatsappLinkController.findById.bind(whatsappLinkController)));
router.put('/:id', checkPermission('WHATSAPP_LINKS', true), asyncHandler(whatsappLinkController.update.bind(whatsappLinkController)));
router.delete('/:id', checkPermission('WHATSAPP_LINKS', true), asyncHandler(whatsappLinkController.delete.bind(whatsappLinkController)));

// Analytics
router.get('/:id/analytics', checkPermission('WHATSAPP_LINKS', false), asyncHandler(whatsappLinkController.getAnalytics.bind(whatsappLinkController)));

// Utilitários
router.post('/generate-slug', checkPermission('WHATSAPP_LINKS', false), asyncHandler(whatsappLinkController.generateSlug.bind(whatsappLinkController)));

export default router;
