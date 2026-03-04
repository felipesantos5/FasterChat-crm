"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { customerApi } from "@/lib/customer";
import { Customer, CustomerListResponse } from "@/types/customer";
import { pipelineApi } from "@/lib/pipeline";
import { PipelineStage } from "@/types/pipeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CustomerFormModal } from "@/components/forms/customer-form-modal";
import {
  Plus,
  Search,
  Phone,
  Mail,
  MoreVertical,
  Edit,
  Trash,
  Users,
  ChevronLeft,
  ChevronRight,
  Eye,
  MessageSquare,
  Upload,
  X,
  Filter,
} from "lucide-react";
import { TagBadge } from "@/components/ui/tag-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, formatPhoneNumber } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ImportCustomersDialog } from "@/components/customers/import-customers-dialog";
import { Tag } from "@/lib/tag";
import { tagApi } from "@/lib/tag";
import { Card } from "@/components/ui/card";
import { CustomerGridSkeleton } from "@/components/ui/skeletons";
import { ProtectedPage } from "@/components/layout/protected-page";
import { LoadingErrorState } from "@/components/ui/error-state";
import { useErrorHandler } from "@/hooks/use-error-handler";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function CustomersPage() {
  return (
    <ProtectedPage requiredPage="CUSTOMERS">
      <CustomersPageContent />
    </ProtectedPage>
  );
}

function CustomersPageContent() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [orderBy, setOrderBy] = useState<"recent" | "old" | "az" | "za">("recent");
  const [typeFilter, setTypeFilter] = useState<"all" | "individual" | "group">("all");
  const [pipelineStageFilter, setPipelineStageFilter] = useState<string>("all");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const { hasError, handleError, clearError } = useErrorHandler();

  // Paginação
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  // Data
  const [data, setData] = useState<CustomerListResponse | null>(null);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load tags
  const loadTags = async () => {
    try {
      const tags = await tagApi.getAll();
      setAvailableTags(tags);
    } catch (error) {
      console.error("Error loading tags:", error);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  // Load pipeline stages
  const loadPipelineStages = async () => {
    let companyId = "";
    if (typeof window !== "undefined") {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          companyId = user.companyId || "";
        } catch (e) { }
      }
    }

    if (!companyId) return;

    try {
      const stages = await pipelineApi.getStages(companyId);
      setPipelineStages(stages);
    } catch (error) {
      console.error("Error loading pipeline stages:", error);
    }
  };

  useEffect(() => {
    loadPipelineStages();
  }, []);

  // Load customers
  const loadCustomers = async () => {
    setIsLoading(true);
    clearError();
    try {
      const response = await customerApi.getAll({
        search: debouncedSearch || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        orderBy,
        type: typeFilter,
        pipelineStageId: pipelineStageFilter !== "all" ? pipelineStageFilter : undefined,
        page,
        limit,
      });
      setData(response);
    } catch (error: any) {
      console.error("Error loading customers:", error);
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [debouncedSearch, selectedTags, orderBy, typeFilter, pipelineStageFilter, page, limit]);

  const handleCreate = async (customerData: any) => {
    await customerApi.create(customerData);
    loadCustomers();
  };

  const handleUpdate = async (customerData: any) => {
    if (editingCustomer) {
      await customerApi.update(editingCustomer.id, customerData);
      loadCustomers();
    }
  };

  const handleDeleteClick = (customer: Customer) => {
    setCustomerToDelete(customer);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!customerToDelete) return;

    try {
      await customerApi.delete(customerToDelete.id);
      setDeleteModalOpen(false);
      setCustomerToDelete(null);
      loadCustomers();
    } catch (error) {
      console.error("Error deleting customer:", error);
    }
  };

  const toggleTagFilter = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedTags([]);
    setOrderBy("recent");
    setTypeFilter("all");
    setPipelineStageFilter("all");
    setPage(1);
  };

  // Paginação
  const totalPages = data ? Math.ceil(data.total / limit) : 0;
  const customers = data?.customers || [];
  const total = data?.total || 0;

  const hasActiveFilters = search || selectedTags.length > 0 || orderBy !== "recent" || typeFilter !== "all" || pipelineStageFilter !== "all";

  return (
    <div className="flex flex-col h-full">
      {/* Header compacto */}
      <div className="flex-shrink-0 border-b bg-background p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
          {/* Barra de busca e filtros */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar nome, telefone ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant={showFilters ? "secondary" : "outline"} size="sm" onClick={() => setShowFilters(!showFilters)} className="h-9">
                <Filter className="h-4 w-4 mr-1" />
                Filtros
                {selectedTags.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {selectedTags.length}
                  </Badge>
                )}
              </Button>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 mb-0">
                  Limpar
                </Button>
              )}

              <p className="text-xs sm:text-sm text-muted-foreground ml-1 sm:ml-2 whitespace-nowrap">
                {total} cliente{total !== 1 ? "s" : ""}
                {hasActiveFilters && " (filtrado)"}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 self-end sm:self-auto">
            <Button variant="outline" size="sm" onClick={() => setImportModalOpen(true)} className="h-9 px-2 sm:px-3">
              <Upload className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Importar</span>
            </Button>
            <Button
              size="sm"
              className="h-9 px-2 sm:px-3"
              onClick={() => {
                setEditingCustomer(undefined);
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Novo</span>
            </Button>
          </div>
        </div>

        {/* Filtros e Ordenação Avançados */}
        {showFilters && (
          <div className="mt-4 pt-3 border-t space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="space-y-1.5 flex-1 max-w-[200px]">
                <label className="text-xs font-medium text-muted-foreground">Ordenar por</label>
                <select
                  className="w-full flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={orderBy}
                  onChange={(e) => setOrderBy(e.target.value as any)}
                >
                  <option value="recent">Mais recentes</option>
                  <option value="old">Mais antigos</option>
                  <option value="az">Nome (A-Z)</option>
                  <option value="za">Nome (Z-A)</option>
                </select>
              </div>

              <div className="space-y-1.5 flex-1 max-w-[200px]">
                <label className="text-xs font-medium text-muted-foreground">Tipo de Contato</label>
                <select
                  className="w-full flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                >
                  <option value="all">Todos</option>
                  <option value="individual">Individuais</option>
                  <option value="group">Grupos</option>
                </select>
              </div>

              <div className="space-y-1.5 flex-1 max-w-[200px]">
                <label className="text-xs font-medium text-muted-foreground">Estágio do Funil</label>
                <select
                  className="w-full flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={pipelineStageFilter}
                  onChange={(e) => setPipelineStageFilter(e.target.value)}
                >
                  <option value="all">Todos</option>
                  {pipelineStages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {availableTags.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Filtrar por Tags</label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag.name);
                    const tagColor = tag.color || "#22C55E";
                    return (
                      <Badge
                        key={tag.id}
                        className={cn(
                          "cursor-pointer transition-all border",
                          isSelected ? "shadow-sm text-white scale-105" : "text-foreground opacity-70 hover:opacity-100"
                        )}
                        style={{
                          backgroundColor: isSelected ? tagColor : `${tagColor}22`,
                          borderColor: tagColor,
                          color: isSelected ? "#fff" : tagColor,
                        }}
                        onClick={() => toggleTagFilter(tag.name)}
                      >
                        {tag.name}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grid de clientes */}
      <div className="flex-1 overflow-auto p-3 sm:p-4">
        {isLoading ? (
          <CustomerGridSkeleton />
        ) : hasError ? (
          <LoadingErrorState resource="clientes" onRetry={loadCustomers} />
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground mb-2">{hasActiveFilters ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}</p>
            {!hasActiveFilters && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingCustomer(undefined);
                  setModalOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar cliente
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {customers.map((customer) => (
              <Card
                key={customer.id}
                className="p-3 sm:p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
              >
                <div className="flex items-start justify-between gap-2 sm:gap-3">
                  {/* Avatar do cliente */}
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={customer.profilePicUrl || undefined} alt={customer.name} />
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {customer.isGroup ? (
                        <Users className="h-5 w-5" />
                      ) : (
                        customer.name.charAt(0).toUpperCase()
                      )}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    {/* Nome e badge de grupo */}
                    <div className="flex items-center gap-2 mb-2">
                      {customer.isGroup && (
                        <Badge variant="outline" className="text-xs px-1 flex-shrink-0">
                          Grupo
                        </Badge>
                      )}
                      <span className="font-medium truncate">{customer.name}</span>
                    </div>

                    {/* Telefone */}
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="text-sm">{formatPhoneNumber(customer.phone)}</span>
                    </div>

                    {/* Email */}
                    {customer.email && (
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
                        <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="text-sm truncate">{customer.email}</span>
                      </div>
                    )}

                    {/* Estágio do Funil */}
                    {customer.pipelineStage && (
                      <div className="mb-2">
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{
                            backgroundColor: `${customer.pipelineStage.color}15`,
                            borderColor: customer.pipelineStage.color,
                            color: customer.pipelineStage.color
                          }}
                        >
                          {customer.pipelineStage.name}
                        </Badge>
                      </div>
                    )}

                    {/* Tags */}
                    {customer.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {customer.tags.slice(0, 3).map((tag) => (
                          <TagBadge key={tag} tag={tag} tags={availableTags} className="text-xs" />
                        ))}
                        {customer.tags.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{customer.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Menu de ações */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/customers/${customer.id}`);
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Ver detalhes
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/conversations?customer=${customer.id}`);
                        }}
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Ver conversas
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCustomer(customer);
                          setModalOpen(true);
                        }}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(customer);
                        }}
                        className="text-destructive"
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 border-t bg-background px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Mostrando {(page - 1) * limit + 1} a {Math.min(page * limit, total)} de {total} clientes
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? "default" : "outline"}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                Próximo
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modais */}
      <CustomerFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingCustomer(undefined);
        }}
        onSubmit={editingCustomer ? handleUpdate : handleCreate}
        customer={editingCustomer}
        availableTags={availableTags}
        onTagCreated={loadTags}
      />
      <ImportCustomersDialog
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => {
          loadCustomers();
        }}
      />

      {/* Modal de confirmação de exclusão */}
      <AlertDialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Tem certeza que deseja excluir <strong>{customerToDelete?.name}</strong>?
              </p>
              <p className="text-destructive font-medium">
                ⚠️ Todas as conversas e mensagens deste cliente também serão excluídas permanentemente.
              </p>
              <p className="text-sm">Esta ação não pode ser desfeita.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
