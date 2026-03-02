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
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    this.processRows(batchStatus, validRows, phoneColumn, flow, fileName).catch(err => {
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
  private static readonly BATCH_ANTI_SPAM_MIN_MS = 15_000;      // 15s mínimo entre contatos
  private static readonly BATCH_ANTI_SPAM_MAX_MS = 25_000;      // 20s máximo entre contatos
  private static readonly BATCH_INSTANCE_CHECK_INTERVAL = 10;   // Verifica instância a cada N contatos

  /**
   * Processa as linhas distribuindo entre todas as instâncias conectadas em paralelo.
   * Com N instâncias, o tempo total é dividido por N (cada uma tem seu próprio delay).
   */
  private async processRows(
    batch: BatchStatus,
    rows: Record<string, any>[],
    phoneColumn: string,
    flow: any,
    fileName: string
  ) {
    // Busca TODAS as instâncias conectadas para determinar paralelismo
    const connectedInstances = await prisma.whatsAppInstance.findMany({
      where: { companyId: flow.companyId, status: { in: ['CONNECTED', 'CONNECTING'] } },
      select: { id: true, instanceName: true },
    });

    if (connectedInstances.length === 0) {
      console.error(`[FlowBatch] ❌ Nenhuma instância WhatsApp conectada. Abortando batch ${batch.batchId}`);
      batch.status = 'FAILED';
      batch.completedAt = new Date();
      batch.errors.push({ row: 0, phone: '', error: 'Nenhuma instância WhatsApp conectada' });
      return;
    }

    const N = connectedInstances.length;

    if (N === 1) {
      // Único número: fluxo sequencial normal
      await this.processWorkerChunk(batch, rows, phoneColumn, flow, fileName, 0, 1);
    } else {
      // Múltiplos números: divide contatos igualmente e roda em paralelo
      const chunks: Record<string, any>[][] = Array.from({ length: N }, () => []);
      rows.forEach((row, idx) => chunks[idx % N].push(row));

      const names = connectedInstances.map(i => i.instanceName).join(', ');
      console.log(
        `[FlowBatch] 🚀 ${N} instâncias ativas (${names}). ` +
        `Dividindo ${rows.length} contatos em ${N} grupos de ~${Math.ceil(rows.length / N)} cada. ` +
        `Tempo estimado: ${Math.ceil(rows.length / N * 45 / 60)}min (vs ${Math.ceil(rows.length * 45 / 60)}min sequencial).`
      );

      await Promise.all(
        chunks.map((chunk, i) => this.processWorkerChunk(batch, chunk, phoneColumn, flow, fileName, i, N))
      );
    }

    if (batch.status === 'PROCESSING') {
      batch.status = 'COMPLETED';
    }
    batch.completedAt = new Date();

    const duration = ((batch.completedAt.getTime() - batch.startedAt.getTime()) / 1000 / 60).toFixed(1);
    console.log(`[FlowBatch] 📊 Batch ${batch.batchId} finalizado em ${duration}min: ${batch.succeeded} OK, ${batch.failed} erros`);

    if (batch.errors.length > 100) {
      batch.errors = batch.errors.slice(-100);
    }
  }

  /**
   * Worker individual: processa um subconjunto de contatos sequencialmente com delay próprio.
   * Cada instância WhatsApp tem seu próprio worker, garantindo delay independente por número.
   */
  private async processWorkerChunk(
    batch: BatchStatus,
    rows: Record<string, any>[],
    phoneColumn: string,
    flow: any,
    fileName: string,
    workerIndex: number,
    totalWorkers: number
  ) {
    const flowEngine = new FlowEngineService();
    const tag = totalWorkers > 1 ? ` [Worker ${workerIndex + 1}/${totalWorkers}]` : '';
    let consecutiveErrors = 0;
    let pauseCount = 0;

    for (let i = 0; i < rows.length; i++) {
      // 🛑 Verifica cancelamento
      if (batch.status === 'CANCELLED') {
        console.log(`[FlowBatch]${tag} 🛑 Batch cancelado pelo usuário.`);
        break;
      }

      // 🛡️ Verifica taxa de erro global (soma de todos os workers)
      if (batch.processed >= FlowBatchController.BATCH_MIN_PROCESSED_FOR_ABORT) {
        const errorRatio = batch.failed / batch.processed;
        if (errorRatio >= FlowBatchController.BATCH_TOTAL_ERROR_ABORT_RATIO) {
          console.error(`[FlowBatch]${tag} 🔴 Taxa de erro muito alta (${(errorRatio * 100).toFixed(0)}%). Abortando.`);
          batch.status = 'FAILED';
          batch.completedAt = new Date();
          batch.errors.push({
            row: i + 1,
            phone: '',
            error: `Batch abortado: ${(errorRatio * 100).toFixed(0)}% dos envios falharam (${batch.failed}/${batch.processed}).`,
          });
          break;
        }
      }

      // 🏥 Verifica saúde das instâncias a cada N contatos
      if (i > 0 && i % FlowBatchController.BATCH_INSTANCE_CHECK_INTERVAL === 0) {
        const instanceOk = await prisma.whatsAppInstance.findFirst({
          where: { companyId: flow.companyId, status: 'CONNECTED' },
          select: { id: true },
        });

        if (!instanceOk) {
          console.error(`[FlowBatch]${tag} 🔴 Instância desconectada. Pausando ${(FlowBatchController.BATCH_PAUSE_MAX_MS / 1000).toFixed(0)}s...`);
          await new Promise(resolve => setTimeout(resolve, FlowBatchController.BATCH_PAUSE_MAX_MS));

          const reconnected = await prisma.whatsAppInstance.findFirst({
            where: { companyId: flow.companyId, status: 'CONNECTED' },
            select: { id: true },
          });

          if (!reconnected) {
            console.error(`[FlowBatch]${tag} 🔴 Ainda desconectada após pausa. Encerrando worker.`);
            batch.errors.push({ row: i + 1, phone: '', error: 'WhatsApp desconectado durante o envio' });
            break;
          }

          console.log(`[FlowBatch]${tag} ▶️ Instância reconectada. Retomando...`);
        }
      }

      const row = rows[i];
      const phone = String(row[phoneColumn] || '').replace(/\D/g, '');

      const variables: Record<string, any> = {};
      for (const key of Object.keys(row)) {
        variables[key] = row[key];
      }
      variables.phone = phone;
      variables._batchId = batch.batchId;
      variables._batchName = fileName;
      variables._batchTotal = batch.total;

      try {
        await flowEngine.startFlow(flow.id, phone, variables);

        batch.succeeded++;
        consecutiveErrors = 0;
      } catch (err: any) {
        batch.failed++;
        consecutiveErrors++;
        batch.errors.push({ row: i + 1, phone, error: err.message || 'Erro desconhecido' });
        console.error(`[FlowBatch]${tag} ❌ [${i + 1}/${rows.length}] Erro para ${phone}:`, err.message);

        // 🛡️ AUTO-PAUSE por worker: muitos erros seguidos neste número
        if (consecutiveErrors >= FlowBatchController.BATCH_CONSECUTIVE_ERROR_LIMIT) {
          const pauseFactor = Math.min(pauseCount + 1, 5);
          const pauseMs = Math.min(
            FlowBatchController.BATCH_PAUSE_BASE_MS * Math.pow(2, pauseFactor - 1),
            FlowBatchController.BATCH_PAUSE_MAX_MS
          );
          pauseCount++;

          console.warn(`[FlowBatch]${tag} ⏸️ ${consecutiveErrors} erros consecutivos. Pausando ${(pauseMs / 1000).toFixed(0)}s (pausa #${pauseCount})`);
          await new Promise(resolve => setTimeout(resolve, pauseMs));

          if ((batch.status as string) === 'CANCELLED') break;

          consecutiveErrors = 0;
          console.log(`[FlowBatch]${tag} ▶️ Retomando após pausa #${pauseCount}...`);
        }
      }

      batch.processed++;

      // ⏳ Delay anti-spam INDEPENDENTE por worker (é isso que garante o paralelismo real)
      if (i < rows.length - 1 && (batch.status as string) !== 'CANCELLED') {
        const delayMs = Math.floor(Math.random() * (FlowBatchController.BATCH_ANTI_SPAM_MAX_MS - FlowBatchController.BATCH_ANTI_SPAM_MIN_MS))
          + FlowBatchController.BATCH_ANTI_SPAM_MIN_MS;
        console.log(`[FlowBatch]${tag} ⏳ Aguardando ${(delayMs / 1000).toFixed(1)}s antes do próximo contato (${i + 2}/${rows.length})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
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
