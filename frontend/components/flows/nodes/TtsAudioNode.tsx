'use client';

import { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Trash2, Sparkles, Music, Loader2, Check, RefreshCw, ChevronDown } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

type TtsMode = 'dynamic' | 'static';

interface TtsAudioData {
  ttsMode?: TtsMode;
  ttsText?: string;
  ttsVoice?: string;
  ttsModel?: string;
  staticAudioUrl?: string;
  staticAudioName?: string;
}

const VOICES: { id: string; label: string; description: string }[] = [
  { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah',   description: 'Feminina, suave e clara' },
  { id: 'TX3LPaxmHKxFdv7voQ3T',  label: 'Liam',    description: 'Masculina, jovem e natural' },
  { id: 'pFZP5JQG7iQjIQuC4Bku',  label: 'Lily',    description: 'Feminina, expressiva e calorosa' },
  { id: 'nPczCjzI2devNBz1zQrb',  label: 'Brian',   description: 'Masculina, grave e confiante' },
  { id: 'onwK4e9ZLuTAKqWW03F9',  label: 'Daniel',  description: 'Masculina, narração profissional' },
  { id: 'XB0fDUnXU5powFXDhCwa',  label: 'Charlotte', description: 'Feminina, elegante e clara' },
];

export const TtsAudioNode = memo(({ id, data }: { id: string; data: TtsAudioData }) => {
  const { updateNodeData, deleteElements } = useReactFlow();

  const [mode, setMode] = useState<TtsMode>(data.ttsMode ?? 'dynamic');
  const [text, setText] = useState(data.ttsText ?? '');
  const [voice, setVoice] = useState(data.ttsVoice ?? 'EXAVITQu4vr4xnSDxMaL');
  const [model, setModel] = useState(data.ttsModel ?? 'eleven_multilingual_v2');
  const [staticUrl, setStaticUrl] = useState(data.staticAudioUrl ?? '');
  const [staticName, setStaticName] = useState(data.staticAudioName ?? '');
  const [isGenerating, setIsGenerating] = useState(false);

  // Textarea auto-resize mirror
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync state → nodeData on every change
  useEffect(() => {
    updateNodeData(id, {
      ttsMode: mode,
      ttsText: text,
      ttsVoice: voice,
      ttsModel: model,
      staticAudioUrl: staticUrl,
      staticAudioName: staticName,
    } satisfies TtsAudioData);
  }, [mode, text, voice, model, staticUrl, staticName]);

  // Keep local state in sync if the node data is externally updated (e.g. flow load)
  useEffect(() => {
    if (data.ttsMode !== undefined && data.ttsMode !== mode) setMode(data.ttsMode);
    if (data.ttsText !== undefined && data.ttsText !== text) setText(data.ttsText);
    if (data.ttsVoice !== undefined && data.ttsVoice !== voice) setVoice(data.ttsVoice);
    if (data.ttsModel !== undefined && data.ttsModel !== model) setModel(data.ttsModel);
    if (data.staticAudioUrl !== undefined && data.staticAudioUrl !== staticUrl) setStaticUrl(data.staticAudioUrl);
    if (data.staticAudioName !== undefined && data.staticAudioName !== staticName) setStaticName(data.staticAudioName);
  }, [data.ttsMode, data.ttsText, data.ttsVoice, data.ttsModel, data.staticAudioUrl, data.staticAudioName]);

  const insertVariable = (varName: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setText((prev) => prev + `{{${varName}}}`);
      return;
    }
    const start = ta.selectionStart ?? text.length;
    const end = ta.selectionEnd ?? text.length;
    const newText = text.slice(0, start) + `{{${varName}}}` + text.slice(end);
    setText(newText);
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = start + varName.length + 4;
      ta.focus();
    }, 0);
  };

  const generateStaticAudio = async () => {
    if (!text.trim()) {
      toast.error('Escreva o texto antes de gerar o áudio.');
      return;
    }
    setIsGenerating(true);
    try {
      const res = await api.post('/flows/tts-preview', { text: text.trim(), voice, model });
      setStaticUrl(res.data.url);
      setStaticName(res.data.fileName);
      toast.success('Áudio gerado e salvo com sucesso!');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } }; message?: string })
        ?.response?.data?.error ?? (err as Error)?.message ?? 'Erro desconhecido';
      toast.error(`Erro ao gerar áudio: ${message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const charCount = text.length;
  const charLimit = 4096;
  const charWarning = charCount > charLimit * 0.9;

  // Highlight {{variables}} in the text display layer
  const highlightedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{\{([^}]+)\}\}/g, '<mark class="bg-orange-100 text-orange-700 rounded px-0.5">{{$1}}</mark>');

  return (
    <div className="bg-white border border-violet-400 rounded-md shadow-md min-w-[280px] max-w-[320px] overflow-hidden transition-all hover:shadow-lg">
      <Handle type="target" position={Position.Left} className="w-8 h-8 bg-violet-500" />

      {/* Header */}
      <div className="bg-violet-50 px-3 py-2 border-b border-violet-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-violet-600" />
          <span className="text-sm font-semibold text-violet-800">Áudio com IA</span>
        </div>
        <button
          onClick={() => {
            if (confirm('Excluir este bloco de áudio IA?')) deleteElements({ nodes: [{ id }] });
          }}
          className="text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-700 transition-colors nodrag p-1 rounded-md"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="p-3 flex flex-col gap-3">
        {/* Mode toggle */}
        <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs font-semibold nodrag">
          <button
            onClick={() => setMode('dynamic')}
            className={`flex-1 py-1.5 transition-colors ${
              mode === 'dynamic'
                ? 'bg-violet-500 text-white'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            Dinâmico
          </button>
          <button
            onClick={() => setMode('static')}
            className={`flex-1 py-1.5 transition-colors ${
              mode === 'static'
                ? 'bg-violet-500 text-white'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            Estático
          </button>
        </div>

        {/* Mode description */}
        <p className="text-[10px] text-gray-400 leading-tight -mt-1">
          {mode === 'dynamic'
            ? 'Gera áudio a cada envio. Suporta variáveis como {{nome}}. Consome tokens da API.'
            : 'Gera o áudio uma única vez aqui. Reutiliza sem consumir tokens nas execuções.'}
        </p>

        {/* Text input (shared by both modes) */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
            Texto{mode === 'dynamic' ? ' (suporta variáveis)' : ''}
          </label>
          <div className="relative">
            {/* Mirror layer for syntax highlighting */}
            <div
              aria-hidden
              className="absolute inset-0 p-2 text-xs leading-relaxed text-transparent pointer-events-none whitespace-pre-wrap break-words font-sans"
              dangerouslySetInnerHTML={{ __html: highlightedText + '&nbsp;' }}
            />
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                mode === 'dynamic'
                  ? 'Olá {{nome}}, sua consulta está confirmada!'
                  : 'Olá, obrigado por entrar em contato!'
              }
              rows={3}
              className="nodrag nopan w-full p-2 text-xs border border-gray-200 rounded resize-none focus:outline-none focus:border-violet-400 bg-transparent relative z-10 leading-relaxed caret-gray-700"
              style={{ color: 'transparent', caretColor: '#374151' }}
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>
          <div className={`text-[9px] text-right ${charWarning ? 'text-orange-500 font-semibold' : 'text-gray-300'}`}>
            {charCount}/{charLimit}
          </div>
        </div>

        {/* Variable chips — only in dynamic mode */}
        {mode === 'dynamic' && (
          <div className="flex flex-wrap gap-1">
            {['nome', 'telefone', 'empresa'].map((v) => (
              <button
                key={v}
                onClick={() => insertVariable(v)}
                className="nodrag text-[10px] bg-orange-50 border border-orange-200 text-orange-600 hover:bg-orange-100 px-2 py-0.5 rounded-full transition-colors"
              >
                +{`{{${v}}}`}
              </button>
            ))}
          </div>
        )}

        {/* Voice selector */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Voz</label>
          <div className="relative nodrag">
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="w-full appearance-none text-xs border border-gray-200 rounded px-2 py-1.5 pr-7 bg-white focus:outline-none focus:border-violet-400 nodrag"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} — {v.description}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Model selector */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Qualidade</label>
          <div className="flex rounded-md border border-gray-200 overflow-hidden text-[11px] font-medium nodrag">
            <button
              onClick={() => setModel('eleven_multilingual_v2')}
              className={`flex-1 py-1.5 transition-colors ${
                model === 'eleven_multilingual_v2'
                  ? 'bg-violet-500 text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              Padrão
            </button>
            <button
              onClick={() => setModel('eleven_turbo_v2_5')}
              className={`flex-1 py-1.5 transition-colors ${
                model === 'eleven_turbo_v2_5'
                  ? 'bg-violet-500 text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              Turbo
            </button>
          </div>
          <p className="text-[9px] text-gray-400">
            {model === 'eleven_turbo_v2_5'
              ? 'Turbo v2.5 — mais rápido, ideal para fluxos com variáveis'
              : 'Multilingual v2 — maior qualidade e naturalidade'}
          </p>
        </div>

        {/* STATIC MODE: generate + preview */}
        {mode === 'static' && (
          <div className="flex flex-col gap-2">
            <button
              onClick={generateStaticAudio}
              disabled={isGenerating || !text.trim()}
              className="nodrag w-full py-2 text-xs font-semibold text-white bg-violet-500 hover:bg-violet-600 disabled:opacity-50 rounded transition-colors flex items-center justify-center gap-1.5"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {isGenerating ? (
                <Loader2 size={13} className="animate-spin" />
              ) : staticUrl ? (
                <RefreshCw size={13} />
              ) : (
                <Sparkles size={13} />
              )}
              {isGenerating ? 'Gerando...' : staticUrl ? 'Regenerar Áudio' : 'Gerar Áudio'}
            </button>

            {staticUrl && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 p-2 bg-violet-50 rounded border border-violet-100 text-xs text-violet-700">
                  <Check size={12} className="text-violet-500 shrink-0" />
                  <Music size={12} className="shrink-0" />
                  <span className="truncate font-medium">{staticName || 'áudio-gerado.mp3'}</span>
                </div>
                <audio
                  key={staticUrl}
                  src={staticUrl}
                  controls
                  preload="metadata"
                  className="w-full h-10 nodrag nopan"
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </div>
        )}

        {/* DYNAMIC MODE: cost info */}
        {mode === 'dynamic' && (
          <div className="flex items-start gap-1.5 p-2 bg-amber-50 border border-amber-100 rounded text-[10px] text-amber-700 leading-relaxed">
            <span className="shrink-0 mt-0.5">💡</span>
            <span>
              Custo estimado: ~{charCount > 0 ? `$${((charCount / 1_000) * (model === 'eleven_turbo_v2_5' ? 0.00033 : 0.00066)).toFixed(5)}` : '$0.00000'} por envio (ElevenLabs)
            </span>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="w-8 h-8 bg-violet-500" />
    </div>
  );
});

TtsAudioNode.displayName = 'TtsAudioNode';
