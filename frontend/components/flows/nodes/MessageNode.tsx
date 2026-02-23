import { memo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Trash2 } from 'lucide-react';

export const MessageNode = memo(({ id, data }: any) => {
  const { updateNodeData, deleteElements } = useReactFlow();

  const onChange = (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNodeData(id, { text: evt.target.value });
  };

  return (
    <div className="bg-white border border-blue-400 rounded-md shadow-md min-w-[250px] overflow-hidden">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-blue-500" />
      <div className="bg-blue-50 px-3 py-2 border-b border-blue-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">💬</span>
          <span className="text-sm font-semibold text-blue-800">Enviar Mensagem</span>
        </div>
        <button
          onClick={() => { if (confirm('Excluir este bloco?')) deleteElements({ nodes: [{ id }] }) }}
          className="text-blue-300 hover:text-red-500 transition-colors nodrag"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="p-3">
        <textarea
          id={`msg-text-${id}`}
          className="w-full text-sm p-2 border rounded resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 nodrag"
          rows={4}
          defaultValue={data?.text || ''}
          onChange={onChange}
          placeholder="Digite a mensagem..."
        />
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-blue-500" />
    </div>
  );
});

MessageNode.displayName = 'MessageNode';
