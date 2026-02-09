import { Router } from 'express';
import linkRedirectController from '../controllers/link-redirect.controller';
import { asyncHandler } from '../middlewares/errorHandler';

const router = Router();

// Rota pública de redirecionamento (sem autenticação)
router.get('/:slug', asyncHandler(linkRedirectController.redirect.bind(linkRedirectController)));

export default router;
