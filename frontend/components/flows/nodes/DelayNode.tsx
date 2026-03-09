import { memo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Trash2, Clock } from 'lucide-react';

export const DelayNode = memo(({ id, data }: any) => {
  const { deleteElements, updateNodeData } = useReactFlow();

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { delayValue: e.target.value });
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateNodeData(id, { delayUnit: e.target.value });
  };

  const delayValue = data?.delayValue ?? data?.minutes ?? '';
  const delayUnit = data?.delayUnit ?? 'minutes';

  return (
    <div className="bg-white border-2 border-orange-400 rounded-xl shadow-lg min-w-[220px] overflow-hidden transition-all hover:shadow-orange-100 hover:border-orange-500">
      <Handle type="target" position={Position.Left} className="w-8 h-8 bg-orange-500 border-2 border-white" />

      <div className="bg-orange-50 px-3 py-3 border-b border-orange-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="bg-orange-500 p-1.5 rounded-lg">
            <Clock size={16} className="text-white" />
          </div>
          <span className="text-sm font-bold text-orange-900 tracking-tight">Atrasar Fluxo</span>
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
          <label className="text-[10px] font-bold text-orange-600 uppercase tracking-widest ml-1">
            Tempo de Espera
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              className="flex-1 min-w-0 p-2 bg-orange-50/50 border border-orange-100 rounded-lg text-sm text-center font-semibold text-orange-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 nodrag transition-all"
              value={delayValue}
              onChange={handleValueChange}
            />
            <select
              className="flex-[1.5] p-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 nodrag cursor-pointer transition-all"
              value={delayUnit}
              onChange={handleUnitChange}
            >
              <option value="seconds">Segundos</option>
              <option value="minutes">Minutos</option>
              <option value="hours">Horas</option>
              <option value="days">Dias</option>
            </select>
          </div>
          <p className="text-[10px] text-gray-400 text-center mt-1 italic">
            O fluxo pausará por este período antes de continuar.
          </p>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="w-8 h-8 bg-orange-500 border-2 border-white" />
    </div>
  );
});

DelayNode.displayName = 'DelayNode';
