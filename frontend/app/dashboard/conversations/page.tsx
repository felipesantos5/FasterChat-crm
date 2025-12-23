"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ConversationList } from "@/components/chat/conversation-list";
import { ChatArea } from "@/components/chat/chat-area";
import { CustomerDetails } from "@/components/chat/customer-details";
import { AdvancedFilters, AdvancedFilters as AdvancedFiltersType } from "@/components/chat/advanced-filters";
import { NewConversationDialog } from "@/components/chat/new-conversation-dialog";
import { useConversations } from "@/hooks/use-conversations";
import { customerApi } from "@/lib/customer";
import { whatsappApi } from "@/lib/whatsapp";
import { Customer } from "@/types/customer";
import { WhatsAppInstance } from "@/types/whatsapp";
import { MessageSquare, Search, X, Bot, User, ChevronRight, MessageSquarePlus, Smartphone, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConversationListSkeleton } from "@/components/ui/skeletons";

type FilterType = "all" | "ai" | "human" | "unread" | "needsHelp";
type SortType = "recent" | "oldest" | "name";

// Tipo para conversa pendente (cliente sem mensagens ainda)
interface PendingConversation {
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerProfilePic: string | null;
}

export default function ConversationsPage() {
  const searchParams = useSearchParams();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [pendingConversation, setPendingConversation] = useState<PendingConversation | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);

  // Filtros e busca - carrega do localStorage se disponível
  const [searchTerm, setSearchTerm] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("conversations_filter_search") || "";
    }
    return "";
  });
  const [filterType, setFilterType] = useState<FilterType>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("conversations_filter_type") as FilterType) || "all";
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
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("conversations_advanced_filters");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (error) {
          console.error("Erro ao carregar filtros avançados:", error);
        }
      }
    }
    return {
      excludeGroups: false,
      selectedTags: [],
      onlyNeedsHelp: false,
      onlyAiEnabled: false,
    };
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

  // Usa SWR para gerenciar conversas com cache automático
  const { conversations, isLoading, isError, mutate } = useConversations(companyId);

  // Carrega os clientes para filtrar por tags
  const loadCustomers = async () => {
    try {
      const response = await customerApi.getAll();
      setCustomers(response.customers);
    } catch (err: any) {
      console.error("Error loading customers:", err);
    }
  };

  // Carrega instâncias do WhatsApp
  const loadInstances = async () => {
    if (!companyId) return;
    try {
      const response = await whatsappApi.getInstances(companyId);
      setInstances(response.data);
    } catch (err: any) {
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
    }
  }, [searchParams]);

  // Limpa a conversa pendente quando ela aparecer na lista de conversas
  useEffect(() => {
    if (pendingConversation) {
      const existsInList = conversations.some((c) => c.customerId === pendingConversation.customerId);
      if (existsInList) {
        setPendingConversation(null);
      }
    }
  }, [conversations, pendingConversation]);

  // Filtra e ordena conversas com useMemo para otimização
  const filteredConversations = useMemo(
    () =>
      conversations
        .filter((conv) => {
          // Filtro de busca
          if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            return (
              conv.customerName.toLowerCase().includes(searchLower) ||
              conv.customerPhone.includes(searchLower) ||
              conv.lastMessage?.toLowerCase().includes(searchLower)
            );
          }
          return true;
        })
        .filter((conv) => {
          // Filtro por tipo
          if (filterType === "ai") {
            return conv.aiEnabled;
          }
          if (filterType === "human") {
            return !conv.aiEnabled;
          }
          if (filterType === "unread") {
            return conv.unreadCount && conv.unreadCount > 0;
          }
          if (filterType === "needsHelp") {
            return conv.needsHelp;
          }
          return true;
        })
        .filter((conv) => {
          // Filtro avançado: Excluir grupos
          if (advancedFilters.excludeGroups) {
            // Debug: verificar grupos
            const hasGroupPattern = conv.customerPhone.includes("@g.us");
            if (hasGroupPattern || conv.isGroup) {
              return false;
            }
          }
          return true;
        })
        .filter((conv) => {
          // Filtro avançado: Filtrar por tags
          if (advancedFilters.selectedTags.length > 0) {
            const customer = customers.find((c) => c.id === conv.customerId);
            if (!customer) return false;

            // Verifica se o cliente tem pelo menos uma das tags selecionadas
            return advancedFilters.selectedTags.some((tag) => customer.tags.includes(tag));
          }
          return true;
        })
        .filter((conv) => {
          // Filtro avançado: Apenas conversas que precisam de ajuda
          if (advancedFilters.onlyNeedsHelp) {
            return conv.needsHelp === true;
          }
          return true;
        })
        .filter((conv) => {
          // Filtro avançado: Apenas conversas com IA ativa
          if (advancedFilters.onlyAiEnabled) {
            return conv.aiEnabled === true;
          }
          return true;
        })
        .filter((conv) => {
          // Filtro por instância do WhatsApp
          if (selectedInstanceId) {
            return conv.whatsappInstanceId === selectedInstanceId;
          }
          return true;
        })
        .sort((a, b) => {
          // Ordenação
          if (sortType === "recent") {
            return new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime();
          }
          if (sortType === "oldest") {
            return new Date(a.lastMessageTimestamp).getTime() - new Date(b.lastMessageTimestamp).getTime();
          }
          if (sortType === "name") {
            return a.customerName.localeCompare(b.customerName);
          }
          return 0;
        }),
    [conversations, searchTerm, filterType, sortType, advancedFilters, customers, selectedInstanceId]
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
  } : null);

  // Estatísticas
  const stats = {
    total: conversations.length,
    ai: conversations.filter((c) => c.aiEnabled).length,
    human: conversations.filter((c) => !c.aiEnabled).length,
    unread: conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0),
    needsHelp: conversations.filter((c) => c.needsHelp).length,
  };

  // Handler para selecionar conversa (muda view no mobile)
  const handleSelectConversation = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setMobileView("chat");
  };

  // Handler para voltar à lista no mobile
  const handleBackToList = () => {
    setMobileView("list");
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-muted/30">
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
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">Erro ao carregar conversas</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-muted/30">
      {/* Sidebar Esquerda: Lista de Conversas */}
      <div
        className={cn(
          "border-r bg-background transition-all duration-300 flex flex-col",
          // Mobile: tela cheia quando em view de lista, esconde quando em chat
          "fixed inset-0 z-20 lg:relative lg:z-auto",
          mobileView === "list" ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          showSidebar ? "lg:w-[320px]" : "lg:w-0",
          "w-full"
        )}
      >
        {(showSidebar || mobileView === "list") && (
          <>
            {/* Header da Sidebar */}
            <div className="p-3 border-b space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-xs">
                  {filteredConversations.length} de {conversations.length}
                </Badge>
                <NewConversationDialog
                  trigger={
                    <Button size="sm" variant="default">
                      <MessageSquarePlus className="h-4 w-4" />
                    </Button>
                  }
                  onConversationCreated={async (customer) => {
                    console.log("[Conversations] New conversation created for customer:", customer);

                    // Define a conversa pendente (cliente sem mensagens ainda)
                    setPendingConversation({
                      customerId: customer.id,
                      customerName: customer.name,
                      customerPhone: customer.phone,
                      customerProfilePic: customer.profilePicUrl || null,
                    });

                    // Seleciona o cliente
                    setSelectedCustomerId(customer.id);
                    console.log("[Conversations] Customer selected:", customer.id);

                    // Recarrega a lista de conversas em background
                    mutate();
                  }}
                />
              </div>

              {/* Filtros e Instância em linha */}
              <div className="flex items-center gap-2">
                <AdvancedFilters filters={advancedFilters} onFiltersChange={setAdvancedFilters} />
                {instances.length > 1 && (
                  <Select value={selectedInstanceId || "all"} onValueChange={(value) => setSelectedInstanceId(value === "all" ? null : value)}>
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <div className="flex items-center gap-1.5">
                        <Smartphone className="h-3 w-3" />
                        <SelectValue placeholder="Todas" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as instâncias</SelectItem>
                      {instances.map((instance) => (
                        <SelectItem key={instance.id} value={instance.id}>
                          {instance.displayName || instance.instanceName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
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
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button variant={filterType === "all" ? "default" : "outline"} size="sm" onClick={() => setFilterType("all")} className="h-6 text-xs px-2">
                  Todas {stats.total}
                </Button>
                <Button variant={filterType === "ai" ? "default" : "outline"} size="sm" onClick={() => setFilterType("ai")} className="h-6 text-xs px-2">
                  <Bot className="h-3 w-3 mr-1" />
                  IA {stats.ai}
                </Button>
                <Button variant={filterType === "human" ? "default" : "outline"} size="sm" onClick={() => setFilterType("human")} className="h-6 text-xs px-2">
                  <User className="h-3 w-3 mr-1" />
                  Humano {stats.human}
                </Button>
                {stats.unread > 0 && (
                  <Button variant={filterType === "unread" ? "default" : "outline"} size="sm" onClick={() => setFilterType("unread")} className="h-6 text-xs px-2">
                    <Badge variant="destructive" className="text-[10px] h-4 px-1">{stats.unread}</Badge>
                  </Button>
                )}
              </div>

              {/* Ordenação */}
              <Select value={sortType} onValueChange={(value: SortType) => setSortType(value)}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Mais recentes</SelectItem>
                  <SelectItem value="oldest">Mais antigas</SelectItem>
                  <SelectItem value="name">Nome (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Lista de Conversas */}
            <div className="flex-1 overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium">{searchTerm || filterType !== "all" ? "Nenhuma conversa encontrada" : "Nenhuma conversa"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {searchTerm || filterType !== "all" ? "Tente ajustar os filtros" : "Aguarde mensagens dos clientes"}
                  </p>
                </div>
              ) : (
                <ConversationList
                  conversations={filteredConversations}
                  selectedCustomerId={selectedCustomerId}
                  onSelectConversation={handleSelectConversation}
                />
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
          "flex-1 bg-background overflow-hidden flex flex-col",
          // Mobile: mostra apenas quando em view de chat
          mobileView === "chat" ? "block" : "hidden lg:flex"
        )}
      >
        {selectedConversation ? (
          <>
            {/* Botão voltar - apenas mobile */}
            <div className="lg:hidden border-b p-2">
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
            <ChatArea
              customerId={selectedConversation.customerId}
              customerName={selectedConversation.customerName}
              customerPhone={selectedConversation.customerPhone}
              onToggleDetails={() => setShowCustomerDetails(!showCustomerDetails)}
              showDetailsButton={true}
            />
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

      {/* Sidebar Direita: Detalhes do Cliente - oculto no mobile */}
      {selectedConversation && showCustomerDetails && (
        <div className="hidden lg:block w-[280px] border-l bg-background overflow-hidden">
          <CustomerDetails
            customerId={selectedConversation.customerId}
            customerName={selectedConversation.customerName}
            customerPhone={selectedConversation.customerPhone}
          />
        </div>
      )}
    </div>
  );
}
