import React, { useState } from 'react';
import { X, Play, Clock, CheckCircle2, XCircle, AlertCircle, Phone, Database, StopCircle, Loader2, ExternalLink, ChevronDown, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'sonner';
import { formatPhoneNumber } from '@/lib/utils';

type Execution = {
  id: string;
  contactPhone: string;
  status: string;
  variables: any;
  history: string[];
  startedAt: string;
  completedAt?: string;
  error?: string;
  replacedByExecutionId?: string;
  replacedByFlowId?: string;
};

type ExecutionDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  executions: Execution[];
  onSelectExecution: (execution: Execution | null) => void;
  selectedExecutionId?: string;
  flowId: string;
  onExecutionCancelled: (executionId: string) => void;
};

const ACTIVE_STATUSES = ['RUNNING', 'WAITING_REPLY', 'DELAYED'];

const BATCH_PAGE_SIZE = 5;

export function ExecutionDrawer({
  isOpen,
  onClose,
  executions,
  onSelectExecution,
  selectedExecutionId,
  flowId,
  onExecutionCancelled,
}: ExecutionDrawerProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});
  const [batchVisibleCount, setBatchVisibleCount] = useState<Record<string, number>>({});
  const router = useRouter();

  if (!isOpen) return null;

  const toggleBatch = (batchId: string) => {
    setExpandedBatches((prev) => ({ ...prev, [batchId]: !prev[batchId] }));
  };

  const showMoreInBatch = (batchId: string) => {
    setBatchVisibleCount((prev) => ({
      ...prev,
      [batchId]: (prev[batchId] || BATCH_PAGE_SIZE) + BATCH_PAGE_SIZE,
    }));
  };

  // Agrupamento
  const batches: Record<string, { id: string; name: string; total: number; startedAt: string; executions: Execution[] }> = {};
  const standaloneExecutions: Execution[] = [];

  executions.forEach((exe) => {
    const vars = exe.variables || {};
    if (vars._batchId) {
      if (!batches[vars._batchId]) {
        batches[vars._batchId] = {
          id: vars._batchId,
          name: vars._batchName || 'Disparo em Massa',
          total: vars._batchTotal || 0,
          startedAt: exe.startedAt,
          executions: [],
        };
      }
      batches[vars._batchId].executions.push(exe);
    } else {
      standaloneExecutions.push(exe);
    }
  });

  const hasBatches = Object.keys(batches).length > 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle2 className="text-green-500" size={16} />;
      case 'FAILED': return <XCircle className="text-red-500" size={16} />;
      case 'PAUSED': return <StopCircle className="text-orange-500" size={16} />;
      case 'FORCE_CANCELLED': return <StopCircle className="text-red-600" size={16} />;
      case 'RUNNING': return <Play className="text-blue-500 animate-pulse" size={16} />;
      case 'WAITING_REPLY': return <Clock className="text-purple-500" size={16} />;
      default: return <AlertCircle className="text-gray-400" size={16} />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'Concluído';
      case 'FAILED': return 'Falhou';
      case 'PAUSED': return 'Cancelado';
      case 'FORCE_CANCELLED': return 'Canc. Forçado';
      case 'RUNNING': return 'Rodando';
      case 'WAITING_REPLY': return 'Aguardando';
      case 'DELAYED': return 'Atrasado';
      default: return status;
    }
  };

  const handleCancel = async (e: React.MouseEvent, executionId: string) => {
    e.stopPropagation();
    if (cancellingId) return;
    setCancellingId(executionId);
    try {
      await api.delete(`/flows/${flowId}/executions/${executionId}`);
      onExecutionCancelled(executionId);
      toast.success('Execução cancelada.');
      if (selectedExecutionId === executionId) onSelectExecution(null);
    } catch {
      toast.error('Não foi possível cancelar a execução.');
    } finally {
      setCancellingId(null);
    }
  };

  const renderExecutionCard = (exe: Execution) => (
    <div
      key={exe.id}
      onClick={() => onSelectExecution(selectedExecutionId === exe.id ? null : exe)}
      className={`p-4 border rounded-lg cursor-pointer transition-all group ${selectedExecutionId === exe.id
        ? 'border-green-500 bg-green-50 ring-1 ring-green-500'
        : 'hover:border-primary/50 hover:bg-gray-50 bg-white'
        }`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2 font-semibold text-sm text-gray-900">
          <Phone size={14} className="text-gray-400" />
          {formatPhoneNumber(exe.contactPhone)}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white border">
          {getStatusIcon(exe.status)}
          {getStatusLabel(exe.status)}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Clock size={12} />
            {format(new Date(exe.startedAt), "dd/MM HH:mm", { locale: ptBR })}
          </div>
          {exe.history && (
            <span className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 text-[10px]">
              {exe.history.length > 0 ? `${exe.history.length} etapas` : 'Iniciando'}
            </span>
          )}
        </div>

        {ACTIVE_STATUSES.includes(exe.status) && (
          <button
            onClick={(e) => handleCancel(e, exe.id)}
            disabled={cancellingId === exe.id}
            className="flex items-center gap-1 text-[11px] font-medium text-red-500 hover:text-red-700 hover:bg-red-50 border border-red-200 hover:border-red-300 px-2 py-0.5 rounded-full transition-all disabled:opacity-50"
            title="Cancelar execução"
          >
            {cancellingId === exe.id ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <StopCircle size={11} />
            )}
            Cancelar
          </button>
        )}

        {exe.status === 'FORCE_CANCELLED' && exe.replacedByFlowId && exe.replacedByExecutionId && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/dashboard/flows/${exe.replacedByFlowId}?executionId=${exe.replacedByExecutionId}`);
            }}
            className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200 hover:border-blue-300 px-2 py-0.5 rounded-full transition-all"
            title="Ver fluxo que substituiu este"
          >
            <ExternalLink size={11} />
            Ver novo fluxo
          </button>
        )}
      </div>

      {selectedExecutionId === exe.id && (
        <div className="mt-3 pt-3 border-t border-green-200">
          <p className="text-[10px] font-bold text-green-700 uppercase mb-2">Payload / Variáveis:</p>
          <pre className="text-[10px] bg-zinc-900 text-green-400 p-2 rounded overflow-x-auto font-mono max-h-40">
            {JSON.stringify(exe.variables, null, 2)}
          </pre>
          {exe.error && (
            <div className="mt-2 p-2 bg-red-50 text-red-600 text-[10px] rounded border border-red-100">
              <strong>Erro:</strong> {exe.error}
            </div>
          )}
          <p className="mt-3 text-[10px] text-green-600 font-medium text-center">
            Visualizando caminho no mapa...
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-y-0 right-0 w-[400px] bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200 animate-in slide-in-from-right duration-300">
      <div className="p-4 border-b flex items-center justify-between bg-gray-50">
        <h2 className="font-bold text-gray-800 flex items-center gap-2">
          <Database size={18} className="text-primary" />
          Execuções Recentes
          {executions.length > 0 && (
            <span className="text-xs font-normal text-gray-500">
              ({executions.length})
            </span>
          )}
        </h2>
        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {executions.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Database size={40} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">Nenhuma execução encontrada ainda.</p>
          </div>
        ) : (
          <>
            {/* GRUPOS DE PLANILHA (BATCHES) */}
            {Object.values(batches).map((batch) => {
              const isExpanded = expandedBatches[batch.id] || false;
              const totalInBatch = batch.executions.length;
              const visibleCount = batchVisibleCount[batch.id] || BATCH_PAGE_SIZE;
              const visibleExecutions = isExpanded ? batch.executions.slice(0, visibleCount) : [];
              const hasMoreInBatch = visibleCount < totalInBatch;

              return (
                <div key={batch.id} className="border rounded-lg overflow-hidden flex flex-col mb-3 bg-white shadow-sm">
                  <div
                    onClick={() => toggleBatch(batch.id)}
                    className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors border-b border-transparent data-[expanded=true]:border-slate-200"
                    data-expanded={isExpanded}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="p-1.5 bg-blue-100 text-blue-600 rounded-md shrink-0">
                        <FileSpreadsheet size={16} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-sm text-slate-800 truncate" title={batch.name}>
                          {batch.name}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {format(new Date(batch.startedAt), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                          <span>•</span>
                          <span className="font-medium">
                            {totalInBatch} execuções
                          </span>
                        </div>
                      </div>
                    </div>
                    <div>
                      {isExpanded ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-3 bg-slate-50/50 flex flex-col gap-3 rounded-b-lg border-t border-slate-100">
                      {visibleExecutions.map(renderExecutionCard)}
                      {hasMoreInBatch && (
                        <button
                          onClick={() => showMoreInBatch(batch.id)}
                          className="w-full py-2 text-xs font-medium text-primary hover:bg-primary/5 border border-dashed border-primary/30 rounded-lg transition-colors flex items-center justify-center gap-1"
                        >
                          <ChevronDown size={12} />
                          Ver mais ({totalInBatch - visibleCount} restantes)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {hasBatches && standaloneExecutions.length > 0 && (
              <div className="my-5 flex items-center gap-3">
                <div className="h-px bg-slate-200 flex-1"></div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Execuções Avulsas</span>
                <div className="h-px bg-slate-200 flex-1"></div>
              </div>
            )}

            {standaloneExecutions.map(renderExecutionCard)}
          </>
        )}
      </div>

      <div className="p-4 bg-gray-50 border-t text-[11px] text-gray-500 leading-tight">
        Selecione uma execução para ver os dados enviados e destacar o caminho que o robô percorreu no fluxo.
      </div>
    </div>
  );
}
