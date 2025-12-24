import { Router } from 'express';
import { collaboratorController } from '../controllers/collaborator.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.post('/', authenticate, collaboratorController.invite.bind(collaboratorController));
router.get('/', authenticate, collaboratorController.list.bind(collaboratorController));
router.put('/:id/permissions', authenticate, collaboratorController.updatePermissions.bind(collaboratorController));
router.delete('/:id', authenticate, collaboratorController.remove.bind(collaboratorController));
router.delete('/invites/:id', authenticate, collaboratorController.cancelInvite.bind(collaboratorController));
router.get('/me/permissions', authenticate, collaboratorController.getPermissions.bind(collaboratorController));

router.post('/accept/:token', collaboratorController.acceptInvite.bind(collaboratorController));

export default router;
