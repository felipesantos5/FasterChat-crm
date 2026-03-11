import { memo, useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Trash2, Smile, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏', '✅', '💯'];

const ALL_EMOJIS = {
  business: ['🚀', '✅', '✔️', '❌', '⚠️', '🔥', '💰', '💸', '🤝', '💎', '🎯', '📈', '⭐', '🔔', '📍', '📅', '⏰', '📧'],
  faces: ['😊', '😂', '🤣', '😅', '😁', '😉', '😍', '🥰', '😘', '😋', '😎', '🤔', '😐', '😑', '😶', '🙄', '😬', '😮', '😯', '😴', '😔', '😕', '🙁', '😞', '😢', '😭'],
  hands: ['👍', '👎', '👏', '🙌', '👋', '🤝', '🙏', '✌️', '🤞', '🤙', '👌', '🤌', '✊', '👊'],
  hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎'],
};

export const ReactionNode = memo(({ id, data }: any) => {
  const { deleteElements, updateNodeData } = useReactFlow();
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectedEmoji = data?.emoji || '👍';

  const handleSelect = (emoji: string) => {
    updateNodeData(id, { emoji });
    setPickerOpen(false);
  };

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
          {/* Botão para abrir o picker completo */}
          <button
            onClick={() => setPickerOpen(true)}
            className="text-sm p-1.5 rounded-lg transition-all nodrag border bg-gray-50 border-gray-200 hover:bg-yellow-50 hover:border-yellow-300 flex items-center justify-center text-gray-500 hover:text-yellow-600"
            title="Escolher outro emoji"
          >
            <Plus size={16} />
          </button>
        </div>

        <p className="text-[10px] text-gray-400 text-center italic leading-tight">
          Reage à última mensagem recebida do contato.
        </p>
      </div>

      <Handle type="source" position={Position.Right} className="w-8 h-8 bg-yellow-400 border-2 border-white" />

      {/* Dialog com picker completo */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="w-80 nodrag" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-sm">Escolher Emoji</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase text-muted-foreground px-1 tracking-wider">🚀 Objetivo / Business</p>
              <div className="grid grid-cols-9 gap-1">
                {ALL_EMOJIS.business.map((emoji, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect(emoji)}
                    className={`h-8 w-8 flex items-center justify-center rounded hover:bg-yellow-50 transition-colors text-xl ${selectedEmoji === emoji ? 'bg-yellow-100 ring-1 ring-yellow-400' : ''}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1 pt-2 border-t">
              <p className="text-[10px] font-bold uppercase text-muted-foreground px-1 tracking-wider">😊 Reações</p>
              <div className="grid grid-cols-9 gap-1">
                {ALL_EMOJIS.faces.map((emoji, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect(emoji)}
                    className={`h-8 w-8 flex items-center justify-center rounded hover:bg-yellow-50 transition-colors text-xl ${selectedEmoji === emoji ? 'bg-yellow-100 ring-1 ring-yellow-400' : ''}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1 pt-2 border-t">
              <p className="text-[10px] font-bold uppercase text-muted-foreground px-1 tracking-wider">👍 Gestos</p>
              <div className="grid grid-cols-9 gap-1">
                {ALL_EMOJIS.hands.map((emoji, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect(emoji)}
                    className={`h-8 w-8 flex items-center justify-center rounded hover:bg-yellow-50 transition-colors text-xl ${selectedEmoji === emoji ? 'bg-yellow-100 ring-1 ring-yellow-400' : ''}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1 pt-2 border-t">
              <p className="text-[10px] font-bold uppercase text-muted-foreground px-1 tracking-wider">❤️ Corações</p>
              <div className="grid grid-cols-9 gap-1">
                {ALL_EMOJIS.hearts.map((emoji, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect(emoji)}
                    className={`h-8 w-8 flex items-center justify-center rounded hover:bg-yellow-50 transition-colors text-xl ${selectedEmoji === emoji ? 'bg-yellow-100 ring-1 ring-yellow-400' : ''}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

ReactionNode.displayName = 'ReactionNode';
