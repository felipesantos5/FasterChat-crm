"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { customerApi } from "@/lib/customer";
import { Customer } from "@/types/customer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CustomerFormModal } from "@/components/forms/customer-form-modal";
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  Edit,
  Trash,
  FileText,
} from "lucide-react";
import { TagBadge } from "@/components/ui/tag-badge";
import { Tag } from "@/lib/tag";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);

  const loadCustomer = async () => {
    try {
      setLoading(true);
      const data = await customerApi.getById(params.id as string);
      setCustomer(data);
    } catch (error) {
      console.error("Error loading customer:", error);
      router.push("/dashboard/customers");
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const tags = await customerApi.getAllTags();
      setAvailableTags(tags);
    } catch (error) {
      console.error("Error loading tags:", error);
    }
  };

  useEffect(() => {
    loadCustomer();
    loadTags();
  }, [params.id]);

  const handleUpdate = async (data: any) => {
    if (customer) {
      await customerApi.update(customer.id, data);
      await loadCustomer();
    }
  };

  const handleDelete = async () => {
    if (customer && confirm("Tem certeza que deseja excluir este cliente?")) {
      try {
        await customerApi.delete(customer.id);
        router.push("/dashboard/customers");
      } catch (error) {
        console.error("Error deleting customer:", error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center">
        <p className="text-muted-foreground mb-4">Cliente não encontrado</p>
        <Button onClick={() => router.push("/dashboard/customers")}>
          Voltar para Clientes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/customers")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{customer.name}</h1>
            <p className="text-muted-foreground">Detalhes do cliente</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setModalOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash className="mr-2 h-4 w-4" />
            Excluir
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Contact Info */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Informações de Contato</CardTitle>
            <CardDescription>Dados de contato do cliente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-blue-100 p-2">
                <Phone className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Telefone</p>
                <p className="text-sm text-muted-foreground">{customer.phone}</p>
              </div>
            </div>

            {customer.email && (
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-green-100 p-2">
                  <Mail className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{customer.email}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <div className="rounded-full bg-purple-100 p-2">
                <Calendar className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Cliente desde</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(customer.createdAt), "dd 'de' MMMM 'de' yyyy", {
                    locale: ptBR,
                  })}
                </p>
              </div>
            </div>

            {customer.tags.length > 0 && (
              <div className="pt-2">
                <p className="text-sm font-medium mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {customer.tags.map((tag) => (
                    <TagBadge
                      key={tag}
                      tag={tag}
                      tags={availableTags}
                      variant="outline"
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline / Quick Stats */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Estatísticas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Total de Conversas</p>
                <p className="text-2xl font-bold">0</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Última Interação</p>
                <p className="text-sm font-medium">Nenhuma ainda</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Última Atualização</p>
                <p className="text-sm font-medium">
                  {format(new Date(customer.updatedAt), "dd/MM/yyyy", {
                    locale: ptBR,
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Notes */}
      {customer.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Observações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{customer.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Activity History */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Atividades</CardTitle>
          <CardDescription>
            Conversas e interações com este cliente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            Nenhuma atividade registrada
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <CustomerFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleUpdate}
        customer={customer}
        availableTags={availableTags}
      />
    </div>
  );
}
