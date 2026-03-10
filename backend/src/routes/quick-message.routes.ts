import { Router } from 'express';
import quickMessageController from '../controllers/quick-message.controller';
import { authenticate } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(quickMessageController.findAll));
router.post('/', asyncHandler(quickMessageController.create));
router.put('/:id', asyncHandler(quickMessageController.update));
router.delete('/:id', asyncHandler(quickMessageController.delete));

export default router;
