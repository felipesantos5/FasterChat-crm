import { Router } from 'express';
import campaignController from '../controllers/campaign.controller';
import campaignExecutionController from '../controllers/campaign-execution.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Aplica autenticação em todas as rotas de campanha
router.use(authenticate);

// CRUD básico
router.post('/', campaignController.create);
router.get('/', campaignController.findAll);
router.get('/:id', campaignController.findById);
router.put('/:id', campaignController.update);
router.delete('/:id', campaignController.delete);

// Ações especiais (legado)
router.post('/estimate', campaignController.estimateReach);
router.post('/:id/send-now', campaignController.sendNow);
router.post('/:id/cancel', campaignController.cancel);

// 🚀 Execução de campanhas (BullMQ)
router.post('/:id/execute', campaignExecutionController.executeCampaign); // Disparo manual
router.post('/:id/reexecute', campaignExecutionController.reexecuteCampaign); // Reexecutar campanha
router.post('/:id/schedule', campaignExecutionController.scheduleCampaign); // Disparo agendado
router.post('/:id/cancel-execution', campaignExecutionController.cancelCampaign); // Cancelar execução

// 📊 Monitoramento
router.get('/:id/stats', campaignExecutionController.getCampaignStats); // Estatísticas em tempo real
router.get('/:id/logs', campaignExecutionController.getCampaignLogs); // Logs detalhados

export default router;
