"use client";

import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import api from "@/lib/api";

/**
 * Monitor global de disparos em massa.
 * Roda no layout do dashboard para tocar som e toast em qualquer página.
 * Não renderiza nada visualmente.
 */

const STORAGE_PREFIX = "flow_active_batch_";
const NOTIFIED_PREFIX = "flow_batch_notified_";
const POLL_INTERVAL_MS = 5000;

interface BatchStatusData {
  batchId: string;
  flowId?: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED" | "PAUSED";
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
}

function playCompletionSound(success: boolean) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (success) {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.14;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.28, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.start(t);
        osc.stop(t + 0.45);
      });
    } else {
      [440, 330].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.22;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.start(t);
        osc.stop(t + 0.5);
      });
    }
  } catch {
    // Web Audio não disponível
  }
}

export function GlobalBatchMonitor() {
  // Tracks which batches we already notified so we don't repeat
  const notifiedRef = useRef<Set<string>>(new Set());

  const checkBatches = useCallback(async () => {
    // Scan localStorage for active batch keys
    const activeBatches: { flowId: string; batchId: string }[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) {
          const flowId = key.replace(STORAGE_PREFIX, "");
          const batchId = localStorage.getItem(key);
          // Skip if already notified (by us or by BatchStatusButton)
          const alreadyNotified = localStorage.getItem(`${NOTIFIED_PREFIX}${batchId}`);
          if (batchId && !notifiedRef.current.has(batchId) && !alreadyNotified) {
            activeBatches.push({ flowId, batchId });
          }
        }
      }
    } catch {
      return;
    }

    if (activeBatches.length === 0) return;

    for (const { flowId, batchId } of activeBatches) {
      try {
        const res = await api.get(`/flows/${flowId}/batch/${batchId}`);
        const data: BatchStatusData = res.data;

        const finalStatuses = ["COMPLETED", "FAILED", "CANCELLED"];
        if (finalStatuses.includes(data.status)) {
          // Mark as notified so we don't repeat (in-memory + localStorage)
          notifiedRef.current.add(batchId);
          try { localStorage.setItem(`${NOTIFIED_PREFIX}${batchId}`, "1"); } catch {}

          if (data.status === "COMPLETED") {
            playCompletionSound(true);
            const failNote = data.failed > 0 ? ` (${data.failed} falhas)` : "";
            toast.success("🎉 Disparo concluído!", {
              description: `${data.succeeded} de ${data.total} contatos disparados com sucesso.${failNote}`,
              duration: 8000,
            });
          } else if (data.status === "FAILED") {
            playCompletionSound(false);
            toast.error("❌ Disparo falhou", {
              description: "Ocorreu um erro durante o disparo em massa.",
              duration: 8000,
            });
          }
          // CANCELLED: no sound/toast needed
        }
      } catch {
        // Batch not found or API error — mark as notified to stop retrying
        notifiedRef.current.add(batchId);
      }
    }
  }, []);

  useEffect(() => {
    // Initial check
    checkBatches();

    const interval = setInterval(checkBatches, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [checkBatches]);

  // Renders nothing
  return null;
}
