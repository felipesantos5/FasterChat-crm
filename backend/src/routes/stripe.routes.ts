import { Router, raw } from 'express';
import stripeController from '../controllers/stripe.controller';
import { authenticate } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';

const router = Router();

// 💳 Webhook (PÚBLICO - SEM AUTENTICAÇÃO)
// IMPORTANTE: Precisa do raw body para verificar assinatura
router.post('/webhook', raw({ type: 'application/json' }), asyncHandler(stripeController.webhook));

// 🛍️ Checkout e Portal (PROTEGIDOS)
router.post('/checkout', authenticate, asyncHandler(stripeController.createCheckout));
router.post('/portal', authenticate, asyncHandler(stripeController.createPortal));

export default router;
