import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

export const DelayNode = memo(({ data }: any) => {
  return (
    <div className="bg-white border border-orange-400 rounded-md shadow-md min-w-[200px] overflow-hidden">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-orange-500" />

      <div className="bg-orange-50 px-3 py-2 border-b border-orange-100 flex items-center gap-2">
        <span className="text-xl">⏳</span>
        <span className="text-sm font-semibold text-orange-800">Atraso</span>
      </div>

      <div className="p-3 flex items-center gap-2 text-sm justify-center">
        <input
          type="number"
          className="w-16 p-1 border rounded text-center focus:outline-none focus:ring-1 focus:ring-orange-500"
          defaultValue={data?.minutes || 60}
        />
        <span className="text-gray-600 font-medium">minutos</span>
      </div>

      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-orange-500" />
    </div>
  );
});

DelayNode.displayName = 'DelayNode';
