import { memo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Trash2, Smile } from 'lucide-react';

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏', '✅', '💯'];

export const ReactionNode = memo(({ id, data }: any) => {
  const { deleteElements, updateNodeData } = useReactFlow();

  const selectedEmoji = data?.emoji || '👍';

  return (
    <div className="bg-white border-2 border-yellow-400 rounded-xl shadow-lg min-w-[220px] overflow-hidden transition-all hover:shadow-yellow-100 hover:border-yellow-500">
      <Handle type="target" position={Position.Left} className="w-8 h-8 bg-yellow-400 border-2 border-white" />

      <div className="bg-yellow-50 px-3 py-3 border-b border-yellow-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="bg-yellow-400 p-1.5 rounded-lg">
            <Smile size={16} className="text-white" />
          </div>
          <span className="text-sm font-bold text-yellow-900 tracking-tight">Reagir à Mensagem</span>
        </div>
        <button
          onClick={() => { if (confirm('Excluir este bloco?')) deleteElements({ nodes: [{ id }] }); }}
          className="text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-700 transition-colors nodrag p-1 rounded-md"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="p-4 bg-white flex flex-col gap-3">
        <label className="text-[10px] font-bold text-yellow-600 uppercase tracking-widest ml-1">
          Emoji de Reação
        </label>

        <div className="flex items-center justify-center">
          <span className="text-5xl leading-none select-none">{selectedEmoji}</span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => updateNodeData(id, { emoji })}
              className={`text-xl p-1.5 rounded-lg transition-all nodrag border ${
                selectedEmoji === emoji
                  ? 'bg-yellow-100 border-yellow-400 scale-110 shadow-sm'
                  : 'bg-gray-50 border-transparent hover:bg-yellow-50 hover:border-yellow-200'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>

        <p className="text-[10px] text-gray-400 text-center italic leading-tight">
          Reage à última mensagem recebida do contato.
        </p>
      </div>

      <Handle type="source" position={Position.Right} className="w-8 h-8 bg-yellow-400 border-2 border-white" />
    </div>
  );
});

ReactionNode.displayName = 'ReactionNode';
