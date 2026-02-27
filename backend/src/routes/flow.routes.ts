import { Router } from 'express';
import multer from 'multer';
import { FlowController } from '../controllers/FlowController';
import { FlowBatchController } from '../controllers/FlowBatchController';
import { authenticate } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';

const flowRouter = Router();
const flowController = new FlowController();
const flowBatchController = new FlowBatchController();

// Multer para upload de planilhas (CSV/XLSX)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream', // Fallback para arquivos não reconhecidos
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(csv|xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de arquivo não suportado. Use CSV ou XLSX.'));
    }
  },
});

flowRouter.use(authenticate);

flowRouter.get('/', asyncHandler(flowController.getFlows));
flowRouter.post('/', asyncHandler(flowController.createFlow));
flowRouter.get('/:id', asyncHandler(flowController.getFlowById));
flowRouter.put('/:id', asyncHandler(flowController.updateFlow));
flowRouter.get('/:id/variables', asyncHandler(flowController.getFlowVariables));
flowRouter.get('/:id/executions', asyncHandler(flowController.getFlowExecutions));
flowRouter.delete('/:id/executions/:executionId', asyncHandler(flowController.cancelExecution.bind(flowController)));
flowRouter.post('/:id/nodes', asyncHandler(flowController.saveFlowNodes));
flowRouter.delete('/:id', asyncHandler(flowController.deleteFlow));

// Batch upload routes (bind() necessário para manter o contexto 'this' da classe)
flowRouter.post('/:id/batch/preview', upload.single('file'), asyncHandler(flowBatchController.previewUpload.bind(flowBatchController)));
flowRouter.post('/:id/batch', upload.single('file'), asyncHandler(flowBatchController.uploadAndExecute.bind(flowBatchController)));
flowRouter.get('/:id/batch/:batchId', asyncHandler(flowBatchController.getBatchStatus.bind(flowBatchController)));

export { flowRouter };
