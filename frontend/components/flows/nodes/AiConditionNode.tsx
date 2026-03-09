import { memo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Trash2, BrainCircuit, Clock, ThumbsUp, ThumbsDown, PackageCheck, HelpCircle } from 'lucide-react';

export const AiConditionNode = memo(({ id, data }: any) => {
  const { deleteElements, updateNodeData } = useReactFlow();

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { waitValue: e.target.value });
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateNodeData(id, { waitUnit: e.target.value });
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNodeData(id, { aiPrompt: e.target.value });
  };

  const waitValue = data?.waitValue ?? data?.waitHours ?? '';
  const waitUnit = data?.waitUnit ?? 'hours';
  const aiPrompt = data?.aiPrompt || 'O cliente quer saber mais sobre nossos serviços e está interessado.';

  return (
    <div className="bg-white border-2 border-indigo-400 rounded-xl shadow-lg min-w-[320px] max-w-[380px] overflow-hidden transition-all hover:shadow-indigo-100 hover:border-indigo-500/50">
      <Handle type="target" position={Position.Left} className="w-8 h-8 bg-indigo-500 border-2 border-white" />

      <div className="bg-indigo-50 px-3 py-3 border-b border-indigo-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-500 p-1.5 rounded-lg shadow-sm">
            <BrainCircuit size={16} className="text-white" />
          </div>
          <span className="text-sm font-bold text-indigo-900 tracking-tight">Validação IA</span>
        </div>
        <button
          onClick={() => { if (confirm('Excluir este bloco?')) deleteElements({ nodes: [{ id }] }) }}
          className="text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-700 transition-colors nodrag p-1 rounded-md"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="p-4 bg-white space-y-4">
        {/* Timeout Configuration */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest ml-1">
            Tempo Limite de Espera
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              className="flex-1 min-w-0 p-2 bg-indigo-50/30 border border-indigo-100 rounded-lg text-sm text-center font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 nodrag transition-all"
              value={waitValue}
              onChange={handleValueChange}
            />
            <select
              className="flex-[1.5] p-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 nodrag cursor-pointer transition-all hover:bg-gray-100"
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

        {/* AI Prompt Input */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest ml-1">
            Instrução da IA (O que ela deve buscar?)
          </label>
          <textarea
            placeholder="Ex: Identifique se o cliente quer comprar ou se tem revenda..."
            value={aiPrompt}
            onChange={handlePromptChange}
            rows={3}
            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 nodrag transition-all placeholder:text-gray-300 resize-none"
          />
        </div>

        {/* Handles */}
        <div className="space-y-3 pt-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
            Caminhos de Saída IA
          </label>

          <div className="flex items-center justify-between bg-green-50/40 p-2.5 rounded-lg border border-green-100 relative group hover:bg-green-50 transition-colors">
            <div className="flex items-center gap-2">
              <ThumbsUp size={14} className="text-green-600" />
              <span className="text-[11px] font-bold text-green-700 uppercase">Interessado</span>
            </div>
            <Handle type="source" position={Position.Right} id="interested" className="w-8 h-8 bg-green-500 border-2 border-white -mr-1" />
          </div>

          <div className="flex items-center justify-between bg-red-50/40 p-2.5 rounded-lg border border-red-100 relative group hover:bg-red-50 transition-colors">
            <div className="flex items-center gap-2">
              <ThumbsDown size={14} className="text-red-500" />
              <span className="text-[11px] font-bold text-red-700 uppercase">Não Interessado</span>
            </div>
            <Handle type="source" position={Position.Right} id="not_interested" className="w-8 h-8 bg-red-500 border-2 border-white -mr-1" />
          </div>

          <div className="flex items-center justify-between bg-blue-50/40 p-2.5 rounded-lg border border-blue-100 relative group hover:bg-blue-50 transition-colors">
            <div className="flex items-center gap-2">
              <PackageCheck size={14} className="text-blue-500" />
              <span className="text-[11px] font-bold text-blue-700 uppercase">Já Possui</span>
            </div>
            <Handle type="source" position={Position.Right} id="already_has" className="w-8 h-8 bg-blue-500 border-2 border-white -mr-1" />
          </div>

          <div className="flex items-center justify-between bg-amber-50/40 p-2.5 rounded-lg border border-amber-100 relative group hover:bg-amber-50 transition-colors">
            <div className="flex items-center gap-2">
              <HelpCircle size={14} className="text-amber-500" />
              <span className="text-[11px] font-bold text-amber-700 uppercase">Outros / Indeciso</span>
            </div>
            <Handle type="source" position={Position.Right} id="other" className="w-8 h-8 bg-amber-500 border-2 border-white -mr-1" />
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

AiConditionNode.displayName = 'AiConditionNode';
