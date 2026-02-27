import { memo, useRef, useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Trash2, Mic, Upload, Music } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export const AudioNode = memo(({ id, data }: any) => {
  const { updateNodeData, deleteElements } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if it's audio
    if (!file.type.startsWith('audio/')) {
      toast.error('Por favor, selecione um arquivo de áudio');
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
      toast.success('Áudio enviado com sucesso!');
    } catch (error) {
      console.error('Error uploading audio', error);
      toast.error('Erro ao enviar áudio');
      setLocalPreview(data?.mediaUrl || null); // Revert on error
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white border border-emerald-400 rounded-md shadow-md min-w-[250px] overflow-hidden transition-all hover:shadow-lg">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-emerald-500" />

      <div className="bg-emerald-50 px-3 py-2 border-b border-emerald-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mic size={16} className="text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-800">Enviar Áudio</span>
        </div>
        <button
          onClick={() => { if (confirm('Excluir este bloco de áudio?')) deleteElements({ nodes: [{ id }] }) }}
          className="text-emerald-300 hover:text-red-500 transition-colors nodrag"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="p-4 flex flex-col items-center gap-3">
        {localPreview ? (
          <div className="w-full space-y-3">
            <div className="relative flex items-center gap-2 p-2 bg-emerald-50 rounded border border-emerald-100 text-xs text-emerald-700">
              <Music size={14} />
              <span className="truncate flex-1 font-medium">{data.fileName || 'áudio-selecionado.mp3'}</span>

              {isUploading && (
                <div className="absolute inset-0 bg-emerald-50/80 flex items-center justify-center rounded">
                  <div className="w-3 h-3 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                </div>
              )}
            </div>
            <audio
              key={localPreview}
              src={localPreview}
              controls
              preload="metadata"
              className="w-full h-10 nodrag nopan"
              style={{ width: '100%', minWidth: '200px' }}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 border border-emerald-200 border-dashed rounded transition-colors flex items-center justify-center gap-2"
            >
              <Upload size={12} /> Alterar Áudio
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-full aspect-video border-2 border-dashed border-emerald-200 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-emerald-50/50 hover:border-emerald-400 transition-all group p-4 text-center"
          >
            <div className="bg-emerald-100 p-3 rounded-full text-emerald-600 group-hover:scale-110 transition-transform">
              <Upload size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-700">Subir Áudio</p>
              <p className="text-[10px] text-emerald-500">MP3, WAV ou OGG</p>
            </div>
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileUpload}
          accept="audio/*"
          className="hidden"
        />
      </div>

      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-emerald-500" />
    </div>
  );
});

AudioNode.displayName = 'AudioNode';
