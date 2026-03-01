import { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Trash2, Tag } from 'lucide-react';
import { VariablePickerModal } from '../VariablePickerModal';

export const MessageNode = memo(({ id, data }: any) => {
  const { updateNodeData, deleteElements } = useReactFlow();
  const [text, setText] = useState(data?.text || '');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const insertVariable = (variable: string) => {
    const variableText = `{{${variable}}}`;
    const textarea = textareaRef.current;

    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = text.substring(0, start) + variableText + text.substring(end);
      setText(newText);
      updateNodeData(id, { text: newText });

      // Reset cursor position after a tick
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variableText.length, start + variableText.length);
      }, 0);
    } else {
      const newText = text + ' ' + variableText;
      setText(newText);
      updateNodeData(id, { text: newText });
    }
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
    <div className="bg-white border-2 border-blue-400 rounded-xl shadow-lg min-w-[320px] max-w-[400px] overflow-hidden transition-all hover:shadow-blue-100 hover:border-blue-500">
      <Handle type="target" position={Position.Left} className="w-8 h-8 bg-blue-500 border-2 border-white" />

      <div className="bg-blue-50 px-3 py-3 border-b border-blue-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="bg-blue-500 p-1.5 rounded-lg shadow-sm">
            <span className="text-white">💬</span>
          </div>
          <span className="text-sm font-bold text-blue-900 tracking-tight">Enviar Mensagem</span>
        </div>
        <button
          onClick={() => { if (confirm('Excluir este bloco?')) deleteElements({ nodes: [{ id }] }) }}
          className="text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-700 transition-colors nodrag p-1 rounded-md"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="p-4 bg-white">
        <div className="flex items-center justify-between mb-2 px-1">
          <label htmlFor={`msg-text-${id}`} className="text-[10px] uppercase tracking-widest font-bold text-gray-400">
            Conteúdo da Mensagem
          </label>
        </div>

        <div className="font-sans group" style={{ display: 'grid' }}>
          {/* Mirror layer: shows highlighted text and establishes height for the grid */}
          <div
            className="text-sm p-3 whitespace-pre-wrap break-words pointer-events-none text-gray-800 border-2 border-transparent min-h-[140px] leading-relaxed rounded-xl"
            aria-hidden="true"
            style={{ gridArea: '1 / 1' }}
          >
            {renderHighlightedText(text)}
            {text.endsWith('\n') ? '\n ' : ' '}
          </div>

          {/* Textarea: sits on top of mirror in same grid cell, grows together — no internal scroll */}
          <textarea
            ref={textareaRef}
            id={`msg-text-${id}`}
            value={text}
            onChange={onChange}
            className="text-sm p-3 border-2 border-gray-100 rounded-xl resize-none focus:outline-none focus:ring-0 focus:border-blue-400 nodrag bg-transparent text-transparent caret-gray-800 selection:bg-blue-200/50 transition-all hover:border-gray-200 break-words leading-relaxed min-h-[140px]"
            placeholder="Digite sua mensagem aqui..."
            spellCheck={false}
            style={{ gridArea: '1 / 1', overflow: 'hidden' }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            onClick={() => setIsPickerOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-[11px] font-bold text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all nodrag shadow-sm"
          >
            <Tag size={12} className="text-blue-500" />
            Variáveis
          </button>

          <div className="text-[10px] text-gray-400 font-medium bg-gray-50 px-2 py-1 rounded-md">
            {text.length} caracteres
          </div>
        </div>
      </div>

      <VariablePickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={insertVariable}
        flowId={data?.flowId}
      />

      <Handle type="source" position={Position.Right} className="w-8 h-8 bg-blue-500 border-2 border-white" />
    </div>
  );
});

MessageNode.displayName = 'MessageNode';
