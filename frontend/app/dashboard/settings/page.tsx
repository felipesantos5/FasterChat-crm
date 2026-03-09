"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Bot, Smartphone, Zap, Plus, User, Trash, Edit, Clock, X, Users } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/store/auth.store";
import { collaboratorApi, Collaborator, PendingInvite } from "@/lib/collaborator";
import { InviteCollaboratorModal } from "@/components/collaborators/invite-modal";
import { EditPermissionsModal } from "@/components/collaborators/edit-permissions-modal";
import { toast } from "sonner";

const settingsItems = [
  {
    label: "Agente",
    description: "Configure o comportamento da IA e base de conhecimento",
    icon: Bot,
    href: "/dashboard/settings/ai",
    color: "text-violet-600",
    bg: "bg-violet-50",
  },
  {
    label: "WhatsApp",
    description: "Gerencie instâncias conectadas e configurações de envio",
    icon: Smartphone,
    href: "/dashboard/settings/whatsapp",
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    label: "Script de atendimento",
    description: "Crie e edite scripts para guiar o atendimento da IA",
    icon: Zap,
    href: "/dashboard/settings/ai/scripts",
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
];

export default function SettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "ADMIN";

  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loadingCollaborators, setLoadingCollaborators] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editingCollaborator, setEditingCollaborator] = useState<Collaborator | null>(null);

  const loadCollaborators = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingCollaborators(true);
    try {
      const data = await collaboratorApi.list();
      setCollaborators(data.users);
      setPendingInvites(data.pendingInvites);
    } catch {
      // silencioso — não bloqueia a página
    } finally {
      setLoadingCollaborators(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadCollaborators();
  }, [loadCollaborators]);

  const handleInvite = async (data: any) => {
    await collaboratorApi.invite(data);
    toast.success("Convite enviado com sucesso!");
    setInviteModalOpen(false);
    loadCollaborators();
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este colaborador?")) return;
    try {
      await collaboratorApi.remove(id);
      toast.success("Colaborador removido");
      loadCollaborators();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao remover colaborador");
    }
  };

  const handleCancelInvite = async (id: string) => {
    if (!confirm("Cancelar este convite?")) return;
    try {
      await collaboratorApi.cancelInvite(id);
      toast.success("Convite cancelado");
      loadCollaborators();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao cancelar convite");
    }
  };

  const handleUpdatePermissions = async (id: string, permissions: any[]) => {
    await collaboratorApi.updatePermissions(id, permissions);
    toast.success("Permissões atualizadas");
    setEditingCollaborator(null);
    loadCollaborators();
  };

  return (
    <div className="p-6 space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gerencie as configurações da sua empresa</p>
      </div>

      {/* Cards de navegação */}
      <div className="grid gap-3 sm:grid-cols-3">
        {settingsItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="h-full cursor-pointer transition-all hover:shadow-md hover:border-primary/30">
                <CardHeader className="flex flex-row items-start gap-3 p-4">
                  <div className={`p-2 rounded-lg ${item.bg} flex-shrink-0`}>
                    <Icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">{item.label}</CardTitle>
                    <CardDescription className="text-xs mt-0.5 leading-snug">{item.description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Seção de Colaboradores — apenas ADMIN */}
      {isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-500" />
              <div>
                <h2 className="text-base font-semibold text-gray-900">Colaboradores</h2>
                <p className="text-xs text-muted-foreground">
                  {collaborators.length} membro{collaborators.length !== 1 ? "s" : ""} ativos
                  {pendingInvites.length > 0 && ` · ${pendingInvites.length} convite${pendingInvites.length !== 1 ? "s" : ""} pendente${pendingInvites.length !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => setInviteModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Convidar
            </Button>
          </div>

          {loadingCollaborators ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Carregando...</div>
          ) : (
            <div className="space-y-4">
              {/* Convites pendentes */}
              {pendingInvites.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Convites pendentes</p>
                  {pendingInvites.map((invite) => (
                    <div key={invite.id} className="flex items-center justify-between px-4 py-3 rounded-lg border bg-amber-50 border-amber-100">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-amber-100 rounded-full">
                          <Clock className="h-3.5 w-3.5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{invite.name}</p>
                          <p className="text-xs text-muted-foreground">{invite.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCancelInvite(invite.id)}
                        className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                        title="Cancelar convite"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Colaboradores ativos */}
              <div className="space-y-2">
                {pendingInvites.length > 0 && (
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Membros ativos</p>
                )}
                {collaborators.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
                    Nenhum colaborador ainda. Convide alguém!
                  </div>
                ) : (
                  collaborators.map((collaborator) => (
                    <div key={collaborator.id} className="flex items-center justify-between px-4 py-3 rounded-lg border bg-white hover:border-gray-300 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-gray-100 rounded-full">
                          <User className="h-3.5 w-3.5 text-gray-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">{collaborator.name}</p>
                            <Badge
                              variant={collaborator.role === "ADMIN" ? "default" : "secondary"}
                              className="text-[10px] h-4 px-1.5"
                            >
                              {collaborator.role === "ADMIN" ? "Admin" : "Membro"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{collaborator.email}</p>
                          {collaborator.cargo && (
                            <p className="text-xs text-muted-foreground">{collaborator.cargo}</p>
                          )}
                        </div>
                      </div>

                      {collaborator.role !== "ADMIN" && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingCollaborator(collaborator)}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
                            title="Editar permissões"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemove(collaborator.id)}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                            title="Remover colaborador"
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <InviteCollaboratorModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onSubmit={handleInvite}
      />

      {editingCollaborator && (
        <EditPermissionsModal
          open={!!editingCollaborator}
          collaborator={editingCollaborator}
          onClose={() => setEditingCollaborator(null)}
          onSubmit={(permissions) => handleUpdatePermissions(editingCollaborator.id, permissions)}
        />
      )}
    </div>
  );
}
