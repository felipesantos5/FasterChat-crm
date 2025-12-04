"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { customerApi } from "@/lib/customer";
import { useCustomers, useCustomerTags } from "@/hooks/use-customers";
import { Customer } from "@/types/customer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CustomerFormModal } from "@/components/forms/customer-form-modal";
import { Plus, Search, Phone, Mail, MoreVertical, Edit, Trash, Users } from "lucide-react";
import { TagBadge } from "@/components/ui/tag-badge";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttons, cards, typography, spacing, icons } from "@/lib/design-system";

export default function CustomersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Obtém o companyId do usuário logado
  const getCompanyId = () => {
    if (typeof window === 'undefined') return null;
    const user = localStorage.getItem("user");
    if (user) {
      const userData = JSON.parse(user);
      return userData.companyId;
    }
    return null;
  };

  const companyId = getCompanyId();

  // Usa SWR para gerenciar customers com cache automático
  const { customers, isLoading, mutate } = useCustomers(companyId, {
    search,
    selectedTags,
  });

  // Usa SWR para tags
  const { tags: availableTags } = useCustomerTags(companyId);

  const handleCreate = async (data: any) => {
    await customerApi.create(data);
    mutate();
  };

  const handleUpdate = async (data: any) => {
    if (editingCustomer) {
      await customerApi.update(editingCustomer.id, data);
      mutate();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este cliente?")) {
      try {
        await customerApi.delete(id);
        mutate();
      } catch (error) {
        console.error("Error deleting customer:", error);
      }
    }
  };

  const toggleTagFilter = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className={spacing.page}>
      <div className={spacing.section}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className={`${typography.pageTitle} flex items-center gap-3`}>
              <Users className={`${icons.large} text-purple-600`} />
              Clientes
            </h1>
            <p className={typography.pageSubtitle}>
              Gerencie seus clientes e contatos
            </p>
          </div>
          <button
            onClick={() => {
              setEditingCustomer(undefined);
              setModalOpen(true);
            }}
            className={buttons.primary}
          >
            <Plus className={`${icons.default} inline-block mr-2`} />
            Novo Cliente
          </button>
        </div>

        {/* Filters */}
        <div className={`${cards.default} mb-6`}>
          <div className="relative">
            <Search className={`absolute left-4 top-1/2 ${icons.default} -translate-y-1/2 text-gray-400`} />
            <Input
              placeholder="Buscar por nome, telefone ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12"
            />
          </div>
        </div>

      {/* Tag Filters */}
      {availableTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground">Filtrar por:</span>
          {availableTags.map((tag) => (
            <Badge
              key={tag.id}
              className={cn(
                "cursor-pointer border transition-all text-white",
                selectedTags.includes(tag.name)
                  ? ""
                  : "bg-background text-muted-foreground hover:bg-accent"
              )}
              variant="outline"
              style={
                selectedTags.includes(tag.name)
                  ? {
                      backgroundColor: tag.color || '#8B5CF6',
                      borderColor: tag.color || '#8B5CF6',
                    }
                  : undefined
              }
              onClick={() => toggleTagFilter(tag.name)}
            >
              {tag.name}
            </Badge>
          ))}
          {selectedTags.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedTags([])}
              className="h-6 px-2 text-xs"
            >
              Limpar filtros
            </Button>
          )}
        </div>
      )}

      {/* Customer List */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Carregando clientes...</p>
        </div>
      ) : customers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              {search || selectedTags.length > 0
                ? "Nenhum cliente encontrado"
                : "Nenhum cliente cadastrado"}
            </p>
            {!search && selectedTags.length === 0 && (
              <Button onClick={() => setModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar primeiro cliente
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {customers.map((customer) => (
            <Card key={customer.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-semibold">
                  {customer.name}
                </CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
                    >
                      Ver detalhes
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setEditingCustomer(customer);
                        setModalOpen(true);
                      }}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(customer.id)}
                      className="text-destructive"
                    >
                      <Trash className="mr-2 h-4 w-4" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{customer.phone}</span>
                </div>
                {customer.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{customer.email}</span>
                  </div>
                )}
                {customer.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {customer.tags.map((tag) => (
                      <TagBadge
                        key={tag}
                        tag={tag}
                        tags={availableTags}
                        variant="outline"
                        className="text-xs"
                      />
                    ))}
                  </div>
                )}
                {customer.notes && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {customer.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <CustomerFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingCustomer(undefined);
        }}
        onSubmit={editingCustomer ? handleUpdate : handleCreate}
        customer={editingCustomer}
          availableTags={availableTags}
        />
      </div>
    </div>
  );
}
