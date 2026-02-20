import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

export const ConditionNode = memo(({ data }: any) => {
  return (
    <div className="bg-white border border-purple-400 rounded-md shadow-md min-w-[280px] overflow-hidden">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-purple-500" />

      <div className="bg-purple-50 px-3 py-2 border-b border-purple-100 flex items-center gap-2">
        <span className="text-xl">🔀</span>
        <span className="text-sm font-semibold text-purple-800">Verificar Resposta</span>
      </div>

      <div className="p-3 text-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-gray-600 font-medium">Aguardar:</span>
          <input
            type="number"
            className="w-16 p-1 border rounded text-center focus:outline-none focus:ring-1 focus:ring-purple-500"
            defaultValue={data?.waitHours || 24}
          />
          <span className="text-gray-500">horas</span>
        </div>
      </div>

      <div className="relative pt-4 pb-1">
        <div className="flex items-center justify-end pr-2 text-xs font-semibold text-green-600 mb-6">
          Se respondeu &rarr;
          <Handle
            type="source"
            position={Position.Right}
            id="respondeu"
            className="w-3 h-3 bg-green-500"
            style={{ top: '65%' }}
          />
        </div>

        <div className="flex items-center justify-end pr-2 text-xs font-semibold text-red-500 mt-2 mb-1">
          Se não respondeu &rarr;
          <Handle
            type="source"
            position={Position.Right}
            id="nao_respondeu"
            className="w-3 h-3 bg-red-500"
            style={{ top: '85%' }}
          />
        </div>
      </div>
    </div>
  );
});

ConditionNode.displayName = 'ConditionNode';
