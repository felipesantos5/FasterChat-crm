import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

export const TriggerNode = memo(({ data }: any) => {
  return (
    <div className="bg-white border-2 border-primary rounded-md shadow-md min-w-[200px] overflow-hidden">
      <div className="bg-primary/10 px-3 py-2 border-b border-primary/20 flex items-center justify-between">
        <span className="text-sm font-semibold text-primary">⚡ Gatilho</span>
      </div>
      <div className="p-3">
        <p className="text-sm text-gray-700 font-medium mb-1">Webhook URL:</p>
        <div className="bg-gray-100 p-2 rounded text-xs select-all overflow-x-auto whitespace-nowrap border text-gray-500 font-mono">
          {data?.description || 'https://api.crm.com/webhook/123'}
        </div>
        <p className="text-[10px] text-gray-400 mt-2">Dispara quando receber POST via webhook da sua loja/checkout.</p>
      </div>
      <Handle type="source" position={Position.Right} id="a" className="w-3 h-3 bg-primary" />
    </div>
  );
});

TriggerNode.displayName = 'TriggerNode';
