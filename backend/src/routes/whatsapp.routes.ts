import { Router } from 'express';
import whatsappController from '../controllers/whatsapp.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { asyncHandler } from '../middlewares/errorHandler';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// POST /api/whatsapp/create-instance - Cria uma nova instância
router.post('/create-instance', checkPermission('WHATSAPP_CONFIG', true), asyncHandler(whatsappController.createInstance));

// GET /api/whatsapp/qr/:instanceId - Obtém o QR Code
router.get('/qr/:instanceId', checkPermission('WHATSAPP_CONFIG', false), asyncHandler(whatsappController.getQRCode));

// GET /api/whatsapp/status/:instanceId - Verifica status de conexão
router.get('/status/:instanceId', checkPermission('WHATSAPP_CONFIG', false), asyncHandler(whatsappController.getStatus));

// POST /api/whatsapp/send-message - Envia mensagem
router.post('/send-message', checkPermission('WHATSAPP_CONFIG', true), asyncHandler(whatsappController.sendMessage));

// GET /api/whatsapp/instances/:companyId - Lista instâncias da empresa
router.get('/instances/:companyId', checkPermission('WHATSAPP_CONFIG', false), asyncHandler(whatsappController.getInstances));

// DELETE /api/whatsapp/instance/:instanceId - Deleta instância
router.delete('/instance/:instanceId', checkPermission('WHATSAPP_CONFIG', true), asyncHandler(whatsappController.deleteInstance));

// POST /api/whatsapp/disconnect/:instanceId - Desconecta instância
router.post('/disconnect/:instanceId', checkPermission('WHATSAPP_CONFIG', true), asyncHandler(whatsappController.disconnectInstance));

// POST /api/whatsapp/sync/:instanceId - Sincroniza status manualmente
router.post('/sync/:instanceId', checkPermission('WHATSAPP_CONFIG', true), asyncHandler(whatsappController.syncStatus));

// PATCH /api/whatsapp/instance/:instanceId/name - Atualiza nome da instância
router.patch('/instance/:instanceId/name', checkPermission('WHATSAPP_CONFIG', true), asyncHandler(whatsappController.updateInstanceName));

// GET /api/whatsapp/presence/:instanceId/:phone - Verifica presença de contato
router.get('/presence/:instanceId/:phone', asyncHandler(whatsappController.getContactPresence));

// POST /api/whatsapp/reconfigure-webhook/:instanceId - Reconfigura webhook de uma instância
router.post('/reconfigure-webhook/:instanceId', checkPermission('WHATSAPP_CONFIG', true), asyncHandler(whatsappController.reconfigureWebhook));

export default router;
