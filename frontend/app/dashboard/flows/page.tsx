'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  Plus,
  MessageSquare,
  Zap,
  Trash2,
  ChevronRight,
  Play,
  Clock,
  Settings,
  Upload,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FlowConfigModal } from '@/components/flows/flow-config-modal';
import { FlowBatchUploadModal } from '@/components/flows/flow-batch-upload-modal';

interface Flow {
  id: string;
  name: string;
  triggerType: string;
  status: string;
  autoTags?: string[];
  createdAt: string;
  _count?: {
    executions: number;
  };
}

export default function FlowsPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);

  // For Config Modal
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);

  // For Batch Upload Modal
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchFlow, setBatchFlow] = useState<Flow | null>(null);

  const fetchFlows = async () => {
    try {
      const res = await api.get('/flows');
      setFlows(res.data);
    } catch (error) {
      console.error('Error fetching flows', error);
      toast.error('Erro ao carregar fluxos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlows();
  }, []);

  const deleteFlow = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm('Tem certeza que deseja excluir este fluxo?')) return;

    try {
      await api.delete(`/flows/${id}`);
      setFlows(flows.filter(f => f.id !== id));
      toast.success('Fluxo excluído com sucesso');
    } catch (error) {
      toast.error('Erro ao excluir fluxo');
    }
  };

  const openConfigModal = (flow: Flow, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedFlow(flow);
    setConfigModalOpen(true);
  };

  const handleSaveConfig = (tags: string[], status: string) => {
    if (!selectedFlow) return;
    setFlows(flows.map(f => f.id === selectedFlow.id ? { ...f, autoTags: tags, status: status } : f));
  };

  const openBatchModal = (flow: Flow, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBatchFlow(flow);
    setBatchModalOpen(true);
  };

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8 bg-gray-50/30 min-h-screen font-sans">
      <div className="flex items-center justify-between">
        <div />
        <Link
          href="/dashboard/flows/new"
          className="inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-primary bg-primary text-white hover:bg-primary/90 h-11 px-5 shadow-sm gap-2"
        >
          <Plus size={18} />
          Novo Fluxo
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="text-sm font-medium">Carregando seus fluxos...</span>
        </div>
      ) : flows.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {flows.map((flow) => (
            <Link
              key={flow.id}
              href={`/dashboard/flows/${flow.id}`}
              className="group bg-white border border-gray-200 rounded-xl p-5 hover:border-primary/50 hover:shadow-md transition-all relative overflow-hidden flex flex-col h-full"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="bg-primary/10 p-2.5 rounded-lg text-primary">
                  <Zap size={22} fill="currentColor" className="opacity-80" />
                </div>
                <div className="flex gap-2">
                  <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full ${flow.status === 'ACTIVE'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                    }`}>
                    {flow.status === 'ACTIVE' ? 'Ativo' : 'Rascunho'}
                  </span>
                  <button
                    onClick={(e) => openBatchModal(flow, e)}
                    className="text-gray-400 hover:text-blue-500 transition-colors p-1"
                    title="Disparo em Massa"
                  >
                    <Upload size={16} />
                  </button>
                  <button
                    onClick={(e) => openConfigModal(flow, e)}
                    className="text-gray-400 hover:text-primary transition-colors p-1"
                    title="Configurar Fluxo"
                  >
                    <Settings size={16} />
                  </button>
                  <button
                    onClick={(e) => deleteFlow(flow.id, e)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    title="Excluir Fluxo"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-800 group-hover:text-primary transition-colors">
                  {flow.name}
                </h3>
                <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                  <div className="flex items-center gap-1.5" title="Execuções Totais">
                    <Play size={14} className="text-gray-400" />
                    <span>{flow._count?.executions || 0} execuções</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className="text-gray-400" />
                    <span>{format(new Date(flow.createdAt), "dd/MM/yy", { locale: ptBR })}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-gray-50 flex items-center justify-between text-xs font-semibold text-gray-400">
                <span className="flex items-center gap-1 uppercase tracking-tighter">
                  <MessageSquare size={12} />
                  Trigger: {flow.triggerType}
                </span>
                <span className="text-primary flex items-center group-hover:translate-x-1 transition-transform">
                  Editar <ChevronRight size={14} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-6 border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center bg-white shadow-sm flex flex-col items-center">
          <div className="bg-gray-50 p-4 rounded-full mb-4">
            <Zap size={40} className="text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-gray-800">Crie seu primeiro fluxo</h3>
          <p className="text-gray-500 mt-2 max-w-xs mx-auto">
            Automatize suas vendas e atendimento pelo WhatsApp de forma visual e poderosa.
          </p>
          <Link
            href="/dashboard/flows/new"
            className="mt-8 inline-flex items-center justify-center rounded-lg text-sm font-bold transition-all bg-primary text-white hover:bg-primary/90 h-11 px-8 shadow-lg shadow-primary/20"
          >
            Começar Agora
          </Link>
        </div>
      )}

      {selectedFlow && (
        <FlowConfigModal
          open={configModalOpen}
          onClose={() => setConfigModalOpen(false)}
          flowId={selectedFlow.id}
          initialTags={selectedFlow.autoTags || []}
          initialStatus={selectedFlow.status}
          onSave={handleSaveConfig}
        />
      )}

      {batchFlow && (
        <FlowBatchUploadModal
          open={batchModalOpen}
          onClose={() => setBatchModalOpen(false)}
          flowId={batchFlow.id}
          flowName={batchFlow.name}
        />
      )}
    </div>
  );
}
