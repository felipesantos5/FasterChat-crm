import { Router } from 'express';
import appointmentController from '../controllers/appointment.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// Consultas (devem vir ANTES das rotas com :id)
router.get('/available-slots', checkPermission('CALENDAR', false), appointmentController.getAvailableSlots);
router.get('/customer/:customerId/upcoming', checkPermission('CALENDAR', false), appointmentController.getCustomerUpcoming);

// CRUD
router.post('/', checkPermission('CALENDAR', true), appointmentController.create);
router.get('/', checkPermission('CALENDAR', false), appointmentController.list);
router.get('/:id', checkPermission('CALENDAR', false), appointmentController.getById);
router.patch('/:id', checkPermission('CALENDAR', true), appointmentController.update);
router.delete('/:id', checkPermission('CALENDAR', true), appointmentController.delete);

// Ações
router.post('/:id/cancel', checkPermission('CALENDAR', true), appointmentController.cancel);

export default router;
