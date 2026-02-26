"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileSpreadsheet,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Phone,
  Tag,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useBatchStore } from "./batchStore";

interface FlowBatchUploadModalProps {
  open: boolean;
  onClose: () => void;
  flowId: string;
  flowName: string;
  onBatchStarted?: (batchId: string) => void;
}



interface BatchStatus {
  batchId: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ row: number; phone: string; error: string }>;
}

type Step = "upload" | "preview" | "executing" | "done";

export function FlowBatchUploadModal({
  open,
  onClose,
  flowId,
  flowName,
  onBatchStarted,
}: FlowBatchUploadModalProps) {
  const storeFile = useBatchStore((s) => s.file);
  const storePreview = useBatchStore((s) => s.preview);
  const setStoreFile = useBatchStore((s) => s.setFile);
  const setStorePreview = useBatchStore((s) => s.setPreview);

  const [step, setStep] = useState<Step>(storeFile && storePreview ? "preview" : "upload");
  const [loading, setLoading] = useState(false);
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Reset specific modal state when opens/closes, but KEEP file in store
  useEffect(() => {
    if (open) {
      if (storeFile && storePreview) {
        setStep("preview");
      } else {
        setStep("upload");
      }
    } else {
      const t = setTimeout(() => {
        setStep(storeFile && storePreview ? "preview" : "upload");
        setBatchStatus(null);
        setLoading(false);
        if (pollRef.current) clearInterval(pollRef.current);
      }, 200);
      return () => { clearTimeout(t); };
    }
    return undefined;
  }, [open, storeFile, storePreview]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleFileSelect = useCallback(
    async (selectedFile: File) => {
      setStoreFile(selectedFile);
      setLoading(true);

      try {
        const formData = new FormData();
        formData.append("file", selectedFile);

        const res = await api.post(
          `/flows/${flowId}/batch/preview`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );

        setStorePreview(res.data);
        setStoreFile(selectedFile);
        setStep("preview");
      } catch (err: any) {
        const msg =
          err.response?.data?.error || "Erro ao ler planilha.";
        toast.error(msg);
        setStoreFile(null);
        setStorePreview(null);
      } finally {
        setLoading(false);
      }
    },
    [flowId]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFileSelect(droppedFile);
    },
    [handleFileSelect]
  );

  const handleStartBatch = async () => {
    if (!storeFile) return;
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", storeFile);

      const res = await api.post(`/flows/${flowId}/batch`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const { batchId: newBatchId, total } = res.data;
      onBatchStarted?.(newBatchId);
      setBatchStatus({
        batchId: newBatchId,
        status: "PROCESSING",
        total,
        processed: 0,
        succeeded: 0,
        failed: 0,
        errors: [],
      });
      setStep("executing");

      // Start polling for status
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await api.get(
            `/flows/${flowId}/batch/${newBatchId}`
          );
          setBatchStatus(statusRes.data);

          if (
            statusRes.data.status === "COMPLETED" ||
            statusRes.data.status === "FAILED"
          ) {
            if (pollRef.current) clearInterval(pollRef.current);
            setStep("done");
          }
        } catch {
          // Ignore polling errors
        }
      }, 3000);
    } catch (err: any) {
      const msg =
        err.response?.data?.error || "Erro ao iniciar disparo.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const progressPercent = batchStatus
    ? Math.round((batchStatus.processed / batchStatus.total) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-primary" />
            Disparo em Massa
          </DialogTitle>
          <DialogDescription>
            Faça upload de uma planilha (CSV ou XLSX) para disparar o fluxo <strong>&quot;{flowName}&quot;</strong> para múltiplos contatos.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="py-4">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
            >
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={36} className="animate-spin text-primary" />
                  <p className="text-sm text-gray-500">Lendo planilha...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-primary/10 p-3 rounded-full">
                    <Upload size={28} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700">
                      Arraste um arquivo aqui ou clique para selecionar
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Formatos aceitos: CSV, XLSX, XLS (máx. 10MB)
                    </p>
                  </div>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />

            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700">
                <strong>⚡ Dica:</strong> A planilha deve ter uma coluna de telefone (phone, telefone, celular, etc.) e pode ter outras colunas com variáveis do fluxo. Cada linha será um disparo.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === "preview" && storePreview && (
          <div className="py-4 space-y-4">
            {/* File info */}
            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-primary" />
                <span className="text-sm font-medium text-gray-700 truncate max-w-[250px]">
                  {storeFile?.name}
                </span>
              </div>
              <button
                onClick={() => {
                  setStep("upload");
                  setStoreFile(null);
                  setStorePreview(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 flex items-center gap-2">
                <Users size={18} className="text-blue-600" />
                <div>
                  <p className="text-lg font-bold text-blue-800">
                    {storePreview.totalRows}
                  </p>
                  <p className="text-xs text-blue-600">Contatos</p>
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 flex items-center gap-2">
                <Phone size={18} className="text-green-600" />
                <div>
                  <p className="text-sm font-bold text-green-800 truncate">
                    {storePreview.detectedPhoneColumn || "Não detectado"}
                  </p>
                  <p className="text-xs text-green-600">Coluna de telefone</p>
                </div>
              </div>
            </div>

            {!storePreview.detectedPhoneColumn && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-700">
                  <strong>❌ Erro:</strong> Nenhuma coluna de telefone detectada. Renomeie uma coluna para: phone, telefone, celular, whatsapp ou numero.
                </p>
              </div>
            )}

            {/* Columns */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Colunas detectadas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {storePreview.columns.map((col: string) => (
                  <span
                    key={col}
                    className={`text-xs px-2 py-1 rounded-full font-medium ${col === storePreview.detectedPhoneColumn
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                      }`}
                  >
                    {col === storePreview.detectedPhoneColumn && "📱 "}
                    {col}
                  </span>
                ))}
              </div>
            </div>

            {/* Preview table */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Preview (primeiras linhas)
              </p>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      {storePreview.columns.map((col: string) => (
                        <th
                          key={col}
                          className="px-3 py-2 text-left font-semibold text-gray-600 border-b whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {storePreview.preview.map((row: any, i: number) => (
                      <tr key={i} className="border-b last:border-0">
                        {storePreview.columns.map((col: string) => (
                          <td
                            key={col}
                            className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[150px] truncate"
                          >
                            {String(row[col] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Estimated time */}
            <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-2">
              <Clock size={16} className="text-gray-500" />
              <p className="text-xs text-gray-600">
                Tempo estimado:{" "}
                <strong>
                  {Math.ceil((storePreview.totalRows * 10) / 60)} minutos
                </strong>{" "}
                (delay de 5-15s entre cada disparo para segurança)
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Executing */}
        {(step === "executing" || step === "done") && batchStatus && (
          <div className="py-4 space-y-4">
            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">
                  {step === "executing" ? "Disparando..." : "Concluído!"}
                </span>
                <span className="text-sm font-bold text-primary">
                  {progressPercent}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${step === "done"
                    ? batchStatus.failed > 0
                      ? "bg-amber-500"
                      : "bg-green-500"
                    : "bg-primary animate-pulse"
                    }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-blue-800">
                  {batchStatus.processed}/{batchStatus.total}
                </p>
                <p className="text-xs text-blue-600">Processados</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-green-800">
                  {batchStatus.succeeded}
                </p>
                <p className="text-xs text-green-600">Sucesso</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-red-800">
                  {batchStatus.failed}
                </p>
                <p className="text-xs text-red-600">Falhas</p>
              </div>
            </div>

            {/* Executing animation */}
            {step === "executing" && (
              <div className="flex items-center justify-center gap-2 py-2">
                <Loader2 size={18} className="animate-spin text-primary" />
                <span className="text-sm text-gray-500">
                  Disparando contato {batchStatus.processed + 1} de{" "}
                  {batchStatus.total}...
                </span>
              </div>
            )}

            {/* Done icon */}
            {step === "done" && (
              <div className="flex flex-col items-center gap-2 py-2">
                {batchStatus.failed === 0 ? (
                  <CheckCircle2 size={36} className="text-green-500" />
                ) : (
                  <XCircle size={36} className="text-amber-500" />
                )}
                <p className="text-sm font-semibold text-gray-700">
                  {batchStatus.failed === 0
                    ? "Todos os disparos foram realizados com sucesso!"
                    : `${batchStatus.succeeded} disparos OK, ${batchStatus.failed} falhas`}
                </p>
              </div>
            )}

            {/* Error list */}
            {batchStatus.errors.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-600 mb-2">
                  Falhas ({batchStatus.errors.length}):
                </p>
                <div className="max-h-32 overflow-y-auto border border-red-100 rounded-lg">
                  {batchStatus.errors.map((err, i) => (
                    <div
                      key={i}
                      className="px-3 py-2 text-xs border-b border-red-50 last:border-0"
                    >
                      <span className="text-red-600 font-medium">
                        Linha {err.row}
                      </span>{" "}
                      ({err.phone}):{" "}
                      <span className="text-gray-600">{err.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setStep("upload");
                  setStoreFile(null);
                  setStorePreview(null);
                }}
              >
                Voltar
              </Button>
              <Button
                onClick={handleStartBatch}
                disabled={loading || !storePreview?.detectedPhoneColumn}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-2" />
                    Iniciando...
                  </>
                ) : (
                  <>
                    <Upload size={16} className="mr-2" />
                    Disparar para {storePreview?.totalRows} contatos
                  </>
                )}
              </Button>
            </>
          )}
          {step === "executing" && (
            <p className="text-xs text-gray-400 w-full text-center">
              Não feche esta janela. O disparo continua em background no servidor.
            </p>
          )}
          {step === "done" && (
            <Button onClick={onClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
