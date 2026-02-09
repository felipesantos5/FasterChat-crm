import { Router } from 'express';
import { collaboratorController } from '../controllers/collaborator.controller';
import { authenticate } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';

const router = Router();

router.post('/', authenticate, asyncHandler(collaboratorController.invite.bind(collaboratorController)));
router.get('/', authenticate, asyncHandler(collaboratorController.list.bind(collaboratorController)));
router.put('/:id/permissions', authenticate, asyncHandler(collaboratorController.updatePermissions.bind(collaboratorController)));
router.delete('/:id', authenticate, asyncHandler(collaboratorController.remove.bind(collaboratorController)));
router.delete('/invites/:id', authenticate, asyncHandler(collaboratorController.cancelInvite.bind(collaboratorController)));
router.get('/me/permissions', authenticate, asyncHandler(collaboratorController.getPermissions.bind(collaboratorController)));

router.post('/accept/:token', asyncHandler(collaboratorController.acceptInvite.bind(collaboratorController)));

export default router;
