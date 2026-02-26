"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import api from "@/lib/api";

interface BatchStatusData {
  batchId: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ row: number; phone: string; error: string }>;
  startedAt: string;
  completedAt: string | null;
}

interface BatchStatusButtonProps {
  flowId: string;
  activeBatchId: string | null;
}

const STORAGE_KEY = "flow_active_batch";

function getStoredBatch(flowId: string): string | null {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}_${flowId}`);
    return stored || null;
  } catch {
    return null;
  }
}

function storeBatch(flowId: string, batchId: string) {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${flowId}`, batchId);
  } catch {
    // ignore
  }
}

function clearStoredBatch(flowId: string) {
  try {
    localStorage.removeItem(`${STORAGE_KEY}_${flowId}`);
  } catch {
    // ignore
  }
}

export function BatchStatusButton({ flowId, activeBatchId }: BatchStatusButtonProps) {
  const [batchId, setBatchId] = useState<string | null>(null);
  const [status, setStatus] = useState<BatchStatusData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize from prop or localStorage
  useEffect(() => {
    const stored = getStoredBatch(flowId);
    if (activeBatchId) {
      setBatchId(activeBatchId);
      storeBatch(flowId, activeBatchId);
      setVisible(true);
    } else if (stored) {
      setBatchId(stored);
      setVisible(true);
    }
  }, [activeBatchId, flowId]);

  // Poll for status
  const fetchStatus = useCallback(async () => {
    if (!batchId) return;
    try {
      const res = await api.get(`/flows/${flowId}/batch/${batchId}`);
      setStatus(res.data);

      if (res.data.status === "COMPLETED" || res.data.status === "FAILED") {
        // Stop polling
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        // Auto-hide after 5 minutes
        hideTimerRef.current = setTimeout(() => {
          setVisible(false);
          clearStoredBatch(flowId);
        }, 5 * 60 * 1000);
      }
    } catch {
      // Batch not found, clear
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      clearStoredBatch(flowId);
      setVisible(false);
    }
  }, [batchId, flowId]);

  useEffect(() => {
    if (!batchId) return;

    // Initial fetch
    fetchStatus();

    // Start polling every 3s
    pollRef.current = setInterval(fetchStatus, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [batchId, fetchStatus]);

  if (!visible || !batchId) return null;

  const isProcessing = !status || status.status === "PROCESSING";
  const isCompleted = status?.status === "COMPLETED";
  const isFailed = status?.status === "FAILED";
  const progressPercent = status
    ? Math.round((status.processed / status.total) * 100)
    : 0;

  // Estimate remaining time: avg 10s per contact
  const remaining = status ? status.total - status.processed : 0;
  const estimatedSecsLeft = remaining * 10;

  const formatTime = (totalSecs: number) => {
    if (totalSecs <= 0) return "0s";
    const mins = Math.floor(totalSecs / 60);
    const secs = Math.round(totalSecs % 60);
    if (mins === 0) return `${secs}s`;
    return `${mins}min ${secs}s`;
  };

  const elapsed = status?.startedAt
    ? Math.round((Date.now() - new Date(status.startedAt).getTime()) / 1000)
    : 0;

  return (
    <>
      {/* Compact header button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all border shadow-sm ${isProcessing
          ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
          : isCompleted && status?.failed === 0
            ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
            : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
          }`}
      >
        {isProcessing ? (
          <Loader2 size={14} className="animate-spin" />
        ) : isCompleted && status?.failed === 0 ? (
          <CheckCircle2 size={14} />
        ) : (
          <AlertTriangle size={14} />
        )}

        <span>
          {isProcessing
            ? `Enviando ${status?.processed ?? 0}/${status?.total ?? "..."}`
            : isCompleted
              ? `✅ ${status.succeeded}/${status.total} concluído`
              : `⚠️ Falha no disparo`}
        </span>

        {isProcessing && status && (
          <div className="w-12 h-1.5 bg-blue-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </button>

      {/* Detail modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity size={20} className="text-primary" />
              Status do Disparo em Massa
            </DialogTitle>
          </DialogHeader>

          {status ? (
            <div className="space-y-4 py-2">
              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">
                    {isProcessing ? "Disparando..." : isCompleted ? "Concluído!" : "Falha"}
                  </span>
                  <span className="text-sm font-bold text-primary">
                    {progressPercent}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${isCompleted
                      ? status.failed > 0
                        ? "bg-amber-500"
                        : "bg-green-500"
                      : isFailed
                        ? "bg-red-500"
                        : "bg-primary animate-pulse"
                      }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Stats cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-blue-800">
                    {status.processed}/{status.total}
                  </p>
                  <p className="text-xs text-blue-600">Processados</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-green-800">
                    {status.succeeded}
                  </p>
                  <p className="text-xs text-green-600">Sucesso</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-red-800">
                    {status.failed}
                  </p>
                  <p className="text-xs text-red-600">Falhas</p>
                </div>
              </div>

              {/* Time info */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-gray-500" />
                  <span className="text-xs text-gray-600">
                    Tempo decorrido: <strong>{formatTime(elapsed)}</strong>
                  </span>
                </div>
                {isProcessing && (
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-blue-500" />
                    <span className="text-xs text-blue-600">
                      Tempo restante estimado:{" "}
                      <strong>~{formatTime(estimatedSecsLeft)}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Processing indicator */}
              {isProcessing && (
                <div className="flex items-center justify-center gap-2 py-1">
                  <Loader2 size={16} className="animate-spin text-primary" />
                  <span className="text-sm text-gray-500">
                    Disparando contato {status.processed + 1} de {status.total}...
                  </span>
                </div>
              )}

              {/* Done indicator */}
              {(isCompleted || isFailed) && (
                <div className="flex flex-col items-center gap-2 py-1">
                  {isCompleted && status.failed === 0 ? (
                    <CheckCircle2 size={32} className="text-green-500" />
                  ) : (
                    <XCircle size={32} className="text-amber-500" />
                  )}
                  <p className="text-sm font-semibold text-gray-700">
                    {isCompleted && status.failed === 0
                      ? "Todos os disparos foram realizados com sucesso!"
                      : `${status.succeeded} disparos OK, ${status.failed} falhas`}
                  </p>
                </div>
              )}

              {/* Error list */}
              {status.errors.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-600 mb-2">
                    Falhas ({status.errors.length}):
                  </p>
                  <div className="max-h-32 overflow-y-auto border border-red-100 rounded-lg">
                    {status.errors.map((err, i) => (
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
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-primary" />
              <span className="ml-2 text-sm text-gray-500">Carregando status...</span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
