import { Router } from 'express';
import whatsappController from '../controllers/whatsapp.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// POST /api/whatsapp/create-instance - Cria uma nova instância
router.post('/create-instance', checkPermission('WHATSAPP_CONFIG', true), whatsappController.createInstance);

// GET /api/whatsapp/qr/:instanceId - Obtém o QR Code
router.get('/qr/:instanceId', checkPermission('WHATSAPP_CONFIG', false), whatsappController.getQRCode);

// GET /api/whatsapp/status/:instanceId - Verifica status de conexão
router.get('/status/:instanceId', checkPermission('WHATSAPP_CONFIG', false), whatsappController.getStatus);

// POST /api/whatsapp/send-message - Envia mensagem
router.post('/send-message', checkPermission('WHATSAPP_CONFIG', true), whatsappController.sendMessage);

// GET /api/whatsapp/instances/:companyId - Lista instâncias da empresa
router.get('/instances/:companyId', checkPermission('WHATSAPP_CONFIG', false), whatsappController.getInstances);

// DELETE /api/whatsapp/instance/:instanceId - Deleta instância
router.delete('/instance/:instanceId', checkPermission('WHATSAPP_CONFIG', true), whatsappController.deleteInstance);

// POST /api/whatsapp/disconnect/:instanceId - Desconecta instância
router.post('/disconnect/:instanceId', checkPermission('WHATSAPP_CONFIG', true), whatsappController.disconnectInstance);

// POST /api/whatsapp/sync/:instanceId - Sincroniza status manualmente
router.post('/sync/:instanceId', checkPermission('WHATSAPP_CONFIG', true), whatsappController.syncStatus);

// PATCH /api/whatsapp/instance/:instanceId/name - Atualiza nome da instância
router.patch('/instance/:instanceId/name', checkPermission('WHATSAPP_CONFIG', true), whatsappController.updateInstanceName);

export default router;
