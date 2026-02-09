import { Router } from 'express';
import appointmentController from '../controllers/appointment.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { asyncHandler } from '../middlewares/errorHandler';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// Consultas (devem vir ANTES das rotas com :id)
router.get('/available-slots', checkPermission('CALENDAR', false), asyncHandler(appointmentController.getAvailableSlots));
router.get('/customer/:customerId/upcoming', checkPermission('CALENDAR', false), asyncHandler(appointmentController.getCustomerUpcoming));

// CRUD
router.post('/', checkPermission('CALENDAR', true), asyncHandler(appointmentController.create));
router.get('/', checkPermission('CALENDAR', false), asyncHandler(appointmentController.list));
router.get('/:id', checkPermission('CALENDAR', false), asyncHandler(appointmentController.getById));
router.patch('/:id', checkPermission('CALENDAR', true), asyncHandler(appointmentController.update));
router.delete('/:id', checkPermission('CALENDAR', true), asyncHandler(appointmentController.delete));

// Ações
router.post('/:id/cancel', checkPermission('CALENDAR', true), asyncHandler(appointmentController.cancel));

export default router;
