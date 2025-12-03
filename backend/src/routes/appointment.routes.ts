import { Router } from 'express';
import appointmentController from '../controllers/appointment.controller';

const router = Router();

// Consultas (devem vir ANTES das rotas com :id)
router.get('/available-slots', appointmentController.getAvailableSlots);
router.get('/customer/:customerId/upcoming', appointmentController.getCustomerUpcoming);

// CRUD
router.post('/', appointmentController.create);
router.get('/', appointmentController.list);
router.get('/:id', appointmentController.getById);
router.patch('/:id', appointmentController.update);
router.delete('/:id', appointmentController.delete);

// Ações
router.post('/:id/cancel', appointmentController.cancel);

export default router;
