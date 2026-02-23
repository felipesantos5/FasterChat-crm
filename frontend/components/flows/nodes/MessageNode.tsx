import { memo, useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Trash2 } from 'lucide-react';

export const MessageNode = memo(({ id, data }: any) => {
  const { updateNodeData, deleteElements } = useReactFlow();
  const [text, setText] = useState(data?.text || '');

  // Keep internal state in sync with data changes (e.g. from handleVariableClick)
  useEffect(() => {
    if (data?.text !== undefined && data.text !== text) {
      setText(data.text);
    }
  }, [data?.text]);

  const onChange = (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = evt.target.value;
    setText(val);
    updateNodeData(id, { text: val });
  };

  // Function to highlight variables {{name}}
  const renderHighlightedText = (content: string) => {
    if (!content) return null;

    // Split by variables while keeping the brackets
    const parts = content.split(/(\{\{[^{}]*\}\})/g);

    return parts.map((part, i) => {
      if (part.startsWith('{{') && part.endsWith('}}')) {
        return (
          <span
            key={i}
            className="bg-zinc-800 text-orange-400 px-1 rounded font-mono text-[0.95em] border border-zinc-700 shadow-sm"
          >
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="bg-white border border-blue-400 rounded-md shadow-md min-w-[300px] overflow-hidden transition-all hover:shadow-lg">
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
        <div className="relative min-h-[120px] font-sans">
          {/* Mirroring Highlighted Layer */}
          <div
            className="absolute inset-0 p-3 text-sm whitespace-pre-wrap break-words pointer-events-none overflow-hidden text-gray-800 border border-transparent"
            aria-hidden="true"
          >
            {renderHighlightedText(text)}
            {/* Invisible character to ensure div expands if it ends with newline */}
            {text.endsWith('\n') ? '\n ' : ''}
          </div>

          {/* Actual Input Layer */}
          <textarea
            id={`msg-text-${id}`}
            value={text}
            onChange={onChange}
            className="w-full h-full min-h-[120px] text-sm p-3 border rounded resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 nodrag bg-transparent relative text-transparent caret-gray-800 selection:bg-blue-100 selection:text-transparent"
            rows={4}
            placeholder="Digite a mensagem..."
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500">
          <span>Variáveis: {'{{nome}}, {{linkDoc}}'}...</span>
          <span className={text.length > 800 ? 'text-red-500' : ''}>{text.length}/1000</span>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-blue-500" />
    </div>
  );
});

MessageNode.displayName = 'MessageNode';
