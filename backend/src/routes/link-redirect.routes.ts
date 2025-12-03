import { Router } from 'express';
import linkRedirectController from '../controllers/link-redirect.controller';

const router = Router();

// Rota pública de redirecionamento (sem autenticação)
router.get('/:slug', linkRedirectController.redirect.bind(linkRedirectController));

export default router;
