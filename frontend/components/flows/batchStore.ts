import { create } from 'zustand';

export interface PreviewData {
  columns: string[];
  totalRows: number;
  detectedPhoneColumn: string | null;
  variableColumns: string[];
  preview: Record<string, any>[];
}

interface BatchState {
  file: File | null;
  preview: PreviewData | null;
  flowId: string | null;
  setFile: (file: File | null) => void;
  setPreview: (preview: PreviewData | null) => void;
  setFlowId: (flowId: string | null) => void;
  reset: () => void;
}

export const useBatchStore = create<BatchState>((set) => ({
  file: null,
  preview: null,
  flowId: null,
  setFile: (file) => set({ file }),
  setPreview: (preview) => set({ preview }),
  setFlowId: (flowId) => set({ flowId }),
  reset: () => set({ file: null, preview: null, flowId: null }),
}));
