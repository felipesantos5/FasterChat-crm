import { memo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Trash2, HelpCircle, Clock, MessageSquare, Key } from 'lucide-react';

export const ConditionNode = memo(({ id, data }: any) => {
  const { deleteElements, updateNodeData } = useReactFlow();

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { waitValue: Number(e.target.value) });
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateNodeData(id, { waitUnit: e.target.value });
  };

  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { keyword: e.target.value });
  };

  const waitValue = data?.waitValue || data?.waitHours || 24;
  const waitUnit = data?.waitUnit || (data?.waitHours ? 'hours' : 'hours');
  const keyword = data?.keyword || '';

  return (
    <div className="bg-white border-2 border-purple-400 rounded-xl shadow-lg min-w-[300px] overflow-hidden transition-all hover:shadow-purple-100 hover:border-purple-500/50">
      <Handle type="target" position={Position.Left} className="w-8 h-8 bg-purple-500 border-2 border-white" />

      <div className="bg-purple-50 px-3 py-3 border-b border-purple-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="bg-purple-500 p-1.5 rounded-lg shadow-sm">
            <HelpCircle size={16} className="text-white" />
          </div>
          <span className="text-sm font-bold text-purple-900 tracking-tight">Verificar Resposta</span>
        </div>
        <button
          onClick={() => { if (confirm('Excluir este bloco?')) deleteElements({ nodes: [{ id }] }) }}
          className="text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-700 transition-colors nodrag p-1 rounded-md"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="p-4 bg-white space-y-4">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-purple-600 uppercase tracking-widest ml-1">
            Tempo Limite de Espera
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              className="flex-1 min-w-0 p-2 bg-purple-50/30 border border-purple-100 rounded-lg text-sm text-center font-bold text-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 nodrag transition-all"
              value={waitValue}
              onChange={handleValueChange}
            />
            <select
              className="flex-[1.5] p-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 nodrag cursor-pointer transition-all hover:bg-gray-100"
              value={waitUnit}
              onChange={handleUnitChange}
            >
              <option value="seconds">Segundos</option>
              <option value="minutes">Minutos</option>
              <option value="hours">Horas</option>
              <option value="days">Dias</option>
            </select>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
            Caminhos de Saída
          </label>

          <div className="flex items-center justify-between bg-blue-50/40 p-2.5 rounded-lg border border-blue-100 relative group hover:bg-blue-50 transition-colors">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-blue-500" />
              <span className="text-[11px] font-bold text-blue-700 uppercase">Respondeu (Qualquer)</span>
            </div>
            <Handle type="source" position={Position.Right} id="respondeu" className="w-8 h-8 bg-blue-500 border-2 border-white -mr-1" />
          </div>

          <div className="flex flex-col gap-2 bg-green-50/40 p-2.5 rounded-lg border border-green-100 relative group hover:bg-green-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key size={14} className="text-green-500" />
                <span className="text-[11px] font-bold text-green-700 uppercase">Respondeu Palavra-chave</span>
              </div>
              <Handle type="source" position={Position.Right} id="palavra_chave" className="w-8 h-8 bg-green-500 border-2 border-white -mr-1" />
            </div>
            <input
              type="text"
              placeholder="Ex: sim, quero, comprar"
              value={keyword}
              onChange={handleKeywordChange}
              className="w-full mt-1 p-2 bg-white border border-green-200 rounded-md text-xs font-medium text-green-900 focus:outline-none focus:ring-2 focus:ring-green-500/20 nodrag"
            />
          </div>

          <div className="flex items-center justify-between bg-gray-50/40 p-2.5 rounded-lg border border-gray-100 relative group hover:bg-gray-100 transition-colors">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-gray-400" />
              <span className="text-[11px] font-bold text-gray-500 uppercase">Se não responder</span>
            </div>
            <Handle type="source" position={Position.Right} id="nao_respondeu" className="w-8 h-8 bg-gray-400 border-2 border-white -mr-1" />
          </div>
        </div>
      </div>
    </div>
  );
});

ConditionNode.displayName = 'ConditionNode';
