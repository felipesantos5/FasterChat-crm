import { useState, useRef } from 'react';
import { FileSpreadsheet, Upload, Loader2, CheckCircle2, Rocket } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

type NodeSidebarProps = {
  handleAddNode: (type: string, name: string) => void;
  flowId: string;
  onOpenBatchModal: () => void;
};

export function NodeSidebar({ handleAddNode, flowId, onOpenBatchModal }: NodeSidebarProps) {
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [csvLoaded, setCsvLoaded] = useState(false);
  const [variableColumns, setVariableColumns] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addNode = (type: string, name: string) => {
    handleAddNode(type, name);
  };

  const handleImportCsv = async (file: File) => {
    setLoadingCsv(true);
    setCsvLoaded(false);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post(`/flows/${flowId}/batch/preview`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const vars = res.data.variableColumns || [];
      setVariableColumns(vars);
      setCsvLoaded(true);
      toast.success(`${vars.length} variáveis carregadas da planilha!`);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao ler planilha.';
      toast.error(msg);
    } finally {
      setLoadingCsv(false);
      // Reset input para permitir re-upload do mesmo arquivo
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-4 flex flex-col gap-4 h-full">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider mb-3">Adicionar Ação</h3>
        <div className="grid grid-cols-1 gap-2">


          <button
            onClick={() => addNode('message', 'Enviar Mensagem')}
            className="flex items-center gap-3 p-3 bg-white border rounded-md shadow-sm hover:border-primary hover:shadow-md transition-all text-left"
          >
            <div className="bg-blue-100 p-2 rounded-md text-blue-600">💬</div>
            <div>
              <p className="font-medium text-sm text-gray-900">Mensagem</p>
              <p className="text-xs text-gray-500">Enviar texto de WhatsApp</p>
            </div>
          </button>

          <button
            onClick={() => addNode('delay', 'Aguardar Tempo')}
            className="flex items-center gap-3 p-3 bg-white border rounded-md shadow-sm hover:border-primary hover:shadow-md transition-all text-left"
          >
            <div className="bg-orange-100 p-2 rounded-md text-orange-600">⏳</div>
            <div>
              <p className="font-medium text-sm text-gray-900">Atraso</p>
              <p className="text-xs text-gray-500">Pausar fluxo</p>
            </div>
          </button>

          <button
            onClick={() => addNode('condition', 'Verificar Resposta')}
            className="flex items-center gap-3 p-3 bg-white border rounded-md shadow-sm hover:border-primary hover:shadow-md transition-all text-left"
          >
            <div className="bg-purple-100 p-2 rounded-md text-purple-600">🔀</div>
            <div>
              <p className="font-medium text-sm text-gray-900">Condição</p>
              <p className="text-xs text-gray-500">Respondeu / Não Respondeu</p>
            </div>
          </button>

          <button
            onClick={() => addNode('audio', 'Enviar Áudio')}
            className="flex items-center gap-3 p-3 bg-white border rounded-md shadow-sm hover:border-primary hover:shadow-md transition-all text-left"
          >
            <div className="bg-green-100 p-2 rounded-md text-green-600">🎙️</div>
            <div>
              <p className="font-medium text-sm text-gray-900">Áudio</p>
              <p className="text-xs text-gray-500">Enviar voz/música</p>
            </div>
          </button>

          <button
            onClick={() => addNode('image', 'Enviar Imagem')}
            className="flex items-center gap-3 p-3 bg-white border rounded-md shadow-sm hover:border-pink-400 hover:shadow-md transition-all text-left group"
          >
            <div className="bg-pink-100 p-2 rounded-md text-pink-600 group-hover:bg-pink-500 group-hover:text-white transition-colors">🖼️</div>
            <div>
              <p className="font-medium text-sm text-gray-900 font-sans">Imagem</p>
              <p className="text-xs text-gray-500">Enviar foto ou arte</p>
            </div>
          </button>

          <button
            onClick={() => addNode('video', 'Enviar Vídeo')}
            className="flex items-center gap-3 p-3 bg-white border rounded-md shadow-sm hover:border-indigo-400 hover:shadow-md transition-all text-left group"
          >
            <div className="bg-indigo-100 p-2 rounded-md text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white transition-colors">🎥</div>
            <div>
              <p className="font-medium text-sm text-gray-900 font-sans">Vídeo</p>
              <p className="text-xs text-gray-500">Enviar MP4/Vídeo</p>
            </div>
          </button>

          <button
            onClick={() => addNode('ai_action', 'Ação da IA')}
            className="flex items-center gap-3 p-3 bg-white border rounded-md shadow-sm hover:border-emerald-400 hover:shadow-md transition-all text-left group"
          >
            <div className="bg-emerald-100 p-2 rounded-md text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors">🤖</div>
            <div>
              <p className="font-medium text-sm text-gray-900 font-sans">Status da IA</p>
              <p className="text-xs text-gray-500">Ligar ou Desligar IA</p>
            </div>
          </button>

          <button
            onClick={() => addNode('validation', 'Validação')}
            className="flex items-center gap-3 p-3 bg-white border rounded-md shadow-sm hover:border-amber-400 hover:shadow-md transition-all text-left group"
          >
            <div className="bg-amber-100 p-2 rounded-md text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors">🛡️</div>
            <div>
              <p className="font-medium text-sm text-gray-900 font-sans">Validação</p>
              <p className="text-xs text-gray-500">Comparar variável</p>
            </div>
          </button>

        </div>
      </div>

      {/* Batch / Disparo em Massa Section */}
      <div className="mt-auto border-t pt-4">
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <FileSpreadsheet size={14} className="text-primary" />
          Disparo em Massa
        </h3>

        {/* CSV Upload para carregar variáveis */}
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

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loadingCsv}
          className={`w-full flex items-center gap-2.5 p-3 border-2 border-dashed rounded-lg transition-all text-left ${csvLoaded
            ? 'border-green-300 bg-green-50 hover:border-green-400'
            : 'border-gray-200 bg-white hover:border-primary/50 hover:bg-primary/5'
            }`}
        >
          {loadingCsv ? (
            <>
              <Loader2 size={18} className="animate-spin text-primary" />
              <div>
                <p className="text-xs font-semibold text-gray-700">Lendo planilha...</p>
              </div>
            </>
          ) : csvLoaded ? (
            <>
              <CheckCircle2 size={18} className="text-green-600" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-green-700">
                  {variableColumns.length} variáveis carregadas
                </p>
                <p className="text-[10px] text-green-600 truncate">
                  {variableColumns.map(v => `{{${v}}}`).join(', ')}
                </p>
              </div>
            </>
          ) : (
            <>
              <Upload size={18} className="text-gray-400" />
              <div>
                <p className="text-xs font-semibold text-gray-700">Importar Planilha</p>
                <p className="text-[10px] text-gray-400">Carrega variáveis (CSV/XLSX)</p>
              </div>
            </>
          )}
        </button>

        {/* Loaded variables pills */}
        {csvLoaded && variableColumns.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {variableColumns.slice(0, 6).map((col) => (
              <span
                key={col}
                className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700"
              >
                {`{{${col}}}`}
              </span>
            ))}
            {variableColumns.length > 6 && (
              <span className="text-[10px] text-gray-400 px-1 py-0.5">
                +{variableColumns.length - 6} mais
              </span>
            )}
          </div>
        )}

        {/* Disparar Button */}
        <button
          onClick={onOpenBatchModal}
          className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-semibold shadow-sm"
        >
          <Rocket size={16} />
          Disparar para Contatos
        </button>

        <p className="text-[10px] text-gray-400 mt-2 text-center leading-tight">
          Importe a planilha primeiro para carregar as variáveis, configure os textos e depois dispare.
        </p>
      </div>
    </div>
  );
}
