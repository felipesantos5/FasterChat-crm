import { memo, useRef, useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Trash2, Mic, Upload, Music, StopCircle } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export const AudioNode = memo(({ id, data }: any) => {
  const { updateNodeData, deleteElements } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(data?.mediaUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local preview with data changes (e.g. on load)
  useEffect(() => {
    if (data?.mediaUrl) {
      setLocalPreview(data.mediaUrl);
    } else {
      setLocalPreview(null);
    }
  }, [data?.mediaUrl]);

  // Limpar timer de gravação caso seja desmontado
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const uploadFile = async (file: File) => {
    // Check if it's audio
    if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
      toast.error('Por favor, selecione um arquivo de áudio válido');
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

  const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], `gravacao-${Date.now()}.webm`, { type: 'audio/webm' });
        await uploadFile(file);

        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Erro ao acessar microfone:', error);
      toast.error('Não foi possível acessar o microfone. Verifique as permissões.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
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
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 border border-emerald-200 border-dashed rounded transition-colors flex items-center justify-center gap-1.5"
              >
                <Upload size={14} /> Arquivo
              </button>
              {isRecording ? (
                <button
                  onClick={stopRecording}
                  className="flex-1 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors flex items-center justify-center gap-1.5 animate-pulse"
                >
                  <StopCircle size={14} /> {formatTime(recordingTime)}
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  className="flex-1 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 border border-emerald-200 border-dashed rounded transition-colors flex items-center justify-center gap-1.5"
                >
                  <Mic size={14} /> Gravar
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full flex-col gap-2 flex">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-[80px] border-2 border-dashed border-emerald-200 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-emerald-50/50 hover:border-emerald-400 transition-all group"
            >
              <div className="bg-emerald-100 p-2 rounded-full text-emerald-600 group-hover:scale-110 transition-transform">
                <Upload size={20} />
              </div>
              <p className="text-xs font-bold text-emerald-700">Subir Áudio</p>
            </div>

            {isRecording ? (
              <div
                onClick={stopRecording}
                className="w-full h-[50px] border-2 border-red-400 bg-red-50 rounded-lg flex items-center justify-center gap-2 cursor-pointer hover:bg-red-100 transition-all group text-red-600 font-bold text-sm animate-pulse"
              >
                <StopCircle size={20} className="text-red-600" />
                Gravando: {formatTime(recordingTime)}
              </div>
            ) : (
              <div
                onClick={startRecording}
                className="w-full h-[50px] border-2 border-dashed border-emerald-200 bg-emerald-50/30 rounded-lg flex items-center justify-center gap-2 cursor-pointer hover:bg-emerald-50 hover:border-emerald-400 transition-all group text-emerald-700 font-bold text-sm"
              >
                <Mic size={20} className="text-emerald-600" />
                Gravar Áudio
              </div>
            )}
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
