"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { mutate as globalMutate } from "swr";
import { ConversationList } from "@/components/chat/conversation-list";
import { ChatArea } from "@/components/chat/chat-area";
import { CustomerDetails } from "@/components/chat/customer-details";
import { AdvancedFilters, AdvancedFilters as AdvancedFiltersType } from "@/components/chat/advanced-filters";
import { NewConversationDialog } from "@/components/chat/new-conversation-dialog";
import { useConversations } from "@/hooks/use-conversations";
import { customerApi } from "@/lib/customer";
import { toast } from "sonner";
import { whatsappApi } from "@/lib/whatsapp";
import { Customer } from "@/types/customer";
import { WhatsAppInstance } from "@/types/whatsapp";
import { MessageSquare, Search, X, ChevronRight, ArrowLeft, Clock, Archive } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ConversationListSkeleton } from "@/components/ui/skeletons";
import { ProtectedPage } from "@/components/layout/protected-page";
import { LoadingErrorState } from "@/components/ui/error-state";
import { useWebSocket } from "@/hooks/useWebSocket";

type FilterType = "all" | "unread" | "needsHelp" | "archived";
type SortType = "recent" | "oldest" | "name";

// Tipo para conversa pendente (cliente sem mensagens ainda)
interface PendingConversation {
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerProfilePic: string | null;
}

export default function ConversationsPage() {
  return (
    <ProtectedPage requiredPage="CONVERSATIONS">
      <ConversationsPageContent />
    </ProtectedPage>
  );
}

function ConversationsPageContent() {
  const searchParams = useSearchParams();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [pendingConversation, setPendingConversation] = useState<PendingConversation | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const AI_THINKING_TTL = 90_000; // 90 segundos
  const AI_THINKING_KEY = "ai_thinking_ids";

  const readThinkingFromStorage = (): Set<string> => {
    try {
      const raw = sessionStorage.getItem(AI_THINKING_KEY);
      if (!raw) return new Set();
      const parsed: Record<string, number> = JSON.parse(raw);
      const now = Date.now();
      const valid = Object.entries(parsed)
        .filter(([, ts]) => now - ts < AI_THINKING_TTL)
        .map(([id]) => id);
      return new Set(valid);
    } catch { return new Set(); }
  };

  const writeThinkingToStorage = (ids: Set<string>) => {
    try {
      const existing: Record<string, number> = (() => {
        try { return JSON.parse(sessionStorage.getItem(AI_THINKING_KEY) || "{}"); } catch { return {}; }
      })();
      const now = Date.now();
      const next: Record<string, number> = {};
      for (const id of ids) {
        next[id] = existing[id] && now - existing[id] < AI_THINKING_TTL ? existing[id] : now;
      }
      sessionStorage.setItem(AI_THINKING_KEY, JSON.stringify(next));
    } catch { /* sessionStorage indisponível */ }
  };

  const [aiThinkingIds, setAiThinkingIds] = useState<Set<string>>(() => readThinkingFromStorage());

  // Filtros e busca - carrega do localStorage se disponível
  const [searchTerm, setSearchTerm] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("conversations_filter_search") || "";
    }
    return "";
  });
  const [filterType, setFilterType] = useState<FilterType>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("conversations_filter_type") as FilterType;
      // Trata valores antigos caso existam para evitar crash da UI
      if ((stored as string) === "ai" || (stored as string) === "human") return "all";
      return stored || "all";
    }
    return "all";
  });
  const [sortType, setSortType] = useState<SortType>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("conversations_sort_type") as SortType) || "recent";
    }
    return "recent";
  });
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFiltersType>(() => {
    const defaults: AdvancedFiltersType = {
      excludeGroups: false,
      selectedTags: [],
      onlyNeedsHelp: false,
      onlyAiEnabled: false,
      onlyHumanEnabled: false,
      selectedInstanceId: null,
      selectedStageIds: [],
    };
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("conversations_advanced_filters");
      if (saved) {
        try {
          return { ...defaults, ...JSON.parse(saved) };
        } catch (error) {
          console.error("Erro ao carregar filtros avançados:", error);
        }
      }
    }
    return defaults;
  });

  // Layout
  const [showSidebar, setShowSidebar] = useState(true);
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  // Obtém o companyId do usuário logado
  const getCompanyId = () => {
    const user = localStorage.getItem("user");
    if (user) {
      const userData = JSON.parse(user);
      return userData.companyId;
    }
    return null;
  };

  const companyId = getCompanyId();

  // Persiste no sessionStorage toda vez que aiThinkingIds muda
  useEffect(() => {
    writeThinkingToStorage(aiThinkingIds);
  }, [aiThinkingIds]);

  const addThinking = useCallback((customerId: string) => {
    setAiThinkingIds((prev) => {
      const next = new Set(prev);
      next.add(customerId);
      return next;
    });
  }, []);

  const removeThinking = useCallback((customerId: string) => {
    setAiThinkingIds((prev) => {
      const next = new Set(prev);
      next.delete(customerId);
      return next;
    });
  }, []);

  // Rastreia quais conversas estão com IA pensando (via WebSocket typing events)
  const handleTyping = useCallback((data: { customerId: string; isTyping: boolean }) => {
    if (data.isTyping) {
      addThinking(data.customerId);
    } else {
      removeThinking(data.customerId);
    }
  }, [addThinking, removeThinking]);

  const handleNewMessageForThinking = useCallback((message: {
    direction?: string;
    aiEnabled?: boolean;
    customerId?: string;
    senderType?: string | null;
  }) => {
    if (message.direction === "INBOUND" && message.aiEnabled && message.customerId) {
      const id = message.customerId;
      addThinking(id);
      setTimeout(() => removeThinking(id), AI_THINKING_TTL);
    }
    if (message.direction === "OUTBOUND" && message.senderType === "AI" && message.customerId) {
      removeThinking(message.customerId);
    }
  }, [addThinking, removeThinking]);

  useWebSocket({ autoConnect: true, onTyping: handleTyping, onNewMessage: handleNewMessageForThinking });

  // Usa SWR para gerenciar conversas com cache automático
  // Buscamos sempre todas as conversas para as estatísticas globais estarem corretas
  const { conversations: allConversations, total: totalConversations, isLoading, isError, mutate } = useConversations(companyId, selectedCustomerId);

  // As conversas exibidas na lista (se arquivados ou não)
  const conversations = useMemo(() => {
    if (filterType === "archived") {
      return allConversations.filter(c => c.isArchived);
    }
    return allConversations.filter(c => !c.isArchived);
  }, [allConversations, filterType]);

  // Carrega os clientes para filtrar por tags
  const loadCustomers = async () => {
    try {
      const response = await customerApi.getAll();
      setCustomers(response.customers);
    } catch (err: unknown) {
      console.error("Error loading customers:", err);
    }
  };

  // Carrega instâncias do WhatsApp
  const loadInstances = async () => {
    if (!companyId) return;
    try {
      const response = await whatsappApi.getInstances(companyId);
      setInstances(response.data);
    } catch (err: unknown) {
      console.error("Error loading instances:", err);
    }
  };

  useEffect(() => {
    loadCustomers();
    loadInstances();
  }, [companyId]);

  // Salva filtros no localStorage quando mudam
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("conversations_filter_search", searchTerm);
    }
  }, [searchTerm]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("conversations_filter_type", filterType);
    }
  }, [filterType]);


  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("conversations_sort_type", sortType);
    }
  }, [sortType]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("conversations_advanced_filters", JSON.stringify(advancedFilters));
    }
  }, [advancedFilters]);

  // Seleciona a primeira conversa no carregamento inicial
  useEffect(() => {
    if (!selectedCustomerId && conversations.length > 0) {
      setSelectedCustomerId(conversations[0].customerId);
    }
  }, [conversations]);

  // Efeito para selecionar conversa via query parameter
  useEffect(() => {
    const customerId = searchParams.get("customer");
    if (customerId) {
      setSelectedCustomerId(customerId);

      // Se o cliente não existe na lista de conversas, busca os dados e cria conversa pendente
      const existsInConversations = conversations.some((c) => c.customerId === customerId);
      if (!existsInConversations && !isLoading) {
        customerApi.getById(customerId).then((customer) => {
          setPendingConversation({
            customerId: customer.id,
            customerName: customer.name,
            customerPhone: customer.phone,
            customerProfilePic: customer.profilePicUrl || null,
          });
        }).catch((err) => {
          console.error("Erro ao buscar cliente para conversa pendente:", err);
        });
      }
    }
  }, [searchParams, conversations, isLoading]);

  // Limpa a conversa pendente quando ela aparecer na lista de conversas
  useEffect(() => {
    if (pendingConversation) {
      const existsInList = conversations.some((c) => c.customerId === pendingConversation.customerId);
      if (existsInList) {
        setPendingConversation(null);
      }
    }
  }, [conversations, pendingConversation]);

  // Mapa de cliente por id para filtros de tag/estágio — evita findIndex em cada iteração
  const customerMap = useMemo(() => {
    const map = new Map(customers.map((c) => [c.id, c]));
    return map;
  }, [customers]);

  // Filtra e ordena conversas com useMemo para otimização
  const filteredConversations = useMemo(
    () =>
      conversations
        .filter((conv) => {
          // Busca
          if (searchTerm) {
            const q = searchTerm.toLowerCase();
            if (
              !conv.customerName.toLowerCase().includes(q) &&
              !conv.customerPhone.includes(q) &&
              !(conv.lastMessage?.toLowerCase().includes(q))
            ) return false;
          }

          // Filtro rápido
          if (filterType === "unread" && !(conv.unreadCount && conv.unreadCount > 0)) return false;
          if (filterType === "needsHelp" && !conv.needsHelp) return false;

          // Excluir grupos
          if (advancedFilters.excludeGroups && (conv.isGroup || conv.customerPhone.includes("@g.us"))) return false;

          // Precisa de ajuda
          if (advancedFilters.onlyNeedsHelp && !conv.needsHelp) return false;

          // IA vs Humano
          if (advancedFilters.onlyAiEnabled && !advancedFilters.onlyHumanEnabled && !conv.aiEnabled) return false;
          if (advancedFilters.onlyHumanEnabled && !advancedFilters.onlyAiEnabled && conv.aiEnabled) return false;

          // Instância
          if (advancedFilters.selectedInstanceId && conv.whatsappInstanceId !== advancedFilters.selectedInstanceId) return false;

          // Tags e estágio (usa o mapa para O(1) em vez de O(n))
          if (advancedFilters.selectedTags.length > 0 || advancedFilters.selectedStageIds.length > 0) {
            const customer = customerMap.get(conv.customerId);
            if (!customer) return false;
            if (advancedFilters.selectedTags.length > 0 && !advancedFilters.selectedTags.some((tag) => customer.tags.includes(tag))) return false;
            if (advancedFilters.selectedStageIds.length > 0 && !advancedFilters.selectedStageIds.includes(customer.pipelineStageId ?? "")) return false;
          }

          return true;
        })
        .sort((a, b) => {
          if (sortType === "recent") return new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime();
          if (sortType === "oldest") return new Date(a.lastMessageTimestamp).getTime() - new Date(b.lastMessageTimestamp).getTime();
          if (sortType === "name") return a.customerName.localeCompare(b.customerName);
          return 0;
        }),
    [conversations, searchTerm, filterType, sortType, advancedFilters, customerMap]
  );

  // Encontra a conversa selecionada
  // Encontra a conversa selecionada na lista OU usa a conversa pendente
  const existingConversation = conversations.find((c) => c.customerId === selectedCustomerId);
  const selectedConversation = existingConversation || (pendingConversation && pendingConversation.customerId === selectedCustomerId ? {
    customerId: pendingConversation.customerId,
    customerName: pendingConversation.customerName,
    customerPhone: pendingConversation.customerPhone,
    customerProfilePic: pendingConversation.customerProfilePic,
    lastMessage: "",
    lastMessageTimestamp: new Date().toISOString(),
    unreadCount: 0,
    direction: "OUTBOUND" as const,
    aiEnabled: false,
    needsHelp: false,
    isGroup: false,
    assignedToId: null,
    assignedToName: null,
    whatsappInstanceId: instances[0]?.id || "",
    whatsappInstanceName: instances[0]?.instanceName || "",
    isArchived: false,
  } : null);

  // Estatísticas globais baseadas em TODAS as conversas NÃO arquivadas
  const stats = useMemo(() => {
    const activeConvs = allConversations.filter(c => !c.isArchived);
    return {
      total: activeConvs.length,
      ai: activeConvs.filter((c) => c.aiEnabled).length,
      human: activeConvs.filter((c) => !c.aiEnabled).length,
      unread: activeConvs.filter((c) => (c.unreadCount || 0) > 0).length,
      needsHelp: activeConvs.filter((c) => c.needsHelp).length,
    };
  }, [allConversations]);

  // Se o filtro "Aguardando" estiver ativo mas não houver mais nenhum, volta para "all"
  useEffect(() => {
    if (filterType === "needsHelp" && stats.needsHelp === 0) {
      setFilterType("all");
    }
  }, [stats.needsHelp, filterType]);

  // Handler para selecionar conversa (muda view no mobile)
  const handleSelectConversation = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setMobileView("chat");
    // Atualização otimista: zera dot imediatamente sem esperar API
    mutate(
      (current) => current
        ? { ...current, items: current.items.map((c) => c.customerId === customerId ? { ...c, unreadCount: 0 } : c) }
        : current,
      false
    );
  };

  // Handler para voltar à lista no mobile
  const handleBackToList = () => {
    setMobileView("list");
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100dvh-4rem)] overflow-hidden bg-muted/30">
        {/* Sidebar com loading */}
        <div className="w-96 border-r bg-background flex flex-col">
          <div className="p-4 border-b">
            <div className="h-10 bg-muted rounded-md animate-pulse mb-2" />
            <div className="flex gap-2">
              <div className="h-8 flex-1 bg-muted rounded-md animate-pulse" />
              <div className="h-8 w-20 bg-muted rounded-md animate-pulse" />
            </div>
          </div>
          <ConversationListSkeleton />
        </div>
        {/* Área de chat com loading */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">Carregando conversas...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return <LoadingErrorState resource="conversas" onRetry={mutate} />;
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] overflow-hidden bg-muted/30">
      {/* Sidebar Esquerda: Lista de Conversas */}
      <div
        className={cn(
          "border-r bg-background transition-all duration-300 flex flex-col",
          // Mobile: tela cheia quando em view de lista, esconde quando em chat
          "fixed inset-0 z-20 lg:relative lg:z-auto",
          mobileView === "list" ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          showSidebar ? "lg:w-[365px]" : "lg:w-0",
          "w-full"
        )}
      >
        {(showSidebar || mobileView === "list") && (
          <>
            {/* Header da Sidebar */}
            <div className="p-3 border-b space-y-2 pb-1">
              <div className="flex items-center justify-between">
                {/* Filtros e Instância em linha */}
                <div className="flex items-center gap-2">
                  <AdvancedFilters
                    filters={advancedFilters}
                    onFiltersChange={setAdvancedFilters}
                    instances={instances}
                    sortType={sortType}
                    onSortChange={(value: string) => setSortType(value as SortType)}
                  />
                </div>
                {/* <Badge variant="secondary" className="text-xs">
                  {filteredConversations.length} de {conversations.length}
                </Badge> */}
                <NewConversationDialog
                  trigger={
                    <Button size="sm" variant="default">
                      {/* <MessageSquarePlus className="h-4 w-4" /> */}
                      Nova Conversa
                    </Button>
                  }
                  onConversationCreated={async (customer) => {
                    // Define a conversa pendente (cliente sem mensagens ainda)
                    setPendingConversation({
                      customerId: customer.id,
                      customerName: customer.name,
                      customerPhone: customer.phone,
                      customerProfilePic: customer.profilePicUrl || null,
                    });

                    // Seleciona o cliente
                    setSelectedCustomerId(customer.id);

                    // Recarrega a lista de conversas em background
                    mutate();
                  }}
                />
              </div>



              {/* Busca */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-8 h-8 text-sm"
                />
                {searchTerm && (
                  <Button variant="ghost" size="icon" onClick={() => setSearchTerm("")} className="absolute right-0.5 top-1/2 -translate-y-1/2 h-7 w-7">
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Filtros Rápidos */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide no-scrollbar">
                <Button variant={filterType === "all" ? "default" : "outline"} size="sm" onClick={() => setFilterType("all")} className="h-7 text-[11px] px-1.5 shrink-0 gap-1">
                  Todas {stats.total}
                </Button>
                {stats.needsHelp > 0 && (
                  <Button variant={filterType === "needsHelp" ? "default" : "outline"} size="sm" onClick={() => setFilterType("needsHelp")} className="h-7 text-[11px] px-1.5 shrink-0 gap-1">
                    <Clock className="h-3 w-3 mr-1" />
                    Aguardando {stats.needsHelp}
                  </Button>
                )}
                {stats.unread > 0 && (
                  <Button variant={filterType === "unread" ? "default" : "outline"} size="sm" onClick={() => setFilterType("unread")} className="h-7 text-[11px] px-2 shrink-0 gap-1.5">
                    Notificações
                    <Badge variant="destructive" className="text-[10px] h-4 px-1 min-w-4 flex items-center justify-center rounded-full">{stats.unread}</Badge>
                  </Button>
                )}
                <Button variant={filterType === "archived" ? "default" : "outline"} size="sm" onClick={() => setFilterType(filterType === "archived" ? "all" : "archived")} className="h-7 text-[11px] px-1.5 shrink-0 gap-1">
                  <Archive className="h-3 w-3 mr-1" />
                  Arquivados
                </Button>
              </div>

            </div>

            {/* Lista de Conversas */}
            <div className="flex-1 overflow-y-auto flex flex-col">
              {filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium">{searchTerm || filterType !== "all" ? "Nenhuma conversa encontrada" : "Nenhuma conversa"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {searchTerm || filterType !== "all" ? "Tente ajustar os filtros" : "Aguarde mensagens dos clientes"}
                  </p>
                </div>
              ) : (
                <>
                  <ConversationList
                    conversations={filteredConversations}
                    selectedCustomerId={selectedCustomerId}
                    onSelectConversation={handleSelectConversation}
                    aiThinkingIds={aiThinkingIds}
                  />
                  {totalConversations > 100 && !searchTerm && filterType === "all" && (
                    <div className="px-3 py-2.5 border-t bg-muted/40 flex items-center gap-2 shrink-0">
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        Exibindo as <span className="font-semibold text-foreground">100</span> conversas mais recentes de <span className="font-semibold text-foreground">{totalConversations}</span>. Use a busca ou filtros para encontrar outras.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Botão para abrir sidebar quando fechada */}
      {!showSidebar && (
        <div className="flex items-start pt-4">
          <Button variant="outline" size="icon" onClick={() => setShowSidebar(true)} className="h-8 w-8 rounded-r-lg rounded-l-none border-l-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Área Central: Chat */}
      <div
        className={cn(
          "flex-1 bg-background overflow-hidden flex-col",
          mobileView === "chat" ? "flex" : "hidden lg:flex"
        )}
      >
        {selectedConversation ? (
          <>
            {/* Botão voltar - apenas mobile */}
            <div className="lg:hidden shrink-0 border-b px-2 py-1 bg-background">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToList}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
            </div>
            <div className="flex-1 min-h-0">
            <ChatArea
              key={selectedConversation.customerId}
              customerId={selectedConversation.customerId}
              customerName={selectedConversation.customerName}
              customerPhone={selectedConversation.customerPhone}
              customerProfilePic={selectedConversation.customerProfilePic}
              customerTemperature={'temperature' in selectedConversation ? selectedConversation.temperature : null}
              onToggleDetails={() => setShowCustomerDetails(!showCustomerDetails)}
              showDetailsButton={true}
              isArchived={selectedConversation.isArchived ?? false}
              isAiThinking={aiThinkingIds.has(selectedConversation.customerId)}
              onArchive={async () => {
                try {
                  await customerApi.archive(selectedConversation.customerId);
                  toast.success("Contato arquivado");
                  mutate();
                } catch {
                  toast.error("Erro ao arquivar contato");
                }
              }}
              onUnarchive={async () => {
                try {
                  await customerApi.unarchive(selectedConversation.customerId);
                  toast.success("Contato desarquivado");
                  mutate();
                } catch {
                  toast.error("Erro ao desarquivar contato");
                }
              }}
              onMarkAsRead={() => {
                mutate(
                  (current) => current
                    ? { ...current, items: current.items.map((c) => c.customerId === selectedConversation.customerId ? { ...c, unreadCount: 0 } : c) }
                    : current,
                  false
                );
                if (companyId) {
                  globalMutate(`/messages/unread-count/${companyId}`);
                }
              }}
            />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageSquare className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Selecione uma conversa</h3>
            <p className="text-sm text-muted-foreground max-w-md">Escolha uma conversa da lista à esquerda para visualizar e responder mensagens</p>
          </div>
        )}
      </div>

      {/* Sidebar Direita: Detalhes do Cliente */}
      {selectedConversation && showCustomerDetails && (
        <div
          className={cn(
            "border-l bg-background overflow-hidden flex flex-col transition-all duration-300",
            // Mobile: fixo em tela cheia
            "fixed inset-0 z-50 lg:static lg:z-auto lg:w-[310px]"
          )}
        >
          {/* Header Mobile para Detalhes */}
          <div className="lg:hidden flex items-center p-2 border-b bg-muted/30">
            <Button variant="ghost" size="sm" onClick={() => setShowCustomerDetails(false)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <span className="font-semibold ml-2">Detalhes do Contato</span>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            <CustomerDetails
              customerId={selectedConversation.customerId}
              customerName={selectedConversation.customerName}
              customerPhone={selectedConversation.customerPhone}
            />
          </div>
        </div>
      )}
    </div>
  );
}
