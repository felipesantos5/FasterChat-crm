export type QuickMessageType = 'TEXT' | 'MEDIA' | 'AUDIO';

export interface QuickMessage {
  id: string;
  title: string;
  type: QuickMessageType;
  content: string;  // texto ou base64 de mídia/áudio
  caption?: string | null;
  createdAt: string;
}

export interface CreateQuickMessageData {
  title: string;
  type: QuickMessageType;
  content: string;
  caption?: string;
}

export interface UpdateQuickMessageData {
  title?: string;
  content?: string;
  caption?: string;
}
