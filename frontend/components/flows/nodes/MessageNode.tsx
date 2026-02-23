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
            className="bg-orange-100 text-orange-700 font-semibold"
          >
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="bg-white border border-blue-400 rounded-md shadow-md min-w-[300px] max-w-[400px] overflow-hidden transition-all hover:shadow-lg">
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
        <label htmlFor={`msg-text-${id}`} className="block text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1 ml-1">
          Conteúdo da Mensagem
        </label>
        <div className="relative font-sans group">
          {/* Mirroring Highlighted Layer - This determines the height */}
          <div
            className="w-full text-sm p-3 whitespace-pre-wrap break-words break-all pointer-events-none text-gray-800 border border-transparent min-h-[120px]"
            aria-hidden="true"
          >
            {renderHighlightedText(text)}
            {/* Invisible character to ensure div expands if it ends with newline */}
            {text.endsWith('\n') ? '\n ' : ''}
          </div>

          {/* Actual Input Layer - Absolute position to overlap the mirror */}
          <textarea
            id={`msg-text-${id}`}
            value={text}
            onChange={onChange}
            className="absolute inset-0 w-full h-full text-sm p-3 border border-gray-200 rounded resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 nodrag bg-transparent text-transparent caret-gray-800 selection:bg-blue-200/50 transition-all hover:border-gray-300 break-words break-all"
            placeholder="Digite a mensagem..."
            spellCheck={false}
          />
        </div>
        <div className="mt-2 flex justify-between items-center text-[10px] text-gray-400 px-1 font-medium">
          <span>{text.length} caracteres</span>
          <span className="opacity-0 group-hover:opacity-100 transition-opacity italic">Auto-ajustável</span>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-blue-500" />
    </div>
  );
});

MessageNode.displayName = 'MessageNode';
