import { memo, useRef, useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Trash2, ImageIcon, Video, Upload, X, Tag } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { VariablePickerModal } from '../VariablePickerModal';

export const MediaNode = memo(({ id, data, type }: any) => {
  const { updateNodeData, deleteElements } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(data?.mediaUrl || null);
  const [isUploading, setIsUploading] = useState(false);

  // Sync local preview with data changes (e.g. on load)
  useEffect(() => {
    if (data?.mediaUrl) {
      setLocalPreview(data.mediaUrl);
    } else {
      setLocalPreview(null);
    }
  }, [data?.mediaUrl]);

  const isVideo = type === 'video';
  const Icon = isVideo ? Video : ImageIcon;

  const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if it's the right type
    if (isVideo && !file.type.startsWith('video/')) {
      toast.error('Por favor, selecione um arquivo de vídeo');
      return;
    }
    if (!isVideo && !file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    // Set local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const url = response.data.url;
      updateNodeData(id, { mediaUrl: url, fileName: file.name });
      setLocalPreview(url); // Update with final URL
      toast.success(`${isVideo ? 'Vídeo' : 'Imagem'} enviado com sucesso!`);
    } catch (error) {
      console.error('Error uploading media', error);
      toast.error('Erro ao enviar arquivo');
      setLocalPreview(data?.mediaUrl || null); // Revert on error
    } finally {
      setIsUploading(false);
    }
  };

  const handleCaptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNodeData(id, { caption: e.target.value });
  };

  const insertVariable = (variable: string) => {
    const variableText = `{{${variable}}}`;
    const textarea = captionRef.current;
    const currentCaption = data?.caption || '';

    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = currentCaption.substring(0, start) + variableText + currentCaption.substring(end);
      updateNodeData(id, { caption: newText });

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variableText.length, start + variableText.length);
      }, 0);
    } else {
      updateNodeData(id, { caption: currentCaption + ' ' + variableText });
    }
  };

  return (
    <div className={`bg-white border-2 rounded-xl shadow-lg min-w-[320px] max-w-[400px] overflow-hidden transition-all ${isVideo
      ? 'border-indigo-400 hover:shadow-indigo-100 hover:border-indigo-500'
      : 'border-pink-400 hover:shadow-pink-100 hover:border-pink-500'
      }`}>
      <Handle
        type="target"
        position={Position.Left}
        className={`w-3 h-3 border-2 border-white ${isVideo ? 'bg-indigo-500' : 'bg-pink-500'}`}
      />

      <div className={`px-3 py-3 border-b flex items-center justify-between gap-2 ${isVideo ? 'bg-indigo-50 border-indigo-100' : 'bg-pink-50 border-pink-100'
        }`}>
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg shadow-sm ${isVideo ? 'bg-indigo-500' : 'bg-pink-500'}`}>
            <Icon size={16} className="text-white" />
          </div>
          <span className={`text-sm font-bold tracking-tight text-nowrap ${isVideo ? 'text-indigo-900' : 'text-pink-900'
            }`}>
            Enviar {isVideo ? 'Vídeo' : 'Imagem'}
          </span>
        </div>
        <button
          onClick={() => { if (confirm('Excluir este bloco?')) deleteElements({ nodes: [{ id }] }) }}
          className={`transition-colors nodrag p-1 hover:bg-red-50 rounded-md ${isVideo ? 'text-indigo-300 hover:text-red-500' : 'text-pink-300 hover:text-red-500'
            }`}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="p-4 bg-white flex flex-col gap-4">
        {localPreview ? (
          <div className="w-full space-y-4">
            <div className={`relative group aspect-video rounded-lg overflow-hidden border flex items-center justify-center ${isVideo ? 'bg-indigo-50/30 border-indigo-100' : 'bg-pink-50/30 border-pink-100'
              }`}>
              {isVideo ? (
                <video
                  src={localPreview}
                  className="w-full h-full object-contain bg-black/5"
                  controls
                />
              ) : (
                <img
                  src={localPreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  crossOrigin="anonymous"
                />
              )}

              {isUploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="text-[10px] text-white font-bold tracking-tight uppercase">Enviando...</span>
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  updateNodeData(id, { mediaUrl: null, fileName: null });
                  setLocalPreview(null);
                }}
                className="absolute top-2 right-2 bg-white/90 p-1 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm nodrag"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <label className={`text-[10px] font-bold uppercase tracking-widest ${isVideo ? 'text-indigo-600' : 'text-pink-600'
                  }`}>
                  Legenda (Opcional)
                </label>
                <button
                  onClick={() => setIsPickerOpen(true)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold transition-all nodrag border border-dashed ${isVideo
                    ? 'text-indigo-600 border-indigo-200 hover:bg-indigo-100'
                    : 'text-pink-600 border-pink-200 hover:bg-pink-100'
                    }`}
                >
                  <Tag size={10} /> Variáveis
                </button>
              </div>
              <textarea
                ref={captionRef}
                className={`w-full p-2.5 bg-gray-50 border border-gray-100 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 nodrag resize-none transition-all ${isVideo ? 'focus:ring-indigo-500/20 focus:border-indigo-400' : 'focus:ring-pink-500/20 focus:border-pink-400'
                  }`}
                rows={2}
                placeholder="Digite uma legenda..."
                value={data?.caption || ''}
                onChange={handleCaptionChange}
              />
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className={`w-full py-2 text-[11px] font-bold border border-dashed rounded-lg transition-all flex items-center justify-center gap-2 ${isVideo
                ? 'text-indigo-600 hover:bg-indigo-50 border-indigo-200'
                : 'text-pink-600 hover:bg-pink-50 border-pink-200'
                }`}
            >
              <Upload size={12} /> Alterar Arquivo
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`w-full aspect-video border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all group p-4 text-center ${isVideo
              ? 'border-indigo-200 hover:bg-indigo-50/50 hover:border-indigo-400'
              : 'border-pink-200 hover:bg-pink-50/50 hover:border-pink-400'
              }`}
          >
            <div className={`p-4 rounded-full group-hover:scale-110 transition-transform shadow-sm ${isVideo ? 'bg-indigo-100 text-indigo-600' : 'bg-pink-100 text-pink-600'
              }`}>
              <Upload size={28} />
            </div>
            <div>
              <p className={`text-sm font-bold ${isVideo ? 'text-indigo-700' : 'text-pink-700'}`}>
                Enviar {isVideo ? 'Vídeo' : 'Imagem'}
              </p>
              <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-semibold">
                {isVideo ? 'MP4 ou MKV' : 'JPG, PNG ou GIF'}
              </p>
            </div>
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileUpload}
          accept={isVideo ? "video/*" : "image/*"}
          className="hidden"
        />
      </div>

      <VariablePickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={insertVariable}
        flowId={data?.flowId}
      />

      <Handle
        type="source"
        position={Position.Right}
        className={`w-3 h-3 border-2 border-white ${isVideo ? 'bg-indigo-500' : 'bg-pink-500'}`}
      />
    </div>
  );
});

MediaNode.displayName = 'MediaNode';
