import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ChatDraftState {
  drafts: Record<string, string>;
  setDraft: (customerId: string, text: string) => void;
  getDraft: (customerId: string) => string;
  clearDraft: (customerId: string) => void;
}

export const useChatDraftStore = create<ChatDraftState>()(
  persist(
    (set, get) => ({
      drafts: {},

      setDraft: (customerId: string, text: string) => {
        set((state) => ({
          drafts: { ...state.drafts, [customerId]: text },
        }));
      },

      getDraft: (customerId: string) => {
        return get().drafts[customerId] ?? '';
      },

      clearDraft: (customerId: string) => {
        set((state) => {
          const { [customerId]: _, ...rest } = state.drafts;
          return { drafts: rest };
        });
      },
    }),
    {
      name: 'fasterchat-drafts',
    }
  )
);
