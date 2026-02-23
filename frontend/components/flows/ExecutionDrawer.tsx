import React from 'react';
import { X, Play, Clock, CheckCircle2, XCircle, AlertCircle, Phone, Database } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Execution = {
  id: string;
  contactPhone: string;
  status: string;
  variables: any;
  history: string[];
  startedAt: string;
  completedAt?: string;
  error?: string;
};

type ExecutionDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  executions: Execution[];
  onSelectExecution: (execution: Execution | null) => void;
  selectedExecutionId?: string;
};

export function ExecutionDrawer({ isOpen, onClose, executions, onSelectExecution, selectedExecutionId }: ExecutionDrawerProps) {
  if (!isOpen) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle2 className="text-green-500" size={16} />;
      case 'FAILED': return <XCircle className="text-red-500" size={16} />;
      case 'RUNNING': return <Play className="text-blue-500 animate-pulse" size={16} />;
      case 'WAITING_REPLY': return <Clock className="text-purple-500" size={16} />;
      default: return <AlertCircle className="text-gray-400" size={16} />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'Concluído';
      case 'FAILED': return 'Falhou';
      case 'RUNNING': return 'Rodando';
      case 'WAITING_REPLY': return 'Aguardando';
      case 'DELAYED': return 'Atrasado';
      default: return status;
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[400px] bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200 animate-in slide-in-from-right duration-300">
      <div className="p-4 border-b flex items-center justify-between bg-gray-50">
        <h2 className="font-bold text-gray-800 flex items-center gap-2">
          <Database size={18} className="text-primary" />
          Execuções Recentes
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
          executions.map((exe) => (
            <div
              key={exe.id}
              onClick={() => onSelectExecution(selectedExecutionId === exe.id ? null : exe)}
              className={`p-4 border rounded-lg cursor-pointer transition-all group ${selectedExecutionId === exe.id
                  ? 'border-green-500 bg-green-50 ring-1 ring-green-500'
                  : 'hover:border-primary/50 hover:bg-gray-50'
                }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 font-semibold text-sm text-gray-900">
                  <Phone size={14} className="text-gray-400" />
                  {exe.contactPhone}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white border">
                  {getStatusIcon(exe.status)}
                  {getStatusLabel(exe.status)}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
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
          ))
        )}
      </div>

      <div className="p-4 bg-gray-50 border-t text-[11px] text-gray-500 leading-tight">
        Selecione uma execução para ver os dados enviados e destacar o caminho que o robô percorreu no fluxo.
      </div>
    </div>
  );
}
