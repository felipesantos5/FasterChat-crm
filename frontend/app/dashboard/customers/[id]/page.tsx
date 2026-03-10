"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { customerApi } from "@/lib/customer";
import { customerAddressApi } from "@/lib/customer-address";
import { customerServiceCardApi } from "@/lib/customer-service-card";
import { customerNoteApi } from "@/lib/customer-note";
import { Customer } from "@/types/customer";
import { CustomerNote } from "@/types/customer-note";
import { CustomerAddress } from "@/types/customer-address";
import {
  CustomerServiceCard,
  SERVICE_CARD_STATUS_LABELS,
  SERVICE_CARD_STATUS_COLORS,
} from "@/types/customer-service-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CustomerFormModal } from "@/components/forms/customer-form-modal";
import { AddressFormModal } from "@/components/customers/address-form-modal";
import { ServiceCardFormModal } from "@/components/customers/service-card-form-modal";
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  Edit,
  Trash,
  FileText,
  MessageSquare,
  MapPin,
  Plus,
  Star,
  Clock,
  DollarSign,
  MoreVertical,
  Home,
  User,
  StickyNote,
  X,
} from "lucide-react";
import { TagBadge } from "@/components/ui/tag-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tag } from "@/lib/tag";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatPhoneNumber } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();

  // Customer state
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);

  // Addresses state
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | undefined>();
  const [addressToDelete, setAddressToDelete] = useState<CustomerAddress | null>(null);

  // Service cards state
  const [serviceCards, setServiceCards] = useState<CustomerServiceCard[]>([]);
  const [serviceCardModalOpen, setServiceCardModalOpen] = useState(false);
  const [editingServiceCard, setEditingServiceCard] = useState<CustomerServiceCard | undefined>();
  const [serviceCardToDelete, setServiceCardToDelete] = useState<CustomerServiceCard | null>(null);

  // Customer notes state
  const [customerNotes, setCustomerNotes] = useState<CustomerNote[]>([]);

  // Delete customer modal state
  const [deleteCustomerModalOpen, setDeleteCustomerModalOpen] = useState(false);

  // Avatar lightbox
  const [avatarZoomOpen, setAvatarZoomOpen] = useState(false);

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

  const loadAddresses = async () => {
    try {
      const data = await customerAddressApi.getAll(params.id as string);
      setAddresses(data);
    } catch (error) {
      console.error("Error loading addresses:", error);
      setAddresses([]);
    }
  };

  const loadServiceCards = async () => {
    try {
      const data = await customerServiceCardApi.getAll(params.id as string);
      setServiceCards(data);
    } catch (error) {
      console.error("Error loading service cards:", error);
      setServiceCards([]);
    }
  };

  const loadCustomerNotes = async () => {
    try {
      const response = await customerNoteApi.getCustomerNotes(params.id as string);
      setCustomerNotes(response.data);
    } catch (error) {
      console.error("Error loading customer notes:", error);
      setCustomerNotes([]);
    }
  };

  useEffect(() => {
    loadCustomer();
    loadTags();
    loadAddresses();
    loadServiceCards();
    loadCustomerNotes();
  }, [params.id]);

  const handleUpdate = async (data: any) => {
    if (customer) {
      await customerApi.update(customer.id, data);
      await loadCustomer();
      toast.success("Cliente atualizado com sucesso!");
    }
  };

  const handleDeleteClick = () => {
    setDeleteCustomerModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!customer) return;

    try {
      await customerApi.delete(customer.id);
      setDeleteCustomerModalOpen(false);
      toast.success("Cliente excluído com sucesso!");
      router.push("/dashboard/customers");
    } catch (error) {
      console.error("Error deleting customer:", error);
      toast.error("Erro ao excluir cliente");
    }
  };

  // Address handlers
  const handleAddAddress = async (data: any) => {
    if (customer) {
      await customerAddressApi.create(customer.id, data);
      await loadAddresses();
      toast.success("Endereço adicionado com sucesso!");
    }
  };

  const handleUpdateAddress = async (data: any) => {
    if (customer && editingAddress) {
      await customerAddressApi.update(customer.id, editingAddress.id, data);
      await loadAddresses();
      toast.success("Endereço atualizado com sucesso!");
    }
  };

  const handleDeleteAddress = async () => {
    if (customer && addressToDelete) {
      try {
        await customerAddressApi.delete(customer.id, addressToDelete.id);
        await loadAddresses();
        setAddressToDelete(null);
        toast.success("Endereço excluído com sucesso!");
      } catch (error) {
        console.error("Error deleting address:", error);
        toast.error("Erro ao excluir endereço");
      }
    }
  };

  const handleSetDefaultAddress = async (address: CustomerAddress) => {
    if (customer) {
      try {
        await customerAddressApi.setDefault(customer.id, address.id);
        await loadAddresses();
        toast.success("Endereço definido como principal!");
      } catch (error) {
        console.error("Error setting default address:", error);
        toast.error("Erro ao definir endereço principal");
      }
    }
  };

  // Service card handlers
  const handleAddServiceCard = async (data: any) => {
    if (customer) {
      await customerServiceCardApi.create(customer.id, data);
      await loadServiceCards();
      toast.success("Card de serviço adicionado com sucesso!");
    }
  };

  const handleUpdateServiceCard = async (data: any) => {
    if (customer && editingServiceCard) {
      await customerServiceCardApi.update(customer.id, editingServiceCard.id, data);
      await loadServiceCards();
      toast.success("Card de serviço atualizado com sucesso!");
    }
  };

  const handleDeleteServiceCard = async () => {
    if (customer && serviceCardToDelete) {
      try {
        await customerServiceCardApi.delete(customer.id, serviceCardToDelete.id);
        await loadServiceCards();
        setServiceCardToDelete(null);
        toast.success("Card de serviço excluído com sucesso!");
      } catch (error) {
        console.error("Error deleting service card:", error);
        toast.error("Erro ao excluir card de serviço");
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-64 md:col-span-2" />
          <Skeleton className="h-64" />
        </div>
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
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="hover:bg-gray-100 rounded-full"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {/* Avatar do cliente */}
          <div
            onClick={() => customer.profilePicUrl && setAvatarZoomOpen(true)}
            className={customer.profilePicUrl ? "cursor-zoom-in" : ""}
          >
            <Avatar className="h-14 w-14 border-2 border-primary/20 shadow-sm">
              <AvatarImage src={customer.profilePicUrl || undefined} alt={customer.name} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                {customer.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-bold tracking-tight">{customer.name}</h1>
              {customer.isGroup && (
                <Badge variant="secondary">Grupo</Badge>
              )}
              {customer.pipelineStage ? (
                <Badge
                  className="text-[10px] h-5 uppercase font-bold px-2 border"
                  style={{
                    backgroundColor: `${customer.pipelineStage.color}22`,
                    borderColor: customer.pipelineStage.color,
                    color: customer.pipelineStage.color,
                  }}
                >
                  {customer.pipelineStage.name}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] h-5 uppercase font-bold px-2 text-muted-foreground">
                  Sem Funil
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">Detalhes do cliente</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              const url = `/dashboard/conversations?customer=${customer.id}`;
              router.push(url);
            }}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Abrir Chat
          </Button>
          <Button variant="outline" onClick={() => setModalOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Button>
          <Button variant="destructive" onClick={handleDeleteClick}>
            <Trash className="mr-2 h-4 w-4" />
            Excluir
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Contact Info & Notes */}
        <div className="space-y-6 lg:col-span-2">
          {/* Contact Info */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div className="space-y-1.5">
                <CardTitle>Informações de Contato</CardTitle>
                <CardDescription>Dados de contato do cliente</CardDescription>
              </div>
              {customer.pipelineStage ? (
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
              ) : (
                <Badge variant="destructive" className="text-xs bg-red-500 hover:bg-red-600">
                  Sem Funil
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-blue-100 p-2">
                    <Phone className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Telefone</p>
                    <p className="text-sm text-muted-foreground">
                      {formatPhoneNumber(customer.phone)}
                    </p>
                  </div>
                </div>

                {customer.email && (
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-green-100 p-2">
                      <Mail className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <p className="text-sm text-muted-foreground">
                        {customer.email}
                      </p>
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
              </div>

              {customer.tags.length > 0 && (
                <div className="pt-2 border-t">
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

          {/* Notes */}
          {customer.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Observações Gerais
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{customer.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Custom Fields */}
          {customer.customFieldValues && customer.customFieldValues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Campos Personalizados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {customer.customFieldValues.map((cfv) => {
                    let display = cfv.value ?? "—";
                    if (cfv.value) {
                      if (cfv.field.type === "date") {
                        try {
                          display = new Date(cfv.value).toLocaleDateString("pt-BR");
                        } catch {
                          display = cfv.value;
                        }
                      } else if (cfv.field.type === "number") {
                        const n = parseFloat(cfv.value);
                        display = isNaN(n) ? cfv.value : n.toLocaleString("pt-BR");
                      }
                    }
                    return (
                      <div key={cfv.id}>
                        <p className="text-sm font-medium">{cfv.field.label}</p>
                        <p className="text-sm text-muted-foreground">{display}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Customer Notes - Observações do Chat */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StickyNote className="h-5 w-5" />
                Notas do Atendimento
              </CardTitle>
              <CardDescription>
                Observações adicionadas durante as conversas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {customerNotes.length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center text-center">
                  <StickyNote className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma nota de atendimento registrada
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    As notas podem ser adicionadas na área de conversas
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {customerNotes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="space-y-2">
                        <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{note.user.name}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(note.createdAt), "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR,
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Service Cards */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Histórico de Serviços
                </CardTitle>
                <CardDescription>
                  Registros de serviços realizados para este cliente
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setEditingServiceCard(undefined);
                  setServiceCardModalOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar
              </Button>
            </CardHeader>
            <CardContent>
              {serviceCards.length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center text-center">
                  <Clock className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum serviço registrado ainda
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setEditingServiceCard(undefined);
                      setServiceCardModalOpen(true);
                    }}
                  >
                    Adicionar primeiro serviço
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {serviceCards.map((card) => (
                    <div
                      key={card.id}
                      className="rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{card.title}</h4>
                            <Badge
                              variant="secondary"
                              className={SERVICE_CARD_STATUS_COLORS[card.status]}
                            >
                              {SERVICE_CARD_STATUS_LABELS[card.status]}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {card.description}
                          </p>
                          <div className="flex items-center gap-4 pt-2">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(card.serviceDate), "dd/MM/yyyy", {
                                locale: ptBR,
                              })}
                            </div>
                            {card.price && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <DollarSign className="h-3 w-3" />
                                R$ {card.price.toFixed(2)}
                              </div>
                            )}
                            {card.rating && (
                              <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-3 w-3 ${i < card.rating!
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-gray-300"
                                      }`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingServiceCard(card);
                                setServiceCardModalOpen(true);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setServiceCardToDelete(card)}
                            >
                              <Trash className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Addresses */}
        <div className="space-y-6">
          {/* Addresses */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Endereços
                </CardTitle>
                <CardDescription>Endereços cadastrados</CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingAddress(undefined);
                  setAddressModalOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {addresses.length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center text-center">
                  <Home className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum endereço cadastrado
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setEditingAddress(undefined);
                      setAddressModalOpen(true);
                    }}
                  >
                    Adicionar endereço
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map((address) => (
                    <div
                      key={address.id}
                      className="rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {address.label}
                            </span>
                            {address.isDefault && (
                              <Badge variant="secondary" className="text-xs">
                                Principal
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {address.street}, {address.number}
                            {address.complement && ` - ${address.complement}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {address.neighborhood}, {address.city} - {address.state}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            CEP: {address.zipCode}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!address.isDefault && (
                              <DropdownMenuItem
                                onClick={() => handleSetDefaultAddress(address)}
                              >
                                <Star className="mr-2 h-4 w-4" />
                                Definir como principal
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingAddress(address);
                                setAddressModalOpen(true);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setAddressToDelete(address)}
                            >
                              <Trash className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estatísticas Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Total de Serviços</p>
                <p className="text-2xl font-bold">{serviceCards.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Serviços Concluídos</p>
                <p className="text-2xl font-bold">
                  {serviceCards.filter((c) => c.status === "completed").length}
                </p>
              </div>
              {serviceCards.some((c) => c.price) && (
                <div>
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="text-2xl font-bold">
                    R${" "}
                    {serviceCards
                      .reduce((acc, c) => acc + (c.price || 0), 0)
                      .toFixed(2)}
                  </p>
                </div>
              )}
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">Última Atualização</p>
                <p className="text-sm font-medium">
                  {format(new Date(customer.updatedAt), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modals */}
      <CustomerFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleUpdate}
        customer={customer}
        availableTags={availableTags}
        onTagCreated={loadTags}
      />

      <AddressFormModal
        open={addressModalOpen}
        onClose={() => {
          setAddressModalOpen(false);
          setEditingAddress(undefined);
        }}
        onSubmit={editingAddress ? handleUpdateAddress : handleAddAddress}
        address={editingAddress}
      />

      <ServiceCardFormModal
        open={serviceCardModalOpen}
        onClose={() => {
          setServiceCardModalOpen(false);
          setEditingServiceCard(undefined);
        }}
        onSubmit={editingServiceCard ? handleUpdateServiceCard : handleAddServiceCard}
        serviceCard={editingServiceCard}
      />

      {/* Delete Address Confirmation */}
      <AlertDialog
        open={!!addressToDelete}
        onOpenChange={() => setAddressToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Endereço</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o endereço "{addressToDelete?.label}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAddress}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Service Card Confirmation */}
      <AlertDialog
        open={!!serviceCardToDelete}
        onOpenChange={() => setServiceCardToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Card de Serviço</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o card "{serviceCardToDelete?.title}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteServiceCard}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Customer Confirmation */}
      <AlertDialog open={deleteCustomerModalOpen} onOpenChange={setDeleteCustomerModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Tem certeza que deseja excluir <strong>{customer?.name}</strong>?
              </p>
              <p className="text-destructive font-medium">
                ⚠️ Todas as conversas, mensagens, endereços e serviços deste cliente também serão excluídos permanentemente.
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

      {/* Avatar Lightbox */}
      {avatarZoomOpen && customer.profilePicUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 !mt-0"
          onClick={() => setAvatarZoomOpen(false)}
        >
          <button
            onClick={() => setAvatarZoomOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X size={24} />
          </button>
          <img
            src={customer.profilePicUrl}
            alt={customer.name}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[85vw] rounded-2xl object-contain shadow-2xl animate-in zoom-in-95 duration-200"
          />
        </div>
      )}
    </div>
  );
}
