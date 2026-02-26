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
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ row: number; phone: string; error: string }>;
  startedAt: Date;
  completedAt: Date | null;
}

// Store em memória para rastrear progresso dos batches
const batchStore = new Map<string, BatchStatus>();

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
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
    } catch (err: any) {
      return res.status(400).json({ error: `Erro ao ler planilha: ${err.message}` });
    }

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'A planilha está vazia.' });
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
      status: 'PROCESSING',
      total: validRows.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
      startedAt: new Date(),
      completedAt: null,
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
    this.processRows(batchStatus, validRows, phoneColumn, flow).catch(err => {
      console.error(`[FlowBatch] ❌ Erro fatal no batch ${batchId}:`, err);
      batchStatus.status = 'FAILED';
      batchStatus.completedAt = new Date();
    });

    return res as any;
  }

  /**
   * Processa as linhas sequencialmente com delay entre cada uma
   */
  private async processRows(
    batch: BatchStatus,
    rows: Record<string, any>[],
    phoneColumn: string,
    flow: any
  ) {
    const flowEngine = new FlowEngineService();

    console.log(`[FlowBatch] 🚀 Iniciando batch ${batch.batchId}: ${rows.length} contatos para fluxo "${flow.name}"`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const phone = String(row[phoneColumn] || '').replace(/\D/g, '');

      // Monta as variáveis a partir de todas as colunas (exceto a de telefone)
      const variables: Record<string, any> = {};
      for (const key of Object.keys(row)) {
        variables[key] = row[key];
      }
      // Garante que phone está presente nas variáveis
      variables.phone = phone;

      try {
        console.log(`[FlowBatch] 📤 [${i + 1}/${rows.length}] Disparando para ${phone}...`);
        
        await flowEngine.startFlow(flow.id, phone, variables);
        
        batch.succeeded++;
        console.log(`[FlowBatch] ✅ [${i + 1}/${rows.length}] Fluxo disparado com sucesso para ${phone}`);
      } catch (err: any) {
        batch.failed++;
        batch.errors.push({
          row: i + 1,
          phone,
          error: err.message || 'Erro desconhecido',
        });
        console.error(`[FlowBatch] ❌ [${i + 1}/${rows.length}] Erro ao disparar para ${phone}:`, err.message);
      }

      batch.processed++;

      // Delay aleatório de 5-15 segundos entre cada disparo (equilíbrio entre velocidade e segurança)
      if (i < rows.length - 1) {
        const delayMs = Math.floor(Math.random() * 10000) + 5000; // 5000-15000ms
        console.log(`[FlowBatch] ⏳ Aguardando ${(delayMs / 1000).toFixed(1)}s antes do próximo disparo...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    batch.status = 'COMPLETED';
    batch.completedAt = new Date();

    console.log(`[FlowBatch] 🏁 Batch ${batch.batchId} finalizado: ${batch.succeeded} OK, ${batch.failed} falhas de ${batch.total} total`);

    // Remove o batch da memória após 1 hora
    setTimeout(() => {
      batchStore.delete(batch.batchId);
    }, 60 * 60 * 1000);
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
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
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

          console.log(`[FlowBatch] 📋 Variáveis da planilha salvas para o fluxo ${flowId}:`, variableColumns);
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
