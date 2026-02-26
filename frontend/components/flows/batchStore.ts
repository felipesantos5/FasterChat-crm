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
  setFile: (file: File | null) => void;
  setPreview: (preview: PreviewData | null) => void;
  reset: () => void;
}

export const useBatchStore = create<BatchState>((set) => ({
  file: null,
  preview: null,
  setFile: (file) => set({ file }),
  setPreview: (preview) => set({ preview }),
  reset: () => set({ file: null, preview: null }),
}));
