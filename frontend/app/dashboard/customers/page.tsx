"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { customerApi } from "@/lib/customer";
import { Customer, CustomerListResponse } from "@/types/customer";
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
  const { hasError, handleError, clearError } = useErrorHandler();

  // Paginação
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  // Data
  const [data, setData] = useState<CustomerListResponse | null>(null);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
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

  // Load customers
  const loadCustomers = async () => {
    setIsLoading(true);
    clearError();
    try {
      const response = await customerApi.getAll({
        search: debouncedSearch || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
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
  }, [debouncedSearch, selectedTags, page, limit]);

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

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este cliente?")) {
      try {
        await customerApi.delete(id);
        loadCustomers();
      } catch (error) {
        console.error("Error deleting customer:", error);
      }
    }
  };

  const toggleTagFilter = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedTags([]);
    setPage(1);
  };

  // Paginação
  const totalPages = data ? Math.ceil(data.total / limit) : 0;
  const customers = data?.customers || [];
  const total = data?.total || 0;

  const hasActiveFilters = search || selectedTags.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header compacto */}
      <div className="flex-shrink-0 border-b bg-background p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <p className="text-xs sm:text-sm text-muted-foreground">
            {total} cliente{total !== 1 ? "s" : ""}
            {hasActiveFilters && " (filtrado)"}
          </p>

          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportModalOpen(true)} className="h-8 px-2 sm:px-3">
              <Upload className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Importar</span>
            </Button>
            <Button
              size="sm"
              className="h-8 px-2 sm:px-3"
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

        {/* Barra de busca e filtros */}
        <div className="flex items-center gap-2 mt-3 sm:mt-4">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar nome, telefone ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

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
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
              Limpar
            </Button>
          )}
        </div>

        {/* Filtros de tags */}
        {showFilters && availableTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
            {availableTags.map((tag) => (
              <Badge
                key={tag.id}
                className={cn(
                  "cursor-pointer transition-all",
                  selectedTags.includes(tag.name) ? "text-white" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
                style={
                  selectedTags.includes(tag.name)
                    ? {
                      backgroundColor: tag.color || "#22C55E",
                      borderColor: tag.color || "#22C55E",
                    }
                    : undefined
                }
                onClick={() => toggleTagFilter(tag.name)}
              >
                {tag.name}
              </Badge>
            ))}
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
                          handleDelete(customer.id);
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
    </div>
  );
}
