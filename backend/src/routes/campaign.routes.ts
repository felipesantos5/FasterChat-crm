import { Router } from 'express';
import campaignController from '../controllers/campaign.controller';
import campaignExecutionController from '../controllers/campaign-execution.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';

const router = Router();

// Aplica autenticação em todas as rotas de campanha
router.use(authenticate);

// CRUD básico
router.post('/', checkPermission('CAMPAIGNS', true), campaignController.create);
router.get('/', checkPermission('CAMPAIGNS', false), campaignController.findAll);
router.get('/:id', checkPermission('CAMPAIGNS', false), campaignController.findById);
router.put('/:id', checkPermission('CAMPAIGNS', true), campaignController.update);
router.delete('/:id', checkPermission('CAMPAIGNS', true), campaignController.delete);

// Ações especiais (legado)
router.post('/estimate', checkPermission('CAMPAIGNS', false), campaignController.estimateReach);
router.post('/:id/send-now', checkPermission('CAMPAIGNS', true), campaignController.sendNow);
router.post('/:id/cancel', checkPermission('CAMPAIGNS', true), campaignController.cancel);

// 🚀 Execução de campanhas (BullMQ)
router.post('/:id/execute', checkPermission('CAMPAIGNS', true), campaignExecutionController.executeCampaign); // Disparo manual
router.post('/:id/reexecute', checkPermission('CAMPAIGNS', true), campaignExecutionController.reexecuteCampaign); // Reexecutar campanha
router.post('/:id/schedule', checkPermission('CAMPAIGNS', true), campaignExecutionController.scheduleCampaign); // Disparo agendado
router.post('/:id/cancel-execution', checkPermission('CAMPAIGNS', true), campaignExecutionController.cancelCampaign); // Cancelar execução

// 📊 Monitoramento
router.get('/:id/stats', checkPermission('CAMPAIGNS', false), campaignExecutionController.getCampaignStats); // Estatísticas em tempo real
router.get('/:id/logs', checkPermission('CAMPAIGNS', false), campaignExecutionController.getCampaignLogs); // Logs detalhados

export default router;
