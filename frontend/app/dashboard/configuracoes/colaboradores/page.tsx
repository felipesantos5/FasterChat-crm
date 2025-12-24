"use client";

import { useState, useEffect } from "react";
import { collaboratorApi, Collaborator, PendingInvite } from "@/lib/collaborator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InviteCollaboratorModal } from "@/components/collaborators/invite-modal";
import { EditPermissionsModal } from "@/components/collaborators/edit-permissions-modal";
import { Plus, User, Trash, Edit, Clock, X } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/store/auth.store";

export default function CollaboratorsPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Collaborator[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editingCollaborator, setEditingCollaborator] = useState<Collaborator | null>(null);

  const loadCollaborators = async () => {
    try {
      setLoading(true);
      const data = await collaboratorApi.list();
      setUsers(data.users);
      setPendingInvites(data.pendingInvites);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao carregar colaboradores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCollaborators();
  }, []);

  const handleInvite = async (data: any) => {
    try {
      await collaboratorApi.invite(data);
      toast.success("Convite enviado com sucesso!");
      setInviteModalOpen(false);
      loadCollaborators();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao enviar convite");
      throw error;
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este colaborador?")) return;

    try {
      await collaboratorApi.remove(id);
      toast.success("Colaborador removido com sucesso");
      loadCollaborators();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao remover colaborador");
    }
  };

  const handleCancelInvite = async (id: string) => {
    if (!confirm("Tem certeza que deseja cancelar este convite?")) return;

    try {
      await collaboratorApi.cancelInvite(id);
      toast.success("Convite cancelado com sucesso");
      loadCollaborators();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao cancelar convite");
    }
  };

  const handleUpdatePermissions = async (id: string, permissions: any[]) => {
    try {
      await collaboratorApi.updatePermissions(id, permissions);
      toast.success("Permissões atualizadas com sucesso");
      setEditingCollaborator(null);
      loadCollaborators();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao atualizar permissões");
      throw error;
    }
  };

  if (user?.role !== 'ADMIN') {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Colaboradores</h1>
          <p className="text-muted-foreground">Gerencie colaboradores e suas permissões</p>
        </div>
        <Button onClick={() => setInviteModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Convidar Colaborador
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pendingInvites.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Convites Pendentes</h2>
              <div className="grid gap-4">
                {pendingInvites.map((invite) => (
                  <Card key={invite.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="p-2 bg-yellow-100 rounded-lg">
                          <Clock className="h-5 w-5 text-yellow-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{invite.name}</h3>
                          <p className="text-sm text-muted-foreground">{invite.email}</p>
                          {invite.cargo && (
                            <p className="text-sm text-muted-foreground">{invite.cargo}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Convidado por {invite.invitedBy.name}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {invite.permissions.map((p) => (
                              <Badge key={p.page} variant="outline" className="text-xs">
                                {p.page}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelInvite(invite.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-xl font-semibold mb-4">Colaboradores Ativos</h2>
            <div className="grid gap-4">
              {users.map((collaborator) => (
                <Card key={collaborator.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <User className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{collaborator.name}</h3>
                          <Badge variant={collaborator.role === 'ADMIN' ? 'default' : 'secondary'}>
                            {collaborator.role}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{collaborator.email}</p>
                        {collaborator.cargo && (
                          <p className="text-xs text-muted-foreground">{collaborator.cargo}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {collaborator.permissions.length > 0 ? (
                            collaborator.permissions.map((p) => (
                              <Badge key={p.page} variant="outline" className="text-xs">
                                {p.page}
                              </Badge>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Acesso total (Admin)
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    {collaborator.role !== 'ADMIN' && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingCollaborator(collaborator)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(collaborator.id)}
                        >
                          <Trash className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
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
          onSubmit={(permissions) =>
            handleUpdatePermissions(editingCollaborator.id, permissions)
          }
        />
      )}
    </div>
  );
}
