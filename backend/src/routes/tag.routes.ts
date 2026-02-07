import { Router } from 'express';
import tagController from '../controllers/tag.controller';
import { authenticate } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

router.post('/', asyncHandler(tagController.create));
router.get('/', asyncHandler(tagController.findAll));
router.get('/names', asyncHandler(tagController.findAllNames));
router.post('/sync', asyncHandler(tagController.syncFromCustomers));
router.delete('/:id', asyncHandler(tagController.delete));

export default router;
