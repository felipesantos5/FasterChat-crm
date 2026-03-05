import { Router, raw } from 'express';
import stripeController from '../controllers/stripe.controller';
import { authenticate } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';

const router = Router();

// Webhook (PÚBLICO - raw body obrigatório para verificar assinatura)
router.post('/webhook', raw({ type: 'application/json' }), asyncHandler(stripeController.webhook));

// Checkout público para novo lead vindo da landing page (sem conta)
router.post('/checkout/public', asyncHandler(stripeController.createPublicCheckout));

// Checkout e Portal para cliente autenticado
router.post('/checkout', authenticate, asyncHandler(stripeController.createCheckout));
router.post('/portal', authenticate, asyncHandler(stripeController.createPortal));

export default router;
