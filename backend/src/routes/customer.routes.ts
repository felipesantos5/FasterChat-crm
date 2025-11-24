import { Router } from 'express';
import { customerController } from '../controllers/customer.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Customer CRUD
router.post('/', customerController.create.bind(customerController));
router.get('/', customerController.findAll.bind(customerController));
router.get('/stats', customerController.getStats.bind(customerController));
router.get('/tags', customerController.getAllTags.bind(customerController));
router.get('/:id', customerController.findById.bind(customerController));
router.put('/:id', customerController.update.bind(customerController));
router.delete('/:id', customerController.delete.bind(customerController));

export default router;
