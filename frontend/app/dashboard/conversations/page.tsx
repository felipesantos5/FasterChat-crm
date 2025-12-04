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
import { Loader2, MessageSquare, Search, X, Bot, User, ChevronRight, HelpCircle, MessageSquarePlus, Smartphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type FilterType = "all" | "ai" | "human" | "unread" | "needsHelp";
type SortType = "recent" | "oldest" | "name";

export default function ConversationsPage() {
  const searchParams = useSearchParams();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);

  // Filtros e busca
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortType, setSortType] = useState<SortType>("recent");
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFiltersType>({
    excludeGroups: false,
    selectedTags: [],
    onlyNeedsHelp: false,
    onlyAiEnabled: false,
  });

  // Layout
  const [showSidebar, setShowSidebar] = useState(true);
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const sidebarWidth = 360;

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
              console.log(`[Filtro] Grupo excluído: ${conv.customerName} (isGroup: ${conv.isGroup}, phone: ${conv.customerPhone})`);
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
  const selectedConversation = conversations.find((c) => c.customerId === selectedCustomerId);

  // Estatísticas
  const stats = {
    total: conversations.length,
    ai: conversations.filter((c) => c.aiEnabled).length,
    human: conversations.filter((c) => !c.aiEnabled).length,
    unread: conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0),
    needsHelp: conversations.filter((c) => c.needsHelp).length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
        className={cn("border-r bg-background transition-all duration-300 flex flex-col", showSidebar ? "w-[360px]" : "w-0")}
        style={{ width: showSidebar ? `${sidebarWidth}px` : 0 }}
      >
        {showSidebar && (
          <>
            {/* Header da Sidebar */}
            <div className="p-4 border-b space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-base">Conversas</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {filteredConversations.length} de {conversations.length}
                  </p>
                </div>
                <NewConversationDialog
                  trigger={
                    <Button size="sm" variant="default">
                      <MessageSquarePlus className="h-4 w-4" />
                    </Button>
                  }
                  onConversationCreated={async (customerId) => {
                    console.log('[Conversations] New conversation created, customer ID:', customerId);

                    // Primeiro, seleciona o cliente
                    setSelectedCustomerId(customerId);
                    console.log('[Conversations] Customer selected:', customerId);

                    // Aguarda um pouco para WebSocket processar
                    await new Promise(resolve => setTimeout(resolve, 300));

                    // Recarrega a lista de conversas para garantir que está atualizada
                    await mutate();
                    console.log('[Conversations] Conversations reloaded');

                    // Garante que o cliente ainda está selecionado após o reload
                    setSelectedCustomerId(customerId);
                    console.log('[Conversations] Chat confirmed open for customer:', customerId);
                  }}
                />
              </div>

              {/* Filtros Avançados */}
              <div>
                <AdvancedFilters filters={advancedFilters} onFiltersChange={setAdvancedFilters} />
              </div>

              {/* Seletor de Instância */}
              {instances.length > 0 && (
                <div>
                  <Select value={selectedInstanceId || "all"} onValueChange={(value) => setSelectedInstanceId(value === "all" ? null : value)}>
                    <SelectTrigger className="h-9 text-xs">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-3 w-3" />
                        <SelectValue placeholder="Todas as instâncias" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-3 w-3" />
                          <span>Todas as instâncias</span>
                        </div>
                      </SelectItem>
                      {instances.map((instance) => (
                        <SelectItem key={instance.id} value={instance.id}>
                          <div className="flex items-center gap-2">
                            <Smartphone className="h-3 w-3" />
                            <span>
                              {instance.displayName || instance.instanceName}
                              {instance.phoneNumber && ` (${instance.phoneNumber})`}
                            </span>
                            {instance.status === "CONNECTED" && (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                Conectada
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Busca */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar conversas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-9 h-9"
                />
                {searchTerm && (
                  <Button variant="ghost" size="icon" onClick={() => setSearchTerm("")} className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7">
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Filtros Rápidos */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant={filterType === "all" ? "default" : "outline"} size="sm" onClick={() => setFilterType("all")} className="h-7 text-xs">
                  Todas
                  <Badge variant="secondary" className="ml-1.5 text-xs">
                    {stats.total}
                  </Badge>
                </Button>
                <Button variant={filterType === "ai" ? "default" : "outline"} size="sm" onClick={() => setFilterType("ai")} className="h-7 text-xs">
                  <Bot className="h-3 w-3 mr-1" />
                  IA
                  <Badge variant="secondary" className="ml-1.5 text-xs">
                    {stats.ai}
                  </Badge>
                </Button>
                <Button
                  variant={filterType === "human" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType("human")}
                  className="h-7 text-xs"
                >
                  <User className="h-3 w-3 mr-1" />
                  Humano
                  <Badge variant="secondary" className="ml-1.5 text-xs">
                    {stats.human}
                  </Badge>
                </Button>
                {stats.unread > 0 && (
                  <Button
                    variant={filterType === "unread" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterType("unread")}
                    className="h-7 text-xs"
                  >
                    Não lidas
                    <Badge variant="destructive" className="ml-1.5 text-xs">
                      {stats.unread}
                    </Badge>
                  </Button>
                )}
                {stats.needsHelp > 0 && (
                  <Button
                    variant={filterType === "needsHelp" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterType("needsHelp")}
                    className="h-7 text-xs"
                  >
                    <HelpCircle className="h-3 w-3 mr-1" />
                    Ajuda
                    <Badge variant="secondary" className="ml-1.5 text-xs bg-yellow-100 text-yellow-800">
                      {stats.needsHelp}
                    </Badge>
                  </Button>
                )}
              </div>

              {/* Ordenação */}
              <div className="flex items-center gap-2">
                <Select value={sortType} onValueChange={(value: SortType) => setSortType(value)}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Mais recentes</SelectItem>
                    <SelectItem value="oldest">Mais antigas</SelectItem>
                    <SelectItem value="name">Nome (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                  onSelectConversation={setSelectedCustomerId}
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
      <div className="flex-1 bg-background overflow-hidden flex flex-col">
        {selectedConversation ? (
          <>
            {/* Header do Chat */}
            <div className="h-16 border-b px-6 flex items-center justify-between bg-background">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{selectedConversation.customerName}</h3>
                  <p className="text-xs text-muted-foreground">{selectedConversation.customerPhone}</p>
                </div>
                {selectedConversation.aiEnabled ? (
                  <Badge variant="outline" className="text-xs">
                    <Bot className="h-3 w-3 mr-1" />
                    IA Ativa
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    <User className="h-3 w-3 mr-1" />
                    Atendimento Humano
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCustomerDetails(!showCustomerDetails)}>
                  {showCustomerDetails ? "Ocultar" : "Mostrar"} Detalhes
                </Button>
              </div>
            </div>

            {/* Área de Mensagens */}
            <div className="flex-1 overflow-hidden">
              <ChatArea
                customerId={selectedConversation.customerId}
                customerName={selectedConversation.customerName}
                customerPhone={selectedConversation.customerPhone}
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
        <div className="max-w-[280px] border-l bg-background overflow-hidden">
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
