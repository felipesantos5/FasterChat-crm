import { memo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Trash2, Bot } from 'lucide-react';

export const AiActionNode = memo(({ id, data }: any) => {
  const { deleteElements, updateNodeData } = useReactFlow();

  const handleActionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateNodeData(id, { aiAction: e.target.value });
  };

  const action = data?.aiAction || 'enable';

  return (
    <div className="bg-white border-2 border-emerald-400 rounded-xl shadow-lg min-w-[240px] overflow-hidden transition-all hover:shadow-emerald-100 hover:border-emerald-500">
      <Handle type="target" position={Position.Left} className="w-8 h-8 bg-emerald-500 border-2 border-white" />

      <div className="bg-emerald-50 px-3 py-3 border-b border-emerald-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500 p-1.5 rounded-lg">
            <Bot size={16} className="text-white" />
          </div>
          <span className="text-sm font-bold text-emerald-900 tracking-tight">Status da IA</span>
        </div>
        <button
          onClick={() => { if (confirm('Excluir este bloco?')) deleteElements({ nodes: [{ id }] }) }}
          className="text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-700 transition-colors nodrag p-1 rounded-md"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="p-4 bg-white">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest ml-1">
            Ação da Inteligência
          </label>
          <select
            className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 nodrag cursor-pointer transition-all"
            value={action}
            onChange={handleActionChange}
          >
            <option value="enable">Ligar IA 🟢</option>
            <option value="disable">Desligar IA 🔴</option>
          </select>
          <p className="text-[10px] text-gray-400 text-center mt-1 italic">
            Irá alterar o estado do bot para este cliente.
          </p>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="w-8 h-8 bg-emerald-500 border-2 border-white" />
    </div>
  );
});

AiActionNode.displayName = 'AiActionNode';
