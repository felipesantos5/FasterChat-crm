import { Router } from 'express';
import campaignController from '../controllers/campaign.controller';

const router = Router();

// CRUD básico
router.post('/', campaignController.create);
router.get('/', campaignController.findAll);
router.get('/:id', campaignController.findById);
router.put('/:id', campaignController.update);
router.delete('/:id', campaignController.delete);

// Ações especiais
router.post('/estimate', campaignController.estimateReach);
router.post('/:id/send-now', campaignController.sendNow);
router.post('/:id/cancel', campaignController.cancel);

export default router;
