import { memo, useRef, useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Trash2, Mic, Upload, Music, Square, RotateCcw, Check, X } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

type Mode = 'idle' | 'recording' | 'review';

const WAVE_HEIGHTS = [8, 16, 24, 20, 12, 28, 16, 24, 8, 20, 14, 18];

export const AudioNode = memo(({ id, data }: any) => {
  const { updateNodeData, deleteElements } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(data?.mediaUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [mode, setMode] = useState<Mode>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const savedAudioRef = useRef<{ url: string; name: string } | null>(null);

  // Sync local preview with data changes (e.g. on load)
  useEffect(() => {
    if (data?.mediaUrl) {
      setLocalPreview(data.mediaUrl);
    } else {
      setLocalPreview(null);
    }
  }, [data?.mediaUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startRecording = async (saveCurrentAudio = true) => {
    if (saveCurrentAudio && localPreview) {
      savedAudioRef.current = {
        url: localPreview,
        name: data?.fileName || 'áudio-anterior',
      };
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error('Permissão de microfone negada ou indisponível');
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    setRecordingTime(0);

    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const objectUrl = URL.createObjectURL(blob);
      setRecordedBlob(blob);
      setLocalPreview(objectUrl);
      setMode('review');
      stream.getTracks().forEach((t) => t.stop());
    };

    recorder.start();
    setMode('recording');

    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
  };

  const reRecord = () => {
    startRecording(false);
  };

  const cancelRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setRecordedBlob(null);

    if (savedAudioRef.current) {
      setLocalPreview(savedAudioRef.current.url);
    } else {
      setLocalPreview(null);
    }
    setMode('idle');
  };

  const useRecordedAudio = async () => {
    if (!recordedBlob) return;

    const fileName = `gravacao-${Date.now()}.webm`;
    const file = new File([recordedBlob], fileName, { type: 'audio/webm' });
    const objectUrl = URL.createObjectURL(recordedBlob);
    setLocalPreview(objectUrl);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = response.data.url;
      updateNodeData(id, { mediaUrl: url, fileName });
      setLocalPreview(url);
      toast.success('Áudio salvo com sucesso!');
    } catch (error: any) {
      console.error('Error uploading recorded audio', error);

      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
      if (errorMessage?.includes('too large') || error.response?.status === 413) {
        toast.error(`O arquivo de áudio gravado é muito grande. O limite máximo é de 10MB.`);
      } else {
        toast.error(`Erro ao salvar gravação: ${errorMessage || 'Desconhecido'}`);
      }

      setLocalPreview(data?.mediaUrl || null);
    } finally {
      setIsUploading(false);
      setRecordedBlob(null);
      setMode('idle');
    }
  };

  const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('audio/')) {
      toast.error('Por favor, selecione um arquivo de áudio');
      return;
    }

    const MAX_MB = 10;
    const MAX_SIZE = MAX_MB * 1024 * 1024;

    if (file.size > MAX_SIZE) {
      toast.error(`O tamanho máximo permitido para o arquivo é de ${MAX_MB}MB. Por favor, escolha um arquivo menor.`);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = response.data.url;
      updateNodeData(id, { mediaUrl: url, fileName: file.name });
      setLocalPreview(url);
      toast.success('Áudio enviado com sucesso!');
    } catch (error: any) {
      console.error('Error uploading audio', error);

      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
      if (errorMessage?.includes('too large') || error.response?.status === 413) {
        toast.error(`O arquivo enviado é muito grande. O limite máximo é de 10MB.`);
      } else {
        toast.error(`Erro ao enviar áudio: ${errorMessage || 'Desconhecido'}`);
      }

      setLocalPreview(data?.mediaUrl || null);
    } finally {
      setIsUploading(false);
    }
  };

  const hasAudio = Boolean(localPreview);

  const audioPlayerProps = {
    key: localPreview,
    src: localPreview ?? undefined,
    controls: true,
    preload: 'metadata' as const,
    className: 'w-full h-10 nodrag nopan',
    style: { width: '100%', minWidth: '200px' },
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    onPointerUp: (e: React.PointerEvent) => e.stopPropagation(),
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
    onMouseUp: (e: React.MouseEvent) => e.stopPropagation(),
  };

  return (
    <div className="bg-white border border-emerald-400 rounded-md shadow-md min-w-[250px] overflow-hidden transition-all hover:shadow-lg">
      <Handle type="target" position={Position.Left} className="w-5 h-5 bg-emerald-500" />

      <div className="bg-emerald-50 px-3 py-2 border-b border-emerald-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mic size={16} className="text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-800">Enviar Áudio</span>
        </div>
        <button
          onClick={() => {
            if (confirm('Excluir este bloco de áudio?')) deleteElements({ nodes: [{ id }] });
          }}
          className="text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-700 transition-colors nodrag p-1 rounded-md"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="p-4 flex flex-col items-center gap-3">
        {/* RECORDING STATE */}
        {mode === 'recording' && (
          <div className="w-full flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-semibold text-red-600">
                Gravando&nbsp;&nbsp;{formatTime(recordingTime)}
              </span>
            </div>
            <div className="flex items-end gap-0.5 h-8">
              {WAVE_HEIGHTS.map((h, i) => (
                <div
                  key={i}
                  className="w-1.5 rounded-full bg-red-400 animate-pulse"
                  style={{ height: `${h}px`, animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>
            <button
              onClick={stopRecording}
              className="w-full py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded transition-colors flex items-center justify-center gap-2 nodrag"
            >
              <Square size={14} fill="currentColor" /> Parar Gravação
            </button>
          </div>
        )}

        {/* REVIEW STATE */}
        {mode === 'review' && (
          <div className="w-full space-y-3">
            <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded border border-emerald-100 text-xs text-emerald-700">
              <Music size={14} />
              <span className="font-medium">Gravação — {formatTime(recordingTime)}</span>
            </div>
            <audio {...audioPlayerProps} />
            <div className="flex gap-2">
              <button
                onClick={reRecord}
                className="flex-1 py-2 text-xs font-semibold text-emerald-700 border border-emerald-300 hover:bg-emerald-50 rounded transition-colors flex items-center justify-center gap-1 nodrag"
              >
                <RotateCcw size={12} /> Regravar
              </button>
              <button
                onClick={cancelRecording}
                className="flex-1 py-2 text-xs font-semibold text-gray-600 border border-gray-300 hover:bg-gray-50 rounded transition-colors flex items-center justify-center gap-1 nodrag"
              >
                <X size={12} /> Cancelar
              </button>
            </div>
            <button
              onClick={useRecordedAudio}
              disabled={isUploading}
              className="w-full py-2 text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 rounded transition-colors flex items-center justify-center gap-2 nodrag"
            >
              {isUploading ? (
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Check size={14} />
              )}
              Usar Este Áudio
            </button>
          </div>
        )}

        {/* IDLE STATE */}
        {mode === 'idle' && (
          <>
            {hasAudio ? (
              <div className="w-full space-y-3">
                <div className="relative flex items-center gap-2 p-2 bg-emerald-50 rounded border border-emerald-100 text-xs text-emerald-700">
                  <Music size={14} />
                  <span className="truncate flex-1 font-medium">
                    {data.fileName || 'áudio-selecionado.mp3'}
                  </span>
                  {isUploading && (
                    <div className="absolute inset-0 bg-emerald-50/80 flex items-center justify-center rounded">
                      <div className="w-3 h-3 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <audio {...audioPlayerProps} />
                <div className="flex gap-2">
                  <button
                    onClick={() => startRecording(true)}
                    className="flex-1 py-2 text-xs font-semibold text-emerald-600 border border-emerald-200 border-dashed hover:bg-emerald-50 rounded transition-colors flex items-center justify-center gap-1 nodrag"
                  >
                    <Mic size={12} /> Regravar
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-2 text-xs font-semibold text-emerald-600 border border-emerald-200 border-dashed hover:bg-emerald-50 rounded transition-colors flex items-center justify-center gap-1 nodrag"
                  >
                    <Upload size={12} /> Trocar
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full flex flex-col gap-2">
                <button
                  onClick={() => startRecording(true)}
                  className="w-full py-3 border-2 border-dashed border-emerald-200 rounded-lg flex items-center justify-center gap-2 cursor-pointer hover:bg-emerald-50/50 hover:border-emerald-400 transition-all text-emerald-700 font-semibold text-sm nodrag"
                >
                  <Mic size={16} /> Gravar Áudio
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 border-2 border-dashed border-emerald-200 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-emerald-50/50 hover:border-emerald-400 transition-all nodrag"
                >
                  <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                    <Upload size={16} /> Enviar Arquivo
                  </div>
                  <span className="text-[10px] text-emerald-500">MP3, WAV ou OGG</span>
                </button>
              </div>
            )}
          </>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileUpload}
          accept="audio/*"
          className="hidden"
        />
      </div>

      <Handle type="source" position={Position.Right} className="w-5 h-5 bg-emerald-500" />
    </div>
  );
});

AudioNode.displayName = 'AudioNode';
