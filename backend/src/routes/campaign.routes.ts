import { Router } from 'express';
import campaignController from '../controllers/campaign.controller';
import campaignExecutionController from '../controllers/campaign-execution.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { asyncHandler } from '../middlewares/errorHandler';

const router = Router();

// Aplica autenticação em todas as rotas de campanha
router.use(authenticate);

// CRUD básico
router.post('/', checkPermission('CAMPAIGNS', true), asyncHandler(campaignController.create));
router.get('/', checkPermission('CAMPAIGNS', false), asyncHandler(campaignController.findAll));
router.get('/:id', checkPermission('CAMPAIGNS', false), asyncHandler(campaignController.findById));
router.put('/:id', checkPermission('CAMPAIGNS', true), asyncHandler(campaignController.update));
router.delete('/:id', checkPermission('CAMPAIGNS', true), asyncHandler(campaignController.delete));

// Ações especiais (legado)
router.post('/estimate', checkPermission('CAMPAIGNS', false), asyncHandler(campaignController.estimateReach));
router.post('/:id/send-now', checkPermission('CAMPAIGNS', true), asyncHandler(campaignController.sendNow));
router.post('/:id/cancel', checkPermission('CAMPAIGNS', true), asyncHandler(campaignController.cancel));

// Execução de campanhas (BullMQ)
router.post('/:id/execute', checkPermission('CAMPAIGNS', true), asyncHandler(campaignExecutionController.executeCampaign));
router.post('/:id/reexecute', checkPermission('CAMPAIGNS', true), asyncHandler(campaignExecutionController.reexecuteCampaign));
router.post('/:id/schedule', checkPermission('CAMPAIGNS', true), asyncHandler(campaignExecutionController.scheduleCampaign));
router.post('/:id/cancel-execution', checkPermission('CAMPAIGNS', true), asyncHandler(campaignExecutionController.cancelCampaign));

// Monitoramento
router.get('/:id/stats', checkPermission('CAMPAIGNS', false), asyncHandler(campaignExecutionController.getCampaignStats));
router.get('/:id/logs', checkPermission('CAMPAIGNS', false), asyncHandler(campaignExecutionController.getCampaignLogs));

export default router;
