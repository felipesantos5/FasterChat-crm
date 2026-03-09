import { memo, useState, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Copy, FileSpreadsheet, Loader2, CheckCircle2, RotateCcw, FlaskConical, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useBatchStore } from '../batchStore';

export const TriggerNode = memo(({ data }: any) => {
  const [loadingCsv, setLoadingCsv] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testLoading, setTestLoading] = useState(false);

  const handleTestDisparo = async () => {
    if (!flowId || !testPhone.trim()) return;
    setTestLoading(true);
    try {
      await api.post(`/flows/${flowId}/execute`, { phone: testPhone.trim() });
      toast.success('Fluxo disparado!', { description: `Enviando para ${testPhone.trim()}` });
      setTestPhone('');
      setTestOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao disparar fluxo.');
    } finally {
      setTestLoading(false);
    }
  };

  const flowId = data?.flowId;

  const preview = useBatchStore((s) => s.preview);
  const storeFlowId = useBatchStore((s) => s.flowId);
  const setFile = useBatchStore((s) => s.setFile);
  const setPreview = useBatchStore((s) => s.setPreview);
  const setFlowId = useBatchStore((s) => s.setFlowId);
  const resetBatch = useBatchStore((s) => s.reset);

  const csvLoaded = !!preview && storeFlowId === flowId;
  const totalRows = preview?.totalRows || 0;
  const variableColumns = preview?.variableColumns || [];

  const getFullUrl = (path: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3051";
    return `${baseUrl}${path}`;
  };

  const currentPath = data?.description || '/api/webhooks/flow/meu-fluxo';
  const fullUrl = getFullUrl(currentPath);

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl);
    toast.success('Link do webhook copiado!');
  };

  const handleImportCsv = async (file: File) => {
    if (!flowId) return;
    setLoadingCsv(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post(`/flows/${flowId}/batch/preview`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setPreview(res.data);
      setFile(file);
      setFlowId(flowId);
      toast.success(`${res.data.totalRows} contatos carregados!`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao ler planilha.');
    } finally {
      setLoadingCsv(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };



  return (
    <div className="bg-white border-2 border-primary rounded-xl shadow-lg min-w-[300px] max-w-[440px] overflow-hidden">
      <div className="bg-primary/10 px-3 py-2.5 border-b border-primary/20 flex items-center justify-between">
        <span className="text-sm font-bold text-primary">⚡ Gatilho</span>
        <button
          onClick={() => { setTestOpen((o) => !o); setTestPhone(''); }}
          className="nodrag flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300 transition-colors"
          title="Disparar para número de teste"
        >
          <FlaskConical size={11} />
          Teste
        </button>
      </div>

      {/* Painel de disparo de teste */}
      {testOpen && (
        <div className="px-3 pt-2.5 pb-2 bg-amber-50 border-b border-amber-200 flex flex-col gap-2">
          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Disparo rápido de teste</p>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTestDisparo()}
              placeholder="5511999998888"
              className="nodrag flex-1 text-xs border border-amber-300 rounded-md px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder:text-gray-400"
            />
            <button
              onClick={handleTestDisparo}
              disabled={testLoading || !testPhone.trim()}
              className="nodrag flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-md transition-colors disabled:opacity-50"
              title="Disparar"
            >
              {testLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            </button>
            <button
              onClick={() => { setTestOpen(false); setTestPhone(''); }}
              className="nodrag p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-100 rounded-md transition-colors"
              title="Fechar"
            >
              <X size={12} />
            </button>
          </div>
          <p className="text-[9px] text-amber-600 leading-snug">
            DDI + DDD + número, sem espaços (ex: 5511999998888)
          </p>
        </div>
      )}

      <div className="p-3 flex flex-col gap-3">
        {/* Webhook Section */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-0.5">Via Webhook</p>
          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-lg text-xs hover:bg-black transition-colors cursor-pointer nodrag font-semibold"
          >
            <Copy size={14} />
            Copiar link do webhook
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-[10px] font-bold text-gray-300 uppercase">ou</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* CSV Section */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-0.5">Via Planilha</p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportCsv(f);
            }}
          />

          {!csvLoaded ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loadingCsv}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-violet-600 text-white rounded-lg text-xs hover:bg-violet-700 transition-colors cursor-pointer nodrag font-semibold disabled:opacity-60"
            >
              {loadingCsv ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Lendo planilha...
                </>
              ) : (
                <>
                  <FileSpreadsheet size={14} />
                  Importar planilha (CSV/XLSX)
                </>
              )}
            </button>
          ) : (
            <div className="space-y-2">
              {/* Loaded state */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-green-600" />
                    <span className="text-[11px] font-bold text-green-700">
                      {totalRows} contatos · {variableColumns.length} variáveis
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      resetBatch();
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-green-500 hover:text-green-700 transition-colors nodrag p-0.5"
                    title="Trocar planilha"
                  >
                    <RotateCcw size={12} />
                  </button>
                </div>

                {variableColumns.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {variableColumns.slice(0, 5).map((col) => (
                      <span
                        key={col}
                        className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-violet-100 text-violet-700"
                      >
                        {`{{${col}}}`}
                      </span>
                    ))}
                    {variableColumns.length > 5 && (
                      <span className="text-[9px] text-gray-400 px-1 py-0.5">
                        +{variableColumns.length - 5}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Helper text */}
        <p className="text-[10px] text-center text-gray-400 leading-relaxed">
          {csvLoaded
            ? 'Planilha cadastrada. Clique em "Disparar em Massa" no topo para enviar ou alterar o arquivo.'
            : 'Envie um POST no webhook ou importe uma planilha para iniciar o fluxo.'}
        </p>
      </div>

      <Handle type="source" position={Position.Right} id="a" className="w-8 h-8 bg-primary" />
    </div>
  );
});

TriggerNode.displayName = 'TriggerNode';
