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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Ban,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useBatchStore } from "./batchStore";
import { whatsappApi } from "@/lib/whatsapp";

interface FlowBatchUploadModalProps {
  open: boolean;
  onClose: () => void;
  flowId: string;
  flowName: string;
  onBatchStarted?: (batchId: string) => void;
}



interface BatchStatus {
  batchId: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
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
  const storeFlowId = useBatchStore((s) => s.flowId);
  const setStoreFile = useBatchStore((s) => s.setFile);
  const setStorePreview = useBatchStore((s) => s.setPreview);
  const setStoreFlowId = useBatchStore((s) => s.setFlowId);
  const resetStore = useBatchStore((s) => s.reset);

  const [step, setStep] = useState<Step>(storeFile && storePreview && storeFlowId === flowId ? "preview" : "upload");
  const [loading, setLoading] = useState(false);
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [connectedInstances, setConnectedInstances] = useState(1);

  // Janela de envio por fuso horário

  // Carrega contagem de instâncias conectadas para estimativa de tempo
  useEffect(() => {
    if (!open) return;
    try {
      const companyId = JSON.parse(localStorage.getItem("user") || "{}").companyId;
      if (!companyId) return;
      whatsappApi.getInstances(companyId).then((res) => {
        const count = res.data.filter((i: { status: string }) => i.status === "CONNECTED").length;
        setConnectedInstances(Math.max(1, count));
      }).catch(() => {});
    } catch { /* silently ignore */ }
  }, [open]);

  // Quando o flowId muda (navegou para outro fluxo), limpa o store imediatamente
  useEffect(() => {
    if (storeFlowId !== null && storeFlowId !== flowId) {
      resetStore();
    }
  }, [flowId, storeFlowId, resetStore]);

  // Gerencia estado do modal ao abrir/fechar
  useEffect(() => {
    if (open) {
      // Garante que o store está vinculado a este fluxo
      if (storeFlowId !== null && storeFlowId !== flowId) {
        resetStore();
        setStep("upload");
      } else if (storeFile && storePreview) {
        setStep("preview");
      } else {
        setStep("upload");
      }
      setStoreFlowId(flowId);
    } else {
      setBatchStatus(null);
      setLoading(false);
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [open, flowId, storeFile, storePreview, storeFlowId, resetStore, setStoreFlowId]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleFileSelect = useCallback(
    async (selectedFile: File) => {
      if (!selectedFile) return;

      const MAX_MB = 10;
      const MAX_SIZE = MAX_MB * 1024 * 1024;

      if (selectedFile.size > MAX_SIZE) {
        toast.error(`O tamanho máximo permitido para a planilha é de ${MAX_MB}MB. Por favor, escolha um arquivo menor.`);
        return;
      }

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
        let msg = err.response?.data?.error || "Erro ao ler planilha.";
        if (msg.includes('too large') || err.response?.status === 413) {
          msg = "O arquivo selecionado é muito grande. O limite máximo é de 10MB.";
        }
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
            statusRes.data.status === "FAILED" ||
            statusRes.data.status === "CANCELLED"
          ) {
            if (pollRef.current) clearInterval(pollRef.current);
            setStep("done");
          }
        } catch {
          // Ignore polling errors
        }
      }, 3000);
    } catch (err: any) {
      let msg = err.response?.data?.error || "Erro ao iniciar disparo.";
      if (msg.includes('too large') || err.response?.status === 413) {
        msg = "O arquivo enviado é muito grande. O limite máximo é de 10MB.";
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const progressPercent = batchStatus
    ? Math.round((batchStatus.processed / batchStatus.total) * 100)
    : 0;

  const handleCancelBatch = async () => {
    if (!batchStatus?.batchId) return;
    setIsCanceling(true);
    try {
      await api.post(`/flows/${flowId}/batch/${batchStatus.batchId}/cancel`);

      setBatchStatus((prev) => prev ? { ...prev, status: "CANCELLED" } : null);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      setStep("done");
      setIsCancelModalOpen(false);
      toast.success("Envios cancelados com sucesso.");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Erro ao cancelar envios");
      console.error("Erro ao cancelar disparos em massa:", error);
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className={`max-h-[85vh] overflow-y-auto transition-all duration-300 ${(storePreview?.columns?.length ?? 0) > 4 ? 'sm:max-w-[1100px]' : 'sm:max-w-[560px]'}`}>
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
              {(() => {
                // Gap por instância: 35-60s (média 47.5s). Com N instâncias em round-robin,
                // o tempo total é dividido por N.
                const AVG_GAP_S = 47.5;
                const totalSeconds = (storePreview.totalRows * AVG_GAP_S) / connectedInstances;
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.ceil((totalSeconds % 3600) / 60);
                const timeLabel = hours > 0
                  ? `${hours}h ${minutes > 0 ? `${minutes}min` : ""}`.trim()
                  : `${Math.max(1, minutes)} min`;
                return (
                  <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-2">
                    <Clock size={16} className="text-gray-500" />
                    <p className="text-xs text-gray-600">
                      Tempo estimado:{" "}
                      <strong>{timeLabel}</strong>
                      {connectedInstances > 1 && (
                        <span className="text-gray-400 ml-1">({connectedInstances} instâncias)</span>
                      )}
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Step 3: Executing */}
          {(step === "executing" || step === "done") && batchStatus && (
            <div className="py-4 space-y-4">
              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">
                    {step === "executing" ? "Disparando..." : batchStatus.status === "CANCELLED" ? "Cancelado" : "Concluído!"}
                  </span>
                  <span className="text-sm font-bold text-primary">
                    {progressPercent}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${step === "done"
                      ? batchStatus.status === "CANCELLED"
                        ? "bg-red-500"
                        : batchStatus.failed > 0
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
                <div className="flex flex-col items-center justify-center gap-4 py-2">
                  <div className="flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin text-primary" />
                    <span className="text-sm text-gray-500">
                      Disparando contato {Math.min(batchStatus.processed + 1, batchStatus.total)} de{" "}
                      {batchStatus.total}...
                    </span>
                  </div>
                  <div className="w-full p-3 bg-blue-50 border border-blue-100 rounded-lg text-center">
                    <p className="text-sm text-blue-700">
                      <strong>ℹ️ Aviso:</strong> Você pode fechar esta aba. O envio das mensagens irá continuar em segundo plano.
                    </p>
                  </div>
                </div>
              )}

              {/* Cancel Button */}
              {step === "executing" && (
                <div className="mt-4 flex justify-center border-t border-gray-100 pt-4">
                  <button
                    onClick={() => setIsCancelModalOpen(true)}
                    className="flex items-center gap-2 text-red-500 hover:text-red-700 text-sm font-medium transition-colors p-2 rounded-md hover:bg-red-50"
                  >
                    <Ban size={16} />
                    Cancelar Envios
                  </button>
                </div>
              )}

              {/* Done icon */}
              {step === "done" && (
                <div className="flex flex-col items-center gap-2 py-2">
                  {batchStatus.status === "CANCELLED" ? (
                    <Ban size={36} className="text-red-500" />
                  ) : batchStatus.failed === 0 ? (
                    <CheckCircle2 size={36} className="text-green-500" />
                  ) : (
                    <XCircle size={36} className="text-amber-500" />
                  )}
                  <p className="text-sm font-semibold text-gray-700">
                    {batchStatus.status === "CANCELLED"
                      ? "Os disparos foram cancelados pelo usuário."
                      : batchStatus.failed === 0
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
            {step === "done" && (
              <Button onClick={onClose}>Fechar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Envios em Massa?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar os envios deste lote? Os contatos já
              processados não poderão ser revertidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCanceling}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={(e) => {
                e.preventDefault();
                handleCancelBatch();
              }}
              disabled={isCanceling}
            >
              {isCanceling ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Cancelando...
                </>
              ) : (
                "Sim, Cancelar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
