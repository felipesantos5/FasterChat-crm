"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Message, MessageDirection, SenderType, MessageStatus } from "@/types/message";
import { Conversation } from "@/types/conversation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { api } from "@/lib/api";
import { messageApi } from "@/lib/message";
import { conversationApi } from "@/lib/conversation";
import { whatsappApi } from "@/lib/whatsapp";
import { aiKnowledgeApi } from "@/lib/ai-knowledge";
import { conversationExampleApi } from "@/lib/conversation-example";
import { showErrorToast } from "@/lib/error-handler";
import { Send, Loader2, MessageSquare, Bot, User as UserIcon, Star, PanelRightOpen, Plus, X, ImageIcon, Smile, Mic, Check, CheckCheck, ChevronDown, Pencil, Download, ZoomIn, Archive, ArchiveRestore, Zap, Square, Trash2, Reply } from "lucide-react";
import { cn, formatPhoneNumber } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { MessageFeedbackComponent } from "@/components/chat/message-feedback";
import { AudioPlayer } from "@/components/chat/audio-player";
import { MessageText } from "@/components/chat/message-text";
import { useWebSocket } from "@/hooks/useWebSocket";
import { toast } from "sonner";
import { ChatAreaSkeleton } from "@/components/ui/skeletons";

interface ChatAreaProps {
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerProfilePic?: string | null;
  onToggleDetails?: () => void;
  showDetailsButton?: boolean;
  onMarkAsRead?: () => void;
  isArchived?: boolean;
  onArchive?: () => void;
  onUnarchive?: () => void;
}

export function ChatArea({ customerId, customerName, customerPhone, customerProfilePic, onToggleDetails, showDetailsButton, onMarkAsRead, isArchived, onArchive, onUnarchive }: ChatAreaProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [togglingAi, setTogglingAi] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isExample, setIsExample] = useState(false);
  const [showExampleModal, setShowExampleModal] = useState(false);
  const [exampleNotes, setExampleNotes] = useState("");
  const [markingExample, setMarkingExample] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageCaption, setImageCaption] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [showImageTooLargeModal, setShowImageTooLargeModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isContactOnline, setIsContactOnline] = useState(false);
  const [whatsappInstanceId, setWhatsappInstanceId] = useState<string | null>(null);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false); // começa false até confirmar config global
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; type: "image" | "video" } | null>(null);
  const [activeFlowExecution, setActiveFlowExecution] = useState<{ id: string; flow: { id: string; name: string }; status: string } | null>(null);
  const [cancellingFlow, setCancellingFlow] = useState(false);
  const [reactionPickerId, setReactionPickerId] = useState<string | null>(null);
  const [sendingReactionId, setSendingReactionId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  // Handler para novas mensagens via WebSocket
  const handleWebSocketMessage = useCallback(
    (message: any) => {
      // Verifica se a mensagem é para este cliente
      if (message.customerId === customerId) {
        console.log("📩 Nova mensagem WebSocket recebida:", message);

        setMessages((prev) => {
          // Evita duplicatas
          const exists = prev.some((m) => m.id === message.id);
          if (exists) return prev;
          return [...prev, message];
        });

        // Se o usuário está com a conversa aberta, marca mensagem inbound como lida imediatamente
        if (message.direction === MessageDirection.INBOUND && message.whatsappInstanceId) {
          messageApi.markAsRead({ customerId, whatsappInstanceId: message.whatsappInstanceId })
            .then(() => onMarkAsRead?.())
            .catch(() => { });
        }

        // Se foi mensagem do cliente, marca IA como processando
        if (message.direction === MessageDirection.INBOUND && conversation?.aiEnabled && autoReplyEnabled) {
          setAiProcessing(true);
          // Remove indicador após 30 segundos
          setTimeout(() => setAiProcessing(false), 30000);
        }

        // Se foi resposta da IA, remove indicador
        if (message.direction === MessageDirection.OUTBOUND && message.senderType === SenderType.AI) {
          setAiProcessing(false);
          setIsTyping(false);
        }
      }
    },
    [customerId, conversation?.aiEnabled, autoReplyEnabled]
  );

  // Handler para atualizações de conversa via WebSocket
  const handleWebSocketConversationUpdate = useCallback(
    (update: any) => {
      if (update.customerId === customerId) {
        console.log("🔄 Atualização de conversa WebSocket recebida:", update);
        setConversation((prev) => (prev ? { ...prev, ...update } : null));

        // Se a IA foi desativada (transbordo), limpa os indicadores
        if (update.aiEnabled === false) {
          console.log("🚨 IA desativada via WebSocket - limpando indicadores");
          setIsTyping(false);
          setAiProcessing(false);
        }
      }
    },
    [customerId]
  );

  // Handler para indicador de digitação - só processa se IA estiver habilitada
  const handleWebSocketTyping = useCallback(
    (data: any) => {
      if (data.customerId === customerId && conversation?.aiEnabled && autoReplyEnabled) {
        console.log("⌨️ Indicador de digitação:", data.isTyping);
        setIsTyping(data.isTyping);
      }
    },
    [customerId, conversation?.aiEnabled, autoReplyEnabled]
  );

  // Handler para atualização de status de mensagem
  const handleWebSocketMessageStatus = useCallback(
    (data: { messageId: string; status: MessageStatus; timestamp: Date }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId ? { ...msg, status: data.status } : msg
        )
      );
    },
    []
  );

  // Handler para mensagem editada via WebSocket (outro tab ou outro usuário)
  const handleWebSocketMessageEdited = useCallback(
    (data: { messageId: string; newContent: string; customerId: string }) => {
      if (data.customerId === customerId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.messageId ? { ...msg, content: data.newContent } : msg
          )
        );
      }
    },
    [customerId]
  );

  // Handler para mensagem deletada via WebSocket
  const handleWebSocketMessageDeleted = useCallback(
    (data: { messageId: string; customerId: string }) => {
      if (data.customerId === customerId) {
        setMessages((prev) => prev.filter((msg) => msg.id !== data.messageId));
      }
    },
    [customerId]
  );

  // WebSocket - usa hook diretamente para ter controle dos eventos
  const { isConnected, isAuthenticated, subscribeToConversation, unsubscribeFromConversation } = useWebSocket({
    autoConnect: true,
    onNewMessage: handleWebSocketMessage,
    onConversationUpdate: handleWebSocketConversationUpdate,
    onTyping: handleWebSocketTyping,
    onMessageStatus: handleWebSocketMessageStatus,
    onMessageEdited: handleWebSocketMessageEdited,
    onMessageDeleted: handleWebSocketMessageDeleted,
  });

  // Obtém companyId do usuário logado
  const getCompanyId = () => {
    const user = localStorage.getItem("user");
    if (user) {
      const userData = JSON.parse(user);
      return userData.companyId;
    }
    return null;
  };

  // Carrega conversa
  const loadConversation = async () => {
    try {
      const companyId = getCompanyId();
      if (!companyId) return;

      const response = await conversationApi.getConversation(customerId, companyId);
      setConversation(response.data);
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  };

  // Carrega mensagens
  const loadMessages = async () => {
    try {
      const response = await messageApi.getCustomerMessages(customerId, 100);
      // Backend já retorna ordenado por timestamp ascendente (cronologia correta)
      const messages = response.data.messages;

      // Marca mensagens como lidas (fire-and-forget)
      const msgWithInstance = messages.find((m) => m.whatsappInstanceId);
      if (msgWithInstance?.whatsappInstanceId) {
        messageApi.markAsRead({ customerId, whatsappInstanceId: msgWithInstance.whatsappInstanceId })
          .then(() => onMarkAsRead?.())
          .catch(() => {/* não crítico */ });
      }

      // Verifica se há mensagem recente do cliente sem resposta da IA
      const lastMessage = messages[messages.length - 1];
      if (conversation?.aiEnabled && autoReplyEnabled && lastMessage?.direction === MessageDirection.INBOUND) {
        // Verifica se há resposta da IA depois dessa mensagem
        const hasAiResponse = messages.some(
          (msg, idx) => idx > messages.length - 1 && msg.direction === MessageDirection.OUTBOUND && msg.senderType === SenderType.AI
        );
        setAiProcessing(!hasAiResponse && Date.now() - new Date(lastMessage.timestamp).getTime() < 30000);
      } else {
        setAiProcessing(false);
      }

      setMessages(messages);
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setLoading(false);
    }
  };

  // Verifica se a conversa está marcada como exemplo
  const checkIsExample = async () => {
    if (!conversation?.id) return;
    try {
      const response = await conversationExampleApi.isExample(conversation.id);
      setIsExample(response.data.isExample);
    } catch (error) {
      console.error("Error checking if is example:", error);
    }
  };

  // Carrega dados iniciais e configura WebSocket
  useEffect(() => {
    loadConversation();
    loadMessages();

    // Se o WebSocket estiver autenticado, inscreve-se na conversa
    if (isAuthenticated && customerId) {
      console.log("🔌 Inscrevendo-se na conversa:", customerId);
      subscribeToConversation(customerId);

      return () => {
        console.log("🔌 Desinscrevendo-se da conversa:", customerId);
        unsubscribeFromConversation(customerId);
      };
    }
    return undefined;
  }, [customerId, isAuthenticated, subscribeToConversation, unsubscribeFromConversation]);

  useEffect(() => {
    if (conversation?.id) {
      checkIsExample();
    }
  }, [conversation?.id]);

  // Carrega execução de fluxo ativa para o customer
  useEffect(() => {
    const fetchActiveExecution = async () => {
      try {
        const res = await api.get(`/flows/customer/${customerId}/active-execution`);
        setActiveFlowExecution(res.data.execution || null);
      } catch {
        setActiveFlowExecution(null);
      }
    };
    fetchActiveExecution();
  }, [customerId]);

  // Carrega configuração global de resposta automática
  useEffect(() => {
    const companyId = getCompanyId();
    if (!companyId) return;
    aiKnowledgeApi.getKnowledge(companyId)
      .then((data) => setAutoReplyEnabled(data.autoReplyEnabled === true))
      .catch(() => {/* mantém false — mais seguro que mostrar IA ativa por engano */ });
  }, []);

  // Scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Extrai whatsappInstanceId das mensagens
  useEffect(() => {
    if (messages.length > 0 && !whatsappInstanceId) {
      // Pega a instância da primeira mensagem que tiver
      const msgWithInstance = messages.find((m) => m.whatsappInstanceId);
      if (msgWithInstance) {
        setWhatsappInstanceId(msgWithInstance.whatsappInstanceId);
      }
    }
  }, [messages, whatsappInstanceId]);

  // Polling de presença do contato a cada 1 minuto
  useEffect(() => {
    if (!whatsappInstanceId || !customerPhone) return;

    const checkPresence = async () => {
      try {
        const response = await whatsappApi.getContactPresence(whatsappInstanceId, customerPhone);
        setIsContactOnline(response.data.isOnline);
      } catch (error) {
        // Silently fail - não quebra a UX se não conseguir verificar presença
        setIsContactOnline(false);
      }
    };

    // Verifica imediatamente ao abrir a conversa
    checkPresence();

    // Polling a cada 1 minuto
    const interval = setInterval(checkPresence, 60000);

    return () => clearInterval(interval);
  }, [whatsappInstanceId, customerPhone]);

  // Focus no input ao carregar
  useEffect(() => {
    inputRef.current?.focus();
  }, [customerId]);

  // Fecha lightbox com Escape
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const handleDownload = async (url: string, type: "image" | "video") => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = type === "image" ? "imagem.jpg" : "video.mp4";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  const EDIT_WINDOW_MS = 15 * 60 * 1000;

  const canEditMessage = (message: Message) =>
    message.direction === MessageDirection.OUTBOUND &&
    message.senderType === SenderType.HUMAN &&
    message.mediaType === "text" &&
    !!message.messageId &&
    Date.now() - new Date(message.timestamp).getTime() < EDIT_WINDOW_MS;

  const startEdit = (message: Message) => {
    setEditingMessageId(message.id);
    setEditingContent(message.content);
    setOpenMenuId(null);
    setTimeout(() => {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }, 0);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent("");
  };

  const saveEdit = async (messageId: string) => {
    if (!editingContent.trim() || savingEdit) return;
    setSavingEdit(true);
    try {
      await messageApi.editMessage(messageId, editingContent.trim());
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content: editingContent.trim() } : m))
      );
      cancelEdit();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível editar a mensagem");
    } finally {
      setSavingEdit(false);
    }
  };

  const DELETE_WINDOW_MS = 48 * 60 * 60 * 1000; // Janela típica do WhatsApp (48h)

  const canDeleteMessage = (message: Message) =>
    message.direction === MessageDirection.OUTBOUND &&
    !!message.messageId &&
    Date.now() - new Date(message.timestamp).getTime() < DELETE_WINDOW_MS;

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Tem certeza que deseja apagar esta mensagem para todos?")) return;

    try {
      await messageApi.deleteMessage(messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      toast.success("Mensagem apagada com sucesso!");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível apagar a mensagem");
    } finally {
      setOpenMenuId(null);
    }
  };

  const handleSendReaction = async (messageId: string, emoji: string) => {
    setSendingReactionId(messageId);
    setReactionPickerId(null);
    try {
      await messageApi.sendReaction(messageId, emoji);
    } catch {
      toast.error("Não foi possível enviar a reação");
    } finally {
      setSendingReactionId(null);
    }
  };

  // Envia mensagem
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim() || sending) return;

    const messageContent = inputValue.trim();
    const quotedId = replyingTo?.id;
    setInputValue("");
    setReplyingTo(null);
    setSending(true);

    try {
      const response = await messageApi.sendMessage(customerId, messageContent, "HUMAN", quotedId);

      // Adiciona a mensagem apenas se não estiver conectado ao WebSocket
      // Se estiver conectado, o WebSocket vai trazer a mensagem automaticamente
      if (!isConnected || !isAuthenticated) {
        setMessages((prev) => {
          // Evita duplicatas verificando pelo ID
          const exists = prev.some((m) => m.id === response.data.message.id);
          if (exists) return prev;
          return [...prev, response.data.message];
        });
      }
    } catch (error: any) {
      showErrorToast(error, router, "Erro ao enviar mensagem");
      setInputValue(messageContent); // Restaura o texto
    } finally {
      setSending(false);
      // Restaura o foco no input após enviar
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  // Processa arquivo de imagem
  const processImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione apenas arquivos de imagem.");
      return;
    }

    // Limite de 5MB (limite do WhatsApp para imagens)
    if (file.size > 5 * 1024 * 1024) {
      setShowImageTooLargeModal(true);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handler para seleção de arquivo
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    // Limpa o input para permitir selecionar o mesmo arquivo novamente
    e.target.value = "";
  };

  // Handler para colar imagem do clipboard (Ctrl+V)
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          processImageFile(file);
        }
        break;
      }
    }
  }, []);

  // Fecha o picker de reação ao clicar fora
  useEffect(() => {
    if (!reactionPickerId) return;
    const handler = () => setReactionPickerId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [reactionPickerId]);

  // Adiciona listener de paste no documento
  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [handlePaste]);

  // Handlers de drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  // Envia imagem
  const handleSendImage = async () => {
    if (!selectedImage || sending) return;

    setSending(true);

    try {
      const response = await messageApi.sendMedia(customerId, selectedImage, imageCaption || undefined, "HUMAN");

      // Adiciona a mensagem apenas se não estiver conectado ao WebSocket
      // Se estiver conectado, o WebSocket vai trazer a mensagem automaticamente
      if (!isConnected || !isAuthenticated) {
        setMessages((prev) => {
          // Evita duplicatas verificando pelo ID
          const exists = prev.some((m) => m.id === response.data.message.id);
          if (exists) return prev;
          return [...prev, response.data.message];
        });
      }

      // Limpa a imagem selecionada
      setSelectedImage(null);
      setImageCaption("");

      toast.success("Imagem enviada com sucesso!");
    } catch (error: any) {
      showErrorToast(error, router, "Erro ao enviar imagem");
    } finally {
      setSending(false);
      // Restaura o foco no input após enviar
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  // Cancela seleção de imagem
  const handleCancelImage = () => {
    setSelectedImage(null);
    setImageCaption("");
  };

  // Insere emoji no input
  const handleEmojiSelect = (emoji: string) => {
    setInputValue((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  // 50 emojis mais usados organizados por categoria
  const emojis = {
    faces: ["😊", "😂", "🤣", "😅", "😁", "😉", "😍", "🥰", "😘", "😋", "😎", "🤔", "😐", "😑", "😶", "🙄", "😬", "😮", "😯", "😴", "😔", "😕", "🙁", "😞", "😢", "😭"],
    business: ["🚀", "✅", "✔️", "❌", "⚠️", "🔥", "💰", "💸", "🤝", "💎", "🎯", "📈", "⭐", "🔔", "📍", "📅", "⏰", "📧"],
    hands: ["👍", "👎", "👏", "🙌", "👋", "🤝", "🙏", "✌️", "🤞", "🤙", "👌", "🤌", "✊", "👊"],
    hearts: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎"],
  };

  // Inicia gravação de áudio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          await handleSendAudio(base64Audio);
        };

        // Para o stream
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);

      // Inicia contador de tempo
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast.success("Gravação iniciada");
    } catch (error) {
      console.error("Erro ao iniciar gravação:", error);
      toast.error("Erro ao acessar microfone. Verifique as permissões.");
    }
  };

  // Para gravação
  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  // Cancela gravação
  const cancelRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setMediaRecorder(null);
      setIsRecording(false);
      setRecordingTime(0);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      toast.info("Gravação cancelada");
    }
  };

  // Envia áudio
  const handleSendAudio = async (base64Audio: string) => {
    setSending(true);
    try {
      const response = await messageApi.sendMedia(customerId, base64Audio, undefined, "HUMAN");

      if (!isConnected || !isAuthenticated) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === response.data.message.id);
          if (exists) return prev;
          return [...prev, response.data.message];
        });
      }

      toast.success("Áudio enviado com sucesso!");
    } catch (error: any) {
      showErrorToast(error, router, "Erro ao enviar áudio");
    } finally {
      setSending(false);
      setRecordingTime(0);
      // Restaura o foco no input após enviar
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  // Formata tempo de gravação
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Toggle IA
  const handleToggleAi = async () => {
    try {
      setTogglingAi(true);
      const newAiState = !conversation?.aiEnabled;
      await conversationApi.toggleAI(customerId, newAiState);
      await loadConversation();

      // Se desligou a IA, limpa os indicadores de processamento
      if (!newAiState) {
        setAiProcessing(false);
        setIsTyping(false);
      }

      toast.success(newAiState ? "IA ativada com sucesso!" : "IA desativada com sucesso!");
    } catch (error: any) {
      console.error("Error toggling AI:", error);
      toast.error(error.response?.data?.message || "Erro ao alterar estado da IA");
    } finally {
      setTogglingAi(false);
    }
  };

  const handleCancelFlow = async () => {
    if (!activeFlowExecution) return;
    try {
      setCancellingFlow(true);
      await api.delete(`/flows/executions/${activeFlowExecution.id}/cancel`);
      setActiveFlowExecution(null);
      toast.success("Fluxo cancelado com sucesso!");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Erro ao cancelar fluxo");
    } finally {
      setCancellingFlow(false);
    }
  };

  // Abre modal para marcar como exemplo
  // const handleOpenExampleModal = () => {
  //   setShowExampleModal(true);
  //   setExampleNotes("");
  // };

  // Marca/desmarca conversa como exemplo
  const handleMarkAsExample = async () => {
    if (!conversation?.id) return;

    try {
      setMarkingExample(true);

      if (isExample) {
        // Remove marcação
        await conversationExampleApi.removeExample(conversation.id);
        setIsExample(false);
        toast.success("Conversa desmarcada como exemplo");
      } else {
        // Marca como exemplo
        await conversationExampleApi.markAsExample(conversation.id, exampleNotes);
        setIsExample(true);
        setShowExampleModal(false);
        toast.success("Conversa marcada como exemplo com sucesso!");
      }
    } catch (error: any) {
      console.error("Error marking as example:", error);
      toast.error(error.response?.data?.message || "Erro ao marcar conversa como exemplo");
    } finally {
      setMarkingExample(false);
    }
  };

  // Submete ou remove feedback de uma mensagem
  const handleFeedbackSubmit = async (messageId: string, feedback: "GOOD" | "BAD" | null, note?: string) => {
    try {
      await messageApi.addFeedback(messageId, feedback, note);

      // Atualiza a mensagem localmente
      setMessages((prevMessages) =>
        prevMessages.map((msg) => (msg.id === messageId ? { ...msg, feedback: feedback as any, feedbackNote: feedback === null ? null : (note || null) } : msg))
      );

      if (feedback === null) {
        toast.success("Feedback removido!");
      } else {
        toast.success(feedback === "GOOD" ? "Feedback positivo registrado!" : "Feedback negativo registrado!");
      }
    } catch (error: any) {
      console.error("Error submitting feedback:", error);
      toast.error(error.response?.data?.message || "Erro ao enviar feedback");
      throw error;
    }
  };

  // Formata timestamp
  const formatMessageTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), "HH:mm", { locale: ptBR });
    } catch {
      return "";
    }
  };

  // Formata data para separador (HOJE, ONTEM ou DD/MM/YYYY)
  const formatDateSeparator = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Compara apenas ano, mês e dia
      const isSameDay = (d1: Date, d2: Date) =>
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();

      if (isSameDay(date, today)) {
        return "HOJE";
      } else if (isSameDay(date, yesterday)) {
        return "ONTEM";
      } else {
        return format(date, "dd/MM/yyyy", { locale: ptBR });
      }
    } catch {
      return "";
    }
  };

  // Verifica se deve mostrar separador de data (primeira mensagem do dia)
  const shouldShowDateSeparator = (currentMessage: Message, previousMessage: Message | null) => {
    if (!previousMessage) return true; // Sempre mostra na primeira mensagem

    try {
      const currentDate = new Date(currentMessage.timestamp);
      const previousDate = new Date(previousMessage.timestamp);

      // Verifica se são dias diferentes
      return (
        currentDate.getFullYear() !== previousDate.getFullYear() ||
        currentDate.getMonth() !== previousDate.getMonth() ||
        currentDate.getDate() !== previousDate.getDate()
      );
    } catch {
      return false;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b bg-background p-4">
          <div className="h-6 w-32 bg-muted rounded animate-pulse" />
        </div>
        <ChatAreaSkeleton />
      </div>
    );
  }

  const isAiEnabled = conversation?.aiEnabled ?? false;

  return (
    <div className="flex flex-col h-full">
      {/* Header Compacto */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b bg-muted/30">
        <div
          className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-1 -ml-1 rounded-md transition-colors"
          onClick={() => router.push(`/dashboard/customers/${customerId}`)}
        >
          <Avatar className="h-10 w-10 border border-muted">
            {customerProfilePic && (
              <AvatarImage src={customerProfilePic} alt={customerName} className="object-cover" />
            )}
            <AvatarFallback className="bg-gray-200 dark:bg-gray-600">
              <UserIcon className="h-6 w-6 text-gray-400 dark:text-gray-300" />
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-sm truncate">{customerName}</h2>
              {isContactOnline && (
                <span className="h-2 w-2 rounded-full bg-green-500" title="Online" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">{formatPhoneNumber(customerPhone)}</p>
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {/* Toggle IA */}
          <div className="flex flex-col items-center border-r pr-3 mr-1">
            <span className="text-[10px] text-muted-foreground mb-0.5">Ativação IA</span>
            <div className="flex items-center gap-2">
              <Switch id="ai-toggle" checked={isAiEnabled} onCheckedChange={handleToggleAi} disabled={togglingAi} className="scale-75 sm:scale-90" />
              <Label htmlFor="ai-toggle" className="text-xs cursor-pointer whitespace-nowrap">
                {togglingAi ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : isAiEnabled ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <Bot className="h-3 w-3" />
                    IA
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <UserIcon className="h-3 w-3" />
                    Manual
                  </span>
                )}
              </Label>
            </div>
          </div>

          {/* Botão Fluxo Ativo */}
          {activeFlowExecution && (
            <Button
              onClick={handleCancelFlow}
              disabled={cancellingFlow}
              size="sm"
              variant="outline"
              className="h-7 px-2 text-orange-600 border-orange-300 hover:bg-orange-50 hover:text-orange-700 gap-1"
              title={`Fluxo ativo: ${activeFlowExecution.flow.name} — Clique para cancelar`}
            >
              {cancellingFlow ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Zap className="h-3 w-3" />
                  <span className="hidden sm:inline text-[11px]">Parar Fluxo</span>
                  <Square className="h-2.5 w-2.5" />
                </>
              )}
            </Button>
          )}

          {/* Botão Arquivar/Desarquivar */}
          {isArchived ? (
            onUnarchive && (
              <Button onClick={onUnarchive} size="sm" variant="outline" className="h-7 px-2 text-green-600 hover:text-green-700" title="Desarquivar">
                <ArchiveRestore className="h-3 w-3" />
              </Button>
            )
          ) : (
            onArchive && (
              <Button onClick={onArchive} size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:text-destructive gap-1" title="Arquivar">
                <Archive className="h-3 w-3" />
                arquivar
              </Button>
            )
          )}

          {/* Botão Marcar como Exemplo */}
          {/* <Button
            onClick={isExample ? handleMarkAsExample : handleOpenExampleModal}
            disabled={markingExample}
            size="sm"
            variant={isExample ? "default" : "ghost"}
            className={cn("h-7 px-2", isExample && "bg-yellow-500 hover:bg-yellow-600")}
          >
            {markingExample ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Star className={cn("h-3 w-3", isExample && "fill-current")} />
            )}
          </Button> */}

          {/* Botão Mostrar Detalhes */}
          {showDetailsButton && onToggleDetails && (
            <Button onClick={onToggleDetails} size="sm" variant="outline" className="h-7 px-2">
              <PanelRightOpen className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages Area - Com Drag and Drop */}
      <div
        className={cn(
          "flex-1 overflow-y-auto p-4 space-y-3 relative transition-colors bg-gray-50 dark:bg-gray-950",
          isDragging && "bg-primary/5 border-2 border-dashed border-primary"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Overlay de Drag */}
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="flex flex-col items-center gap-2 text-primary">
              <ImageIcon className="h-12 w-12" />
              <p className="text-lg font-medium">Solte a imagem aqui</p>
            </div>
          </div>
        )}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
            <p className="text-xs text-muted-foreground mt-1">Envie uma mensagem para começar a conversa</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isInbound = message.direction === MessageDirection.INBOUND;
            const isAi = message.senderType === SenderType.AI;
            const previousMessage = index > 0 ? messages[index - 1] : null;
            const showDateSeparator = shouldShowDateSeparator(message, previousMessage);

            return (
              <div key={message.id} className="group">
                {/* Separador de Data */}
                {showDateSeparator && (
                  <div className="flex justify-center my-3">
                    <span className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                      {formatDateSeparator(message.timestamp)}
                    </span>
                  </div>
                )}
                <div className={cn("flex items-end gap-1", isInbound ? "justify-start" : "justify-end")}>
                  {/* Botão responder — inbound: aparece à direita da bolha; outbound: antes do menu */}
                  {isInbound && (
                    <button
                      onClick={() => { setReplyingTo(message); setTimeout(() => inputRef.current?.focus(), 50); }}
                      className="self-center opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 order-last"
                      title="Responder"
                    >
                      <Reply className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* Botão de menu — aparece ao hover */}
                  {!isInbound && (canEditMessage(message) || canDeleteMessage(message)) && (
                    <div className="relative self-center opacity-0 group-hover:opacity-100 transition-opacity order-first">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === message.id ? null : message.id)}
                        onBlur={(e) => {
                          if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) {
                            // Pequeno delay para permitir o clique no botão antes de fechar o menu
                            setTimeout(() => setOpenMenuId(null), 150);
                          }
                        }}
                        className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        title="Opções da mensagem"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      {openMenuId === message.id && (
                        <div className="absolute bottom-full mb-1 right-0 bg-white dark:bg-gray-800 shadow-lg rounded-lg border border-gray-100 dark:border-gray-700 z-20 min-w-[130px] overflow-hidden">
                          {canEditMessage(message) && (
                            <button
                              onClick={() => startEdit(message)}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 w-full text-left"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </button>
                          )}
                          {canDeleteMessage(message) && (
                            <button
                              onClick={() => handleDeleteMessage(message.id)}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 w-full text-left"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Apagar para todos
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Botão responder — outbound: aparece antes do menu */}
                  {!isInbound && (
                    <button
                      onClick={() => { setReplyingTo(message); setTimeout(() => inputRef.current?.focus(), 50); }}
                      className="self-center opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 order-first"
                      title="Responder"
                    >
                      <Reply className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <div
                    className={cn(
                      "max-w-[85%] sm:max-w-[75%] md:max-w-[70%] rounded-lg px-3 py-2 sm:px-4 shadow-sm",
                      isInbound
                        ? "bg-white dark:bg-gray-800 text-foreground rounded-tl-none"
                        : isAi
                          ? "bg-[#DCF8C6] dark:bg-green-900/40 text-gray-900 dark:text-white rounded-tr-none"
                          : "bg-[#446b26] dark:bg-green-900/20 text-white dark:text-white rounded-tr-none"
                    )}
                  >
                    {!isInbound && (
                      <div className="flex items-center gap-1 mb-1">
                        {isAi ? (
                          <Badge variant="secondary" className="text-xs h-4">
                            <Bot className="h-3 w-3 mr-1" />
                            IA
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs h-4 bg-white">
                            <UserIcon className="h-3 w-3 mr-1" />
                            Você
                          </Badge>
                        )}
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      {/* Imagem */}
                      {message.mediaType === "image" && message.mediaUrl && (
                        <div className="space-y-2">
                          <div
                            className="relative group/img cursor-zoom-in"
                            onClick={() => setLightbox({ url: message.mediaUrl!, type: "image" })}
                          >
                            <img
                              src={message.mediaUrl}
                              alt="Imagem enviada"
                              className="max-w-full max-h-[400px] object-contain rounded-lg transition-opacity shadow-md group-hover/img:opacity-90"
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                              <div className="bg-black/40 rounded-full p-2">
                                <ZoomIn className="h-5 w-5 text-white" />
                              </div>
                            </div>
                          </div>
                          {message.content && !message.content.startsWith("[Imagem") && (
                            <MessageText
                              content={message.content}
                              className={cn("text-xs italic", isInbound ? "text-muted-foreground" : "text-white/80")}
                            />
                          )}
                        </div>
                      )}

                      {/* Vídeo */}
                      {message.mediaType === "video" && message.mediaUrl && (
                        <div className="space-y-2">
                          <div
                            className="relative group/vid cursor-pointer"
                            onClick={() => setLightbox({ url: message.mediaUrl!, type: "video" })}
                          >
                            <video
                              src={message.mediaUrl}
                              preload="metadata"
                              className="max-w-full max-h-[400px] object-contain rounded-lg shadow-md bg-black/5 group-hover/vid:opacity-90 transition-opacity"
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/vid:opacity-100 transition-opacity">
                              <div className="bg-black/40 rounded-full p-2">
                                <ZoomIn className="h-5 w-5 text-white" />
                              </div>
                            </div>
                          </div>
                          {message.content && !message.content.startsWith("[Vídeo") && (
                            <MessageText
                              content={message.content}
                              className={cn("text-xs italic", isInbound ? "text-muted-foreground" : "text-white/80")}
                            />
                          )}
                        </div>
                      )}

                      {/* Áudio com Player Customizado */}
                      {message.mediaType === "audio" && message.mediaUrl ? (
                        <AudioPlayer audioUrl={message.mediaUrl} transcription={message.content} isInbound={isInbound} />
                      ) : message.mediaType === "audio" && !message.mediaUrl ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 bg-secondary/50 rounded-md">
                          <span className="text-xs">🎤 Áudio indisponível para reprodução</span>
                          {message.content && <p className="text-xs italic">"{message.content}"</p>}
                        </div>
                      ) : null}

                      {/* Texto — modo normal ou modo de edição */}
                      {message.mediaType !== "audio" && message.mediaType !== "image" && message.mediaType !== "video" && message.content && (
                        editingMessageId === message.id ? (
                          <div className="flex flex-col gap-2 min-w-[200px]">
                            <textarea
                              ref={editInputRef}
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  saveEdit(message.id);
                                }
                                if (e.key === "Escape") cancelEdit();
                              }}
                              rows={Math.min(editingContent.split("\n").length + 1, 5)}
                              className="w-full text-xs sm:text-sm bg-white/20 dark:bg-black/20 text-white placeholder-white/60 border border-white/30 rounded-md px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-white/50"
                            />
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={cancelEdit}
                                className="text-[10px] text-white/70 hover:text-white px-2 py-0.5 rounded"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => saveEdit(message.id)}
                                disabled={savingEdit || !editingContent.trim()}
                                className="text-[10px] bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded flex items-center gap-1 disabled:opacity-50"
                              >
                                {savingEdit ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : null}
                                Salvar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <MessageText content={message.content} className="text-xs sm:text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere" />
                        )
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-1">
                      <div className="flex items-center gap-1">
                        <p className={cn("text-xs", isInbound || isAi ? "text-gray-600" : "text-white")}>{formatMessageTime(message.timestamp)}</p>
                        {!isInbound && (
                          <>
                            {message.status === "FAILED" ? (
                              <span className="text-red-500 text-xs">!</span>
                            ) : message.status === "READ" ? (
                              <CheckCheck className="h-3 w-3 text-blue-500" />
                            ) : message.status === "DELIVERED" ? (
                              <CheckCheck className="h-3 w-3 text-gray-400" />
                            ) : (
                              <Check className="h-3 w-3 text-gray-400" />
                            )}
                          </>
                        )}
                      </div>
                      {!isInbound && isAi && (
                        <MessageFeedbackComponent
                          messageId={message.id}
                          currentFeedback={message.feedback}
                          currentNote={message.feedbackNote}
                          onFeedbackSubmit={handleFeedbackSubmit}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Botão de reação — aparece ao hover abaixo da mensagem */}
                {message.messageId && (
                  <div className={cn("flex -mt-0.5 mb-0.5", isInbound ? "justify-start" : "justify-end")}>
                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setReactionPickerId(reactionPickerId === message.id ? null : message.id); }}
                        className={cn(
                          "text-base leading-none transition-all duration-150 select-none",
                          "opacity-0 group-hover:opacity-30 hover:!opacity-100 hover:scale-125",
                          sendingReactionId === message.id && "opacity-50 cursor-wait"
                        )}
                        disabled={sendingReactionId === message.id}
                        title="Reagir"
                      >
                        {sendingReactionId === message.id ? "⏳" : "😊"}
                      </button>

                      {reactionPickerId === message.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            "absolute bottom-full mb-1 z-30",
                            "bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-full shadow-lg",
                            "flex items-center gap-0.5 px-2 py-1.5",
                            isInbound ? "left-0" : "right-0"
                          )}
                        >
                          {['👍','❤️','😂','😮','😢','🙏'].map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleSendReaction(message.id, emoji)}
                              className="text-xl leading-none p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-125 transition-transform"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* AI Processing/Typing Indicator - só aparece se IA estiver habilitada globalmente e no chat */}
        {isAiEnabled && autoReplyEnabled && (aiProcessing || isTyping) && (
          <div className="flex justify-start">
            <div className="max-w-[85%] sm:max-w-[75%] md:max-w-[70%] rounded-lg px-3 py-2 sm:px-4 bg-green-100 dark:bg-green-900/30">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-green-600 dark:text-green-400" />
                <div className="flex gap-1">
                  <span className="animate-bounce" style={{ animationDelay: "0ms" }}>
                    ●
                  </span>
                  <span className="animate-bounce" style={{ animationDelay: "150ms" }}>
                    ●
                  </span>
                  <span className="animate-bounce" style={{ animationDelay: "300ms" }}>
                    ●
                  </span>
                </div>
                <span className="text-sm text-green-600 dark:text-green-400">{isTyping ? "IA está digitando..." : "IA está pensando..."}</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t bg-muted/30">
        {/* Preview da imagem selecionada */}
        {selectedImage && (
          <div className="p-4 border-b bg-muted/50">
            <div className="flex items-start gap-3">
              <div className="relative">
                <img
                  src={selectedImage}
                  alt="Preview"
                  className="h-24 w-24 object-cover rounded-lg shadow-md"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={handleCancelImage}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium">Imagem selecionada</p>
                <Input
                  type="text"
                  placeholder="Adicione uma legenda (opcional)..."
                  value={imageCaption}
                  onChange={(e) => setImageCaption(e.target.value)}
                  disabled={sending}
                  className="text-sm"
                />
                <Button
                  type="button"
                  onClick={handleSendImage}
                  disabled={sending}
                  size="sm"
                  className="w-full"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Enviar Imagem
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Preview da mensagem sendo respondida */}
        {replyingTo && (
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <div className="w-0.5 h-8 rounded-full bg-green-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-green-600 dark:text-green-400">
                  {replyingTo.direction === MessageDirection.INBOUND ? customerName : "Você"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {replyingTo.mediaType === "image" ? "🖼️ Imagem"
                    : replyingTo.mediaType === "audio" ? "🎤 Áudio"
                    : replyingTo.mediaType === "video" ? "🎥 Vídeo"
                    : replyingTo.content}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="shrink-0 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 transition-colors"
              title="Cancelar resposta"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Input de mensagem */}
        <form onSubmit={handleSendMessage} className="flex items-center gap-2 p-3 sm:p-4 bg-white dark:bg-gray-900 border-t">
          {/* Input de arquivo oculto */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Se estiver gravando, mostra interface de gravação */}
          {isRecording ? (
            <>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={cancelRecording}
                title="Cancelar gravação"
                className="rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>

              <div className="flex-1 flex items-center gap-3 bg-gray-100rounded-full px-4 py-2">
                <Mic className="h-4 w-4 text-red-500 animate-pulse" />
                <span className="text-sm font-medium text-red-600 dark:text-red-400">{formatRecordingTime(recordingTime)}</span>
                <div className="flex-1 flex gap-1">
                  {Array.from({ length: Math.min(20, recordingTime) }).map((_, i) => (
                    <div key={i} className="h-3 w-1 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
                  ))}
                </div>
              </div>

              <Button
                type="button"
                variant="default"
                size="icon"
                onClick={stopRecording}
                disabled={sending}
                title="Enviar áudio"
                className="rounded-full bg-green-500 hover:bg-green-600"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </>
          ) : (
            <>
              {/* Botão + para adicionar imagem */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || !!selectedImage}
                title="Adicionar imagem"
                className="rounded-full"
              >
                <Plus className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </Button>

              {/* Botão de Emojis */}
              <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={sending || !!selectedImage}
                    title="Adicionar emoji"
                    className="rounded-full"
                  >
                    <Smile className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-2 max-h-[400px] overflow-y-auto" align="start">
                  <div className="space-y-3">
                    {/* Objetivos / Business */}
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 tracking-wider">🚀 Objetivo / Business</p>
                      <div className="grid grid-cols-9 gap-1">
                        {emojis.business.map((emoji, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleEmojiSelect(emoji)}
                            className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent transition-colors text-xl"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Rostos */}
                    <div className="space-y-1 pt-2 border-t border-border/50">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 tracking-wider">😊 Reações</p>
                      <div className="grid grid-cols-9 gap-1">
                        {emojis.faces.map((emoji, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleEmojiSelect(emoji)}
                            className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent transition-colors text-xl"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Mãos */}
                    <div className="space-y-1 pt-2 border-t border-border/50">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 tracking-wider">👍 Gestos</p>
                      <div className="grid grid-cols-9 gap-1">
                        {emojis.hands.map((emoji, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleEmojiSelect(emoji)}
                            className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent transition-colors text-xl"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Corações */}
                    <div className="space-y-1 pt-2 border-t border-border/50">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 tracking-wider">❤️ Corações</p>
                      <div className="grid grid-cols-9 gap-1">
                        {emojis.hearts.map((emoji, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleEmojiSelect(emoji)}
                            className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent transition-colors text-xl"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <Input
                ref={inputRef}
                type="text"
                placeholder="Digite uma mensagem"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={!!selectedImage}
                className="flex-1 rounded-full border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus-visible:ring-1"
              />

              {/* Botão Send (aparece quando tem texto) ou Microfone (quando não tem) */}
              {inputValue.trim() ? (
                <Button
                  type="submit"
                  disabled={!!selectedImage}
                  isLoading={sending}
                  size="icon"
                  className="rounded-full bg-green-500 hover:bg-green-600"
                >
                  <Send className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={startRecording}
                  disabled={sending || !!selectedImage}
                  title="Gravar áudio"
                  className="rounded-full"
                >
                  <Mic className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </Button>
              )}
            </>
          )}
        </form>
      </div>

      {/* Modal para Marcar como Exemplo */}
      <Dialog open={showExampleModal} onOpenChange={setShowExampleModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar Conversa como Exemplo</DialogTitle>
            <DialogDescription>
              Esta conversa será usada como referência para a IA aprender o tom e estilo de atendimento ideal. Você pode adicionar uma nota opcional
              para documentar por que esta conversa é um bom exemplo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="example-notes">Nota (Opcional)</Label>
              <Textarea
                id="example-notes"
                placeholder="Ex: Ótimo exemplo de como lidar com reclamações, tom empático e resolução rápida."
                value={exampleNotes}
                onChange={(e) => setExampleNotes(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExampleModal(false)} disabled={markingExample}>
              Cancelar
            </Button>
            <Button onClick={handleMarkAsExample} isLoading={markingExample} className="bg-yellow-500 hover:bg-yellow-600">
              <Star className="h-4 w-4 mr-2" />
              {markingExample ? "Marcando..." : "Marcar como Exemplo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Imagem Muito Grande */}
      <Dialog open={showImageTooLargeModal} onOpenChange={setShowImageTooLargeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-orange-500" />
              Imagem muito grande
            </DialogTitle>
            <DialogDescription>
              A imagem selecionada é maior que 5MB, que é o limite máximo permitido pelo WhatsApp para envio de imagens.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Para enviar esta imagem, você precisa reduzir o tamanho dela. Você pode usar um compressor de imagens online para diminuir a qualidade/tamanho do arquivo.
            </p>

            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Conversor de imagem recomendado:</p>
              <a
                href="https://www.iloveimg.com/pt/comprimir-imagem"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                🔗 Clique aqui para acessar o conversor
              </a>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImageTooLargeModal(false)}>
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox — visualização ampliada de imagem ou vídeo */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setLightbox(null)}
        >
          {/* Barra superior */}
          <div
            className="absolute top-0 left-0 right-0 flex items-center justify-end gap-2 p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => handleDownload(lightbox.url, lightbox.type)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
              title="Baixar"
            >
              <Download className="h-4 w-4" />
              Baixar
            </button>
            <button
              onClick={() => setLightbox(null)}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Conteúdo */}
          <div
            className="flex items-center justify-center w-full h-full p-14"
            onClick={(e) => e.stopPropagation()}
          >
            {lightbox.type === "image" ? (
              <img
                src={lightbox.url}
                alt="Visualização"
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            ) : (
              <video
                src={lightbox.url}
                controls
                autoPlay
                className="max-w-full max-h-full rounded-lg shadow-2xl"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
