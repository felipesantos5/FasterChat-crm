import { Router } from 'express';
import googleCalendarController from '../controllers/google-calendar.controller';
import { asyncHandler } from '../middlewares/errorHandler';

const router = Router();

// Auth
router.get('/auth-url', asyncHandler(googleCalendarController.getAuthUrl));
router.get('/callback', asyncHandler(googleCalendarController.handleCallback));

// Status e controle
router.get('/status', asyncHandler(googleCalendarController.getStatus));
router.post('/disconnect', asyncHandler(googleCalendarController.disconnect));

// Horários
router.get('/available-slots', asyncHandler(googleCalendarController.getAvailableSlots));

// Eventos
router.get('/events', asyncHandler(googleCalendarController.getEvents));

export default router;
