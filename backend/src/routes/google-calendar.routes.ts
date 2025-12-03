import { Router } from 'express';
import googleCalendarController from '../controllers/google-calendar.controller';

const router = Router();

// Auth
router.get('/auth-url', googleCalendarController.getAuthUrl);
router.get('/callback', googleCalendarController.handleCallback);

// Status e controle
router.get('/status', googleCalendarController.getStatus);
router.post('/disconnect', googleCalendarController.disconnect);

// Horários
router.get('/available-slots', googleCalendarController.getAvailableSlots);

// Eventos
router.get('/events', googleCalendarController.getEvents);

export default router;
