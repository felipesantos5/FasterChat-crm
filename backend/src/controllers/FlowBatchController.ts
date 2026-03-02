import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { FlowEngineService } from '../services/FlowEngineService';
import * as XLSX from 'xlsx';

/**
 * Controller para disparo em massa de fluxos via upload de planilha.
 * 
 * Funcionalidades:
 * - Upload de CSV/XLSX com variáveis do fluxo
 * - Processamento sequencial com delay aleatório de 10-15s entre cada contato
 * - Rastreamento de progresso via batch ID
 * - Seleção aleatória de instância WhatsApp por execução (respeita estratégia)
 */

interface BatchStatus {
  batchId: string;
  flowId: string;
  companyId: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PAUSED';
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ row: number; phone: string; error: string }>;
  startedAt: Date;
  completedAt: Date | null;
  pausedUntil: Date | null;     // Se pausado, quando retoma
  consecutiveErrors: number;     // Erros seguidos no batch
  pauseCount: number;            // Quantas vezes já pausou
}

// Store em memória para rastrear progresso dos batches
// Limite de 50 batches simultâneos para evitar memory leak
const batchStore = new Map<string, BatchStatus>();
const BATCH_STORE_MAX = 50;
const BATCH_MAX_ROWS = 5000;
const BATCH_CLEANUP_AFTER_MS = 60 * 60 * 1000; // 1 hora

// Limpeza periódica: remove batches finalizados há mais de 1 hora
setInterval(() => {
  const now = Date.now();
  for (const [id, batch] of batchStore) {
    if (batch.completedAt && now - batch.completedAt.getTime() > BATCH_CLEANUP_AFTER_MS) {
      batchStore.delete(id);
    }
  }
}, 5 * 60 * 1000); // Roda a cada 5 minutos

export class FlowBatchController {

  /**
   * POST /flows/:id/batch
   * Upload de planilha e disparo em massa do fluxo
   */
  public async uploadAndExecute(req: Request, res: Response): Promise<Response> {
    const { id: flowId } = req.params;
    const { companyId } = req.user!;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado. Envie um CSV ou XLSX.' });
    }

    // Validação do fluxo
    const flow = await prisma.flow.findFirst({
      where: { id: flowId, companyId, status: { in: ['ACTIVE', 'DRAFT'] } },
      include: { nodes: true, edges: true }
    });

    if (!flow) {
      return res.status(404).json({ error: 'Fluxo não encontrado ou não está ativo.' });
    }

    // Parse da planilha
    let rows: Record<string, any>[];
    try {
      const isCsv = file.originalname.toLowerCase().endsWith('.csv');
      const workbook = isCsv
        ? XLSX.read(file.buffer.toString('utf-8'), { type: 'string' })
        : XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
    } catch (err: any) {
      return res.status(400).json({ error: `Erro ao ler planilha: ${err.message}` });
    }

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'A planilha está vazia.' });
    }

    if (rows.length > BATCH_MAX_ROWS) {
      return res.status(400).json({
        error: `A planilha tem ${rows.length} linhas, mas o máximo permitido é ${BATCH_MAX_ROWS}. Divida em arquivos menores.`,
      });
    }

    // Verifica limite de batches simultâneos em memória
    const activeBatchCount = Array.from(batchStore.values()).filter(
      b => b.status === 'PROCESSING' || b.status === 'PAUSED'
    ).length;
    if (activeBatchCount >= BATCH_STORE_MAX) {
      return res.status(429).json({
        error: `Limite de ${BATCH_STORE_MAX} disparos simultâneos atingido. Aguarde a conclusão dos disparos em andamento.`,
      });
    }

    // Detectar coluna de telefone
    const phoneColumnNames = ['phone', 'telefone', 'tel', 'celular', 'whatsapp', 'numero', 'número'];
    const columns = Object.keys(rows[0]);
    const phoneColumn = columns.find(col => 
      phoneColumnNames.includes(col.toLowerCase().trim())
    );

    if (!phoneColumn) {
      return res.status(400).json({ 
        error: 'Coluna de telefone não encontrada. Use uma das colunas: phone, telefone, tel, celular, whatsapp, numero',
        columns: columns
      });
    }

    // Filtrar linhas com telefone válido
    const validRows = rows.filter(row => {
      const phone = String(row[phoneColumn] || '').replace(/\D/g, '');
      return phone.length >= 10;
    });

    if (validRows.length === 0) {
      return res.status(400).json({ error: 'Nenhuma linha com telefone válido encontrada na planilha.' });
    }

    // Criar batch ID
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Inicializar status do batch
    const batchStatus: BatchStatus = {
      batchId,
      flowId,
      companyId,
      status: 'PROCESSING',
      total: validRows.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
      startedAt: new Date(),
      completedAt: null,
      pausedUntil: null,
      consecutiveErrors: 0,
      pauseCount: 0,
    };
    batchStore.set(batchId, batchStatus);

    // Responde imediatamente com o batchId (processamento é assíncrono)
    res.status(202).json({
      message: `Disparo iniciado para ${validRows.length} contatos. Use o batchId para acompanhar o progresso.`,
      batchId,
      total: validRows.length,
      phoneColumn,
      variableColumns: columns.filter(c => c !== phoneColumn),
    });

    // Processa em background (não bloqueia a resposta)
    this.processRows(batchStatus, validRows, phoneColumn, flow, file.originalname).catch(err => {
      console.error(`[FlowBatch] ❌ Erro fatal no batch ${batchId}:`, err);
      batchStatus.status = 'FAILED';
      batchStatus.completedAt = new Date();
    });

    return res as any;
  }

  // ==================================================================================
  // 🛡️ CONFIGURAÇÕES DE PROTEÇÃO DO BATCH
  // ==================================================================================
  private static readonly BATCH_CONSECUTIVE_ERROR_LIMIT = 3;   // Pausa após 3 erros seguidos
  private static readonly BATCH_PAUSE_BASE_MS = 60_000;         // 1 min de pausa base
  private static readonly BATCH_PAUSE_MAX_MS = 10 * 60_000;     // 10 min de pausa máxima
  private static readonly BATCH_TOTAL_ERROR_ABORT_RATIO = 0.5;  // Aborta se >50% falhou
  private static readonly BATCH_MIN_PROCESSED_FOR_ABORT = 10;   // Mínimo processados antes de checar ratio
  private static readonly BATCH_ANTI_SPAM_MIN_MS = 30_000;      // 30s mínimo entre contatos
  private static readonly BATCH_ANTI_SPAM_MAX_MS = 60_000;      // 60s máximo entre contatos
  private static readonly BATCH_INSTANCE_CHECK_INTERVAL = 10;   // Verifica instância a cada N contatos

  /**
   * Processa as linhas sequencialmente com delay, circuit breaker e auto-pause
   */
  private async processRows(
    batch: BatchStatus,
    rows: Record<string, any>[],
    phoneColumn: string,
    flow: any,
    fileName: string
  ) {
    const flowEngine = new FlowEngineService();

    // Verifica se há instância WhatsApp conectada ANTES de começar
    const connectedInstance = await prisma.whatsAppInstance.findFirst({
      where: { companyId: flow.companyId, status: { in: ['CONNECTED', 'CONNECTING'] } },
      select: { id: true, instanceName: true },
    });

    if (!connectedInstance) {
      console.error(`[FlowBatch] ❌ Nenhuma instância WhatsApp conectada. Abortando batch ${batch.batchId}`);
      batch.status = 'FAILED';
      batch.completedAt = new Date();
      batch.errors.push({ row: 0, phone: '', error: 'Nenhuma instância WhatsApp conectada' });
      return;
    }

    for (let i = 0; i < rows.length; i++) {
      // 🛑 Verifica cancelamento
      if (batch.status === 'CANCELLED') {
        console.log(`[FlowBatch] 🛑 Batch ${batch.batchId} cancelado pelo usuário. ${batch.processed}/${batch.total} processados.`);
        break;
      }

      // 🛡️ Verifica se taxa de erro é muito alta (aborta para proteger a API)
      if (batch.processed >= FlowBatchController.BATCH_MIN_PROCESSED_FOR_ABORT) {
        const errorRatio = batch.failed / batch.processed;
        if (errorRatio >= FlowBatchController.BATCH_TOTAL_ERROR_ABORT_RATIO) {
          console.error(`[FlowBatch] 🔴 Taxa de erro muito alta (${(errorRatio * 100).toFixed(0)}%). Abortando batch ${batch.batchId} para proteger a API.`);
          batch.status = 'FAILED';
          batch.completedAt = new Date();
          batch.errors.push({
            row: i + 1,
            phone: '',
            error: `Batch abortado: ${(errorRatio * 100).toFixed(0)}% dos envios falharam (${batch.failed}/${batch.processed}). Verifique a conexão do WhatsApp.`,
          });
          break;
        }
      }

      // 🏥 Verifica saúde da instância WhatsApp a cada N contatos
      if (i > 0 && i % FlowBatchController.BATCH_INSTANCE_CHECK_INTERVAL === 0) {
        const instanceOk = await prisma.whatsAppInstance.findFirst({
          where: { companyId: flow.companyId, status: 'CONNECTED' },
          select: { id: true },
        });

        if (!instanceOk) {
          console.error(`[FlowBatch] 🔴 Instância WhatsApp desconectada durante o batch. Pausando...`);
          batch.status = 'PAUSED';
          const pauseMs = FlowBatchController.BATCH_PAUSE_MAX_MS; // Pausa longa para reconexão
          batch.pausedUntil = new Date(Date.now() + pauseMs);
          batch.pauseCount++;

          console.log(`[FlowBatch] ⏸️ Aguardando ${(pauseMs / 1000).toFixed(0)}s para reconexão...`);
          await new Promise(resolve => setTimeout(resolve, pauseMs));

          // Re-verifica após pausa
          const reconnected = await prisma.whatsAppInstance.findFirst({
            where: { companyId: flow.companyId, status: 'CONNECTED' },
            select: { id: true },
          });

          if (!reconnected) {
            console.error(`[FlowBatch] 🔴 Instância ainda desconectada após pausa. Abortando batch.`);
            batch.status = 'FAILED';
            batch.completedAt = new Date();
            batch.errors.push({ row: i + 1, phone: '', error: 'WhatsApp desconectado durante o envio' });
            break;
          }

          batch.status = 'PROCESSING';
          batch.pausedUntil = null;
          console.log(`[FlowBatch] ▶️ Instância reconectada. Retomando batch...`);
        }
      }

      const row = rows[i];
      const phone = String(row[phoneColumn] || '').replace(/\D/g, '');

      // Monta as variáveis a partir de todas as colunas
      const variables: Record<string, any> = {};
      for (const key of Object.keys(row)) {
        variables[key] = row[key];
      }
      variables.phone = phone;

      // Injeta metadados ocultos do batch para agrupar no frontend
      variables._batchId = batch.batchId;
      variables._batchName = fileName;
      variables._batchTotal = batch.total;

      try {
        await flowEngine.startFlow(flow.id, phone, variables);

        batch.succeeded++;
        batch.consecutiveErrors = 0; // Reseta erros consecutivos no sucesso
      } catch (err: any) {
        batch.failed++;
        batch.consecutiveErrors++;
        batch.errors.push({
          row: i + 1,
          phone,
          error: err.message || 'Erro desconhecido',
        });
        console.error(`[FlowBatch] ❌ [${i + 1}/${rows.length}] Erro ao disparar para ${phone}:`, err.message);

        // 🛡️ AUTO-PAUSE: Muitos erros seguidos → pausa para a API se recuperar
        if (batch.consecutiveErrors >= FlowBatchController.BATCH_CONSECUTIVE_ERROR_LIMIT) {
          const pauseFactor = Math.min(batch.pauseCount + 1, 5); // Backoff: mais pausas = pausa mais longa
          const pauseMs = Math.min(
            FlowBatchController.BATCH_PAUSE_BASE_MS * Math.pow(2, pauseFactor - 1),
            FlowBatchController.BATCH_PAUSE_MAX_MS
          );

          batch.status = 'PAUSED';
          batch.pausedUntil = new Date(Date.now() + pauseMs);
          batch.pauseCount++;

          console.warn(`[FlowBatch] ⏸️ ${batch.consecutiveErrors} erros consecutivos. Pausando por ${(pauseMs / 1000).toFixed(0)}s (pausa #${batch.pauseCount})`);

          await new Promise(resolve => setTimeout(resolve, pauseMs));

          // Verifica cancelamento durante a pausa (status pode mudar externamente via cancelBatch)
          if ((batch.status as string) === 'CANCELLED') break;

          batch.status = 'PROCESSING';
          batch.pausedUntil = null;
          batch.consecutiveErrors = 0; // Reseta para dar outra chance
          console.log(`[FlowBatch] ▶️ Retomando após pausa #${batch.pauseCount}...`);
        }
      }

      batch.processed++;

      // Delay anti-spam entre contatos (30-60s)
      if (i < rows.length - 1 && (batch.status as string) !== 'CANCELLED') {
        const delayMs = Math.floor(Math.random() * (FlowBatchController.BATCH_ANTI_SPAM_MAX_MS - FlowBatchController.BATCH_ANTI_SPAM_MIN_MS))
          + FlowBatchController.BATCH_ANTI_SPAM_MIN_MS;
        console.log(`[FlowBatch] ⏳ Anti-spam: aguardando ${(delayMs / 1000).toFixed(1)}s antes do próximo contato (${i + 2}/${rows.length})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    if (batch.status === 'PROCESSING') {
      batch.status = 'COMPLETED';
    }
    batch.completedAt = new Date();

    const duration = ((batch.completedAt.getTime() - batch.startedAt.getTime()) / 1000 / 60).toFixed(1);
    console.log(`[FlowBatch] 📊 Batch ${batch.batchId} finalizado em ${duration}min: ${batch.succeeded} OK, ${batch.failed} erros, ${batch.pauseCount} pausas`);

    // Limita array de erros armazenados para evitar consumo excessivo de memória
    if (batch.errors.length > 100) {
      batch.errors = batch.errors.slice(-100);
    }
    // Cleanup automático é feito pelo setInterval global (a cada 5 min, remove batches finalizados há mais de 1h)
  }

  /**
   * GET /flows/:id/batch/:batchId
   * Retorna o status de um batch em andamento
   */
  public async getBatchStatus(req: Request, res: Response): Promise<Response> {
    const { batchId } = req.params;

    const batch = batchStore.get(batchId);
    if (!batch) {
      return res.status(404).json({ error: 'Batch não encontrado ou já expirou.' });
    }

    return res.json(batch);
  }

  /**
   * GET /flows/batches/active
   * Retorna os disparos ativos e recentes da empresa logada
   */
  public async getActiveBatches(req: Request, res: Response): Promise<Response> {
    const { companyId } = req.user!;

    const activeBatches: BatchStatus[] = [];
    for (const batch of batchStore.values()) {
      if (batch.companyId === companyId) {
        // Retornamos PROCESSING e os pausados ou recentemente terminados
        activeBatches.push(batch);
      }
    }

    return res.json({ activeBatches });
  }

  /**
   * POST /flows/:id/batch/:batchId/cancel
   * Cancela um batch em andamento
   */
  public async cancelBatch(req: Request, res: Response): Promise<Response> {
    const { batchId } = req.params;

    const batch = batchStore.get(batchId);
    if (!batch) {
      return res.status(404).json({ error: 'Batch não encontrado.' });
    }

    if (batch.status === 'PROCESSING' || batch.status === 'PAUSED') {
      batch.status = 'CANCELLED';
      batch.completedAt = new Date();
      batch.pausedUntil = null;
      return res.json({ message: 'Disparo cancelado com sucesso.', batch });
    }

    return res.status(400).json({ error: 'Batch já foi finalizado ou já cancelado.', batch });
  }

  /**
   * POST /flows/:id/batch/preview
   * Preview da planilha (retorna colunas e primeiras linhas sem disparar)
   */
  public async previewUpload(req: Request, res: Response): Promise<Response> {
    const { id: flowId } = req.params;
    const { companyId } = req.user!;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    try {
      const isCsv = file.originalname.toLowerCase().endsWith('.csv');
      const workbook = isCsv
        ? XLSX.read(file.buffer.toString('utf-8'), { type: 'string' })
        : XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

      if (!rows || rows.length === 0) {
        return res.status(400).json({ error: 'A planilha está vazia.' });
      }

      const columns = Object.keys(rows[0]);
      
      // Detecta automaticamente a coluna de telefone
      const phoneColumnNames = ['phone', 'telefone', 'tel', 'celular', 'whatsapp', 'numero', 'número'];
      const detectedPhoneColumn = columns.find(col => 
        phoneColumnNames.includes(col.toLowerCase().trim())
      );

      // Colunas que serão variáveis do fluxo (todas exceto a de telefone)
      const variableColumns = columns.filter(col => col !== detectedPhoneColumn);

      // 🔑 SALVA A PRIMEIRA LINHA COMO lastWebhookPayload
      // Isso faz com que as colunas da planilha apareçam no VariablePickerModal
      // exatamente da mesma forma que as variáveis do webhook.
      // Ex: coluna "nome" → variável {{nome}}, coluna "produto" → {{produto}}
      if (flowId && companyId) {
        try {
          const sampleRow = rows[0];
          // Garante que 'phone' está presente no payload (a coluna de telefone mapeada)
          const payloadForVariables: Record<string, any> = { ...sampleRow };
          if (detectedPhoneColumn && detectedPhoneColumn !== 'phone') {
            payloadForVariables.phone = sampleRow[detectedPhoneColumn];
          }

          await prisma.flow.update({
            where: { id: flowId, companyId },
            data: { lastWebhookPayload: payloadForVariables }
          });

        } catch (updateErr: any) {
          // Não falha se não conseguir atualizar (ex: fluxo não pertence à empresa)
          console.warn(`[FlowBatch] ⚠️ Não foi possível salvar variáveis da planilha:`, updateErr.message);
        }
      }

      return res.json({
        columns,
        totalRows: rows.length,
        detectedPhoneColumn: detectedPhoneColumn || null,
        variableColumns,
        preview: rows.slice(0, 5), // Primeiras 5 linhas para preview
      });
    } catch (err: any) {
      return res.status(400).json({ error: `Erro ao ler planilha: ${err.message}` });
    }
  }
}
