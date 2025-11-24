import { Router } from 'express';
import whatsappController from '../controllers/whatsapp.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// POST /api/whatsapp/create-instance - Cria uma nova instância
router.post('/create-instance', whatsappController.createInstance);

// GET /api/whatsapp/qr/:instanceId - Obtém o QR Code
router.get('/qr/:instanceId', whatsappController.getQRCode);

// GET /api/whatsapp/status/:instanceId - Verifica status de conexão
router.get('/status/:instanceId', whatsappController.getStatus);

// POST /api/whatsapp/send-message - Envia mensagem
router.post('/send-message', whatsappController.sendMessage);

// GET /api/whatsapp/instances/:companyId - Lista instâncias da empresa
router.get('/instances/:companyId', whatsappController.getInstances);

// DELETE /api/whatsapp/instance/:instanceId - Deleta instância
router.delete('/instance/:instanceId', whatsappController.deleteInstance);

// POST /api/whatsapp/disconnect/:instanceId - Desconecta instância
router.post('/disconnect/:instanceId', whatsappController.disconnectInstance);

export default router;
