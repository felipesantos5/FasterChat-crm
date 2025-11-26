import { Router } from 'express';
import tagController from '../controllers/tag.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

router.post('/', tagController.create);
router.get('/', tagController.findAll);
router.get('/names', tagController.findAllNames);
router.post('/sync', tagController.syncFromCustomers);
router.delete('/:id', tagController.delete);

export default router;
