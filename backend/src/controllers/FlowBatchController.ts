import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import flowQueueService from '../services/flow-queue.service';
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
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    this.processRows(batchStatus, validRows, phoneColumn, flow, fileName).catch(err => {
      console.error(`[FlowBatch] ❌ Erro fatal no batch ${batchId}:`, err);
      batchStatus.status = 'FAILED';
      batchStatus.completedAt = new Date();
    });

    return res as any;
  }

  // ==================================================================================
  // 🚀 BATCH PROCESSING VIA BULLMQ
  // Em vez de loop com setTimeout, enfileira todos os contatos como jobs BullMQ
  // com delays escalonados. A concorrência e rate limiting são controlados pelo worker.
  // ==================================================================================
  private static readonly BATCH_STAGGER_MIN_MS = 15_000;  // 15s mínimo entre enfileiramentos
  private static readonly BATCH_STAGGER_MAX_MS = 25_000;  // 25s máximo entre enfileiramentos

  /**
   * Enfileira todos os contatos como jobs BullMQ flow-orchestration com delays escalonados.
   * Retorna imediatamente — o BullMQ cuida da execução real.
   */
  private async processRows(
    batch: BatchStatus,
    rows: Record<string, unknown>[],
    phoneColumn: string,
    flow: Record<string, unknown>,
    fileName: string
  ): Promise<void> {
    let cumulativeDelay = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const phone = String(row[phoneColumn] || '').replace(/\D/g, '');

      const variables: Record<string, unknown> = {};
      for (const key of Object.keys(row)) {
        variables[key] = row[key];
      }
      variables.phone = phone;
      variables._batchId = batch.batchId;
      variables._batchName = fileName;
      variables._batchTotal = batch.total;

      try {
        await flowQueueService.enqueueFlowStart(
          {
            flowId: flow.id as string,
            contactPhone: phone,
            variables,
            companyId: flow.companyId as string,
          },
          { delay: cumulativeDelay }
        );

        batch.succeeded++;
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        batch.failed++;
        batch.errors.push({ row: i + 1, phone, error: error.message || 'Erro ao enfileirar' });
        console.error(`[FlowBatch] ❌ [${i + 1}/${rows.length}] Erro ao enfileirar ${phone}:`, error.message);
      }

      batch.processed++;

      // Delay escalonado para o próximo contato
      if (i < rows.length - 1) {
        const stagger = Math.floor(
          Math.random() * (FlowBatchController.BATCH_STAGGER_MAX_MS - FlowBatchController.BATCH_STAGGER_MIN_MS)
        ) + FlowBatchController.BATCH_STAGGER_MIN_MS;
        cumulativeDelay += stagger;
      }
    }

    batch.status = 'COMPLETED';
    batch.completedAt = new Date();

    console.log(
      `[FlowBatch] 📊 Batch ${batch.batchId} enfileirado: ${batch.succeeded} jobs criados, ` +
      `${batch.failed} erros. Spread total: ${(cumulativeDelay / 1000 / 60).toFixed(1)}min`
    );

    if (batch.errors.length > 100) {
      batch.errors = batch.errors.slice(-100);
    }
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

    // Busca contadores reais das execuções no banco (status atualizado pelo FlowEngine)
    try {
      const executionCounts = await prisma.flowExecution.groupBy({
        by: ['status'],
        where: {
          variables: { path: ['_batchId'], equals: batchId },
        },
        _count: true,
      });

      const realCounts: Record<string, number> = {};
      let realTotal = 0;
      for (const row of executionCounts) {
        realCounts[row.status] = row._count;
        realTotal += row._count;
      }

      const realFailed = (realCounts['FAILED'] || 0) + (realCounts['FORCE_CANCELLED'] || 0);
      const realSucceeded = (realCounts['COMPLETED'] || 0);
      const realActive = (realCounts['RUNNING'] || 0) + (realCounts['WAITING_REPLY'] || 0) + (realCounts['DELAYED'] || 0);
      const realPaused = (realCounts['PAUSED'] || 0);

      return res.json({
        ...batch,
        // Sobrescreve com contadores reais do banco
        succeeded: realSucceeded + realActive, // ativos ainda estão "ok" (não falharam)
        failed: realFailed + realPaused, // pausados pelo usuário + falhos
        // Detalhe granular para o frontend usar se quiser
        executionCounts: {
          completed: realCounts['COMPLETED'] || 0,
          running: realCounts['RUNNING'] || 0,
          waitingReply: realCounts['WAITING_REPLY'] || 0,
          delayed: realCounts['DELAYED'] || 0,
          failed: realCounts['FAILED'] || 0,
          paused: realCounts['PAUSED'] || 0,
          forceCancelled: realCounts['FORCE_CANCELLED'] || 0,
          total: realTotal,
        },
      });
    } catch (err) {
      // Se falhar a query no banco, retorna os dados em memória normalmente
      console.warn(`[FlowBatch] ⚠️ Erro ao buscar contadores reais do batch ${batchId}:`, err);
      return res.json(batch);
    }
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
