import { memo, useRef, useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Trash2, Sparkles, X, Tag, Plus } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { VariablePickerModal } from '../VariablePickerModal';

interface ReferenceImage {
  url: string;
  mimeType?: string;
  fileName?: string;
}

export const AiImageNode = memo(({ id, data }: any) => {
  const { updateNodeData, deleteElements } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'prompt' | 'csvImage' | 'caption'>('prompt');
  const [isUploading, setIsUploading] = useState(false);

  // Sync local states with data
  const [prompt, setPrompt] = useState<string>(data?.aiPrompt || '');
  const [csvImageVariable, setCsvImageVariable] = useState<string>(data?.csvImageVariable || '');
  const [caption, setCaption] = useState<string>(data?.aiCaption || '');
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>(data?.referenceImages || []);

  useEffect(() => {
    if (data?.aiPrompt !== undefined && data.aiPrompt !== prompt) setPrompt(data.aiPrompt || '');
  }, [data?.aiPrompt]);

  useEffect(() => {
    if (data?.csvImageVariable !== undefined && data.csvImageVariable !== csvImageVariable) setCsvImageVariable(data.csvImageVariable || '');
  }, [data?.csvImageVariable]);

  useEffect(() => {
    if (data?.aiCaption !== undefined && data.aiCaption !== caption) setCaption(data.aiCaption || '');
  }, [data?.aiCaption]);

  useEffect(() => {
    if (data?.referenceImages) setReferenceImages(data.referenceImages);
  }, [data?.referenceImages]);

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPrompt(val);
    updateNodeData(id, { aiPrompt: val });
  };

  const handleCsvImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCsvImageVariable(val);
    updateNodeData(id, { csvImageVariable: val });
  };

  const handleCaptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCaption(val);
    updateNodeData(id, { aiCaption: val });
  };

  const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('O tamanho máximo é de 10MB');
      return;
    }

    if (referenceImages.length >= 3) {
      toast.error('Máximo de 3 imagens de referência');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const newRef: ReferenceImage = {
        url: response.data.url,
        mimeType: file.type,
        fileName: file.name,
      };

      const updated = [...referenceImages, newRef];
      setReferenceImages(updated);
      updateNodeData(id, { referenceImages: updated });
      toast.success('Imagem de referência adicionada!');
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Erro desconhecido';
      toast.error(`Erro ao enviar: ${msg}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeReference = (index: number) => {
    const updated = referenceImages.filter((_, i) => i !== index);
    setReferenceImages(updated);
    updateNodeData(id, { referenceImages: updated });
  };

  const openPicker = (target: 'prompt' | 'csvImage' | 'caption') => {
    setPickerTarget(target);
    setIsPickerOpen(true);
  };

  const insertVariable = (variable: string) => {
    const variableText = `{{${variable}}}`;

    if (pickerTarget === 'csvImage') {
      const val = csvImageVariable + variableText;
      setCsvImageVariable(val);
      updateNodeData(id, { csvImageVariable: val });
      return;
    }

    const ref = pickerTarget === 'prompt' ? promptRef : captionRef;
    const currentVal = pickerTarget === 'prompt' ? prompt : caption;
    const setter = pickerTarget === 'prompt' ? setPrompt : setCaption;
    const key = pickerTarget === 'prompt' ? 'aiPrompt' : 'aiCaption';
    const textarea = ref.current;

    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = currentVal.substring(0, start) + variableText + currentVal.substring(end);
      setter(newText);
      updateNodeData(id, { [key]: newText });
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variableText.length, start + variableText.length);
      }, 0);
    } else {
      const newText = currentVal + ' ' + variableText;
      setter(newText);
      updateNodeData(id, { [key]: newText });
    }
  };

  const renderHighlighted = (content: string) => {
    if (!content) return null;
    const parts = content.split(/({{[^{}]*}})/g);
    return parts.map((part, i) => {
      if (part.startsWith('{{') && part.endsWith('}}')) {
        return (
          <span key={i} className="bg-violet-100 text-violet-700 font-semibold">
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="bg-white border-2 border-violet-400 rounded-xl shadow-lg min-w-[340px] max-w-[420px] overflow-hidden transition-all hover:shadow-violet-100 hover:border-violet-500">
      <Handle type="target" position={Position.Left} className="w-8 h-8 bg-violet-500 border-2 border-white" />

      {/* Header */}
      <div className="bg-gradient-to-r from-violet-50 to-fuchsia-50 px-3 py-3 border-b border-violet-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-br from-violet-500 to-fuchsia-500 p-1.5 rounded-lg shadow-sm">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="text-sm font-bold text-violet-900 tracking-tight">Imagem IA</span>
        </div>
        <button
          onClick={() => { if (confirm('Excluir este bloco?')) deleteElements({ nodes: [{ id }] }) }}
          className="text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-700 transition-colors nodrag p-1 rounded-md"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="p-4 bg-white flex flex-col gap-4">

        {/* Reference Images */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <label className="text-[10px] font-bold text-violet-600 uppercase tracking-widest">
              Imagens de Referência ({referenceImages.length}/3)
            </label>
          </div>

          {referenceImages.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {referenceImages.map((ref, index) => (
                <div key={index} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-violet-200">
                  <img src={ref.url} alt={ref.fileName || `Ref ${index + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeReference(index)}
                    className="absolute top-0.5 right-0.5 bg-white/90 p-0.5 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm nodrag"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {referenceImages.length < 3 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full py-2 text-[11px] font-bold border border-dashed border-violet-200 text-violet-600 hover:bg-violet-50 rounded-lg transition-all flex items-center justify-center gap-2 nodrag disabled:opacity-50"
            >
              {isUploading ? (
                <div className="w-3 h-3 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
              ) : (
                <Plus size={12} />
              )}
              {isUploading ? 'Enviando...' : 'Adicionar Referência'}
            </button>
          )}
        </div>

        {/* CSV Image Variable */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <label className="text-[10px] font-bold text-violet-600 uppercase tracking-widest">
              Imagem do CSV (Link)
            </label>
            <button
              onClick={() => openPicker('csvImage')}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold transition-all nodrag border border-dashed text-violet-600 border-violet-200 hover:bg-violet-100"
            >
              <Tag size={10} /> Variáveis
            </button>
          </div>
          <input
            type="text"
            className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 nodrag transition-all"
            placeholder="{{imagem_produto}}"
            value={csvImageVariable}
            onChange={handleCsvImageChange}
          />
          <p className="text-[9px] text-gray-400 px-1 italic">
            Variável do CSV que contém o link da imagem
          </p>
        </div>

        {/* Prompt */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <label className="text-[10px] font-bold text-violet-600 uppercase tracking-widest">
              Prompt da IA *
            </label>
            <button
              onClick={() => openPicker('prompt')}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold transition-all nodrag border border-dashed text-violet-600 border-violet-200 hover:bg-violet-100"
            >
              <Tag size={10} /> Variáveis
            </button>
          </div>
          <div style={{ display: 'grid' }}>
            <div
              className="text-sm p-2.5 whitespace-pre-wrap break-words pointer-events-none text-gray-700 border border-transparent bg-gray-50 rounded-lg min-h-[80px] leading-relaxed"
              aria-hidden="true"
              style={{ gridArea: '1 / 1' }}
            >
              {renderHighlighted(prompt)}
              {prompt.endsWith('\n') ? '\n ' : ' '}
            </div>
            <textarea
              ref={promptRef}
              className="text-sm p-2.5 bg-transparent border border-gray-100 rounded-lg text-transparent caret-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 nodrag resize-none transition-all selection:bg-blue-200/50 break-words leading-relaxed min-h-[80px]"
              placeholder="Descreva o que a IA deve gerar..."
              value={prompt}
              onChange={handlePromptChange}
              style={{ gridArea: '1 / 1', overflow: 'hidden' }}
            />
          </div>
          <p className="text-[9px] text-gray-400 px-1 italic">
            Ex: "Crie uma arte profissional com o produto sobre fundo gradiente"
          </p>
        </div>

        {/* Caption */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <label className="text-[10px] font-bold text-violet-600 uppercase tracking-widest">
              Legenda (Opcional)
            </label>
            <button
              onClick={() => openPicker('caption')}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold transition-all nodrag border border-dashed text-violet-600 border-violet-200 hover:bg-violet-100"
            >
              <Tag size={10} /> Variáveis
            </button>
          </div>
          <div style={{ display: 'grid' }}>
            <div
              className="text-sm p-2.5 whitespace-pre-wrap break-words pointer-events-none text-gray-700 border border-transparent bg-gray-50 rounded-lg min-h-[48px] leading-relaxed"
              aria-hidden="true"
              style={{ gridArea: '1 / 1' }}
            >
              {renderHighlighted(caption)}
              {caption.endsWith('\n') ? '\n ' : ' '}
            </div>
            <textarea
              ref={captionRef}
              className="text-sm p-2.5 bg-transparent border border-gray-100 rounded-lg text-transparent caret-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 nodrag resize-none transition-all selection:bg-blue-200/50 break-words leading-relaxed min-h-[48px]"
              placeholder="Legenda para enviar com a imagem..."
              value={caption}
              onChange={handleCaptionChange}
              style={{ gridArea: '1 / 1', overflow: 'hidden' }}
            />
          </div>
        </div>

        {/* Info */}
        <div className="bg-violet-50/50 rounded-lg p-2 border border-violet-100">
          <p className="text-[9px] text-violet-500 text-center font-medium">
            ✨ A IA gerará uma imagem personalizada baseada no prompt + referências e enviará ao cliente
          </p>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileUpload}
        accept="image/*"
        className="hidden"
      />

      <VariablePickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={insertVariable}
        flowId={data?.flowId}
      />

      <Handle type="source" position={Position.Right} className="w-8 h-8 bg-violet-500 border-2 border-white" />
    </div>
  );
});

AiImageNode.displayName = 'AiImageNode';
