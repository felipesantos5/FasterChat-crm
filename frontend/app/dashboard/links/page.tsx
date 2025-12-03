"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, ExternalLink, Copy, BarChart2, Edit2, Trash2, Link as LinkIcon, CheckCircle2, XCircle } from "lucide-react";
import { whatsappLinkService, WhatsAppLink } from "@/lib/whatsapp-link";
import { toast } from "react-hot-toast";
import CreateLinkModal from "@/components/links/CreateLinkModal";
import DeleteConfirmModal from "@/components/links/DeleteConfirmModal";
import { buttons, cards, typography, spacing, badges, icons } from "@/lib/design-system";

export default function LinksPage() {
  const router = useRouter();
  const [links, setLinks] = useState<WhatsAppLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLink, setEditingLink] = useState<WhatsAppLink | null>(null);
  const [deletingLink, setDeletingLink] = useState<WhatsAppLink | null>(null);

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    try {
      setLoading(true);
      const data = await whatsappLinkService.getAll();
      setLinks(data);
    } catch (error: any) {
      toast.error("Erro ao carregar links");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado para área de transferência!");
    } catch (error) {
      toast.error("Erro ao copiar link");
    }
  };

  const handleToggleActive = async (link: WhatsAppLink) => {
    try {
      await whatsappLinkService.update(link.id, {
        isActive: !link.isActive,
      });

      setLinks(links.map((l) => (l.id === link.id ? { ...l, isActive: !l.isActive } : l)));

      toast.success(`Link ${!link.isActive ? "ativado" : "desativado"} com sucesso`);
    } catch (error: any) {
      toast.error("Erro ao atualizar link");
    }
  };

  const handleEdit = (link: WhatsAppLink) => {
    setEditingLink(link);
    setShowCreateModal(true);
  };

  const handleDelete = async () => {
    if (!deletingLink) return;

    try {
      await whatsappLinkService.delete(deletingLink.id);
      setLinks(links.filter((l) => l.id !== deletingLink.id));
      toast.success("Link deletado com sucesso");
      setDeletingLink(null);
    } catch (error: any) {
      toast.error("Erro ao deletar link");
    }
  };

  const handleModalClose = () => {
    setShowCreateModal(false);
    setEditingLink(null);
  };

  const handleModalSuccess = () => {
    loadLinks();
    handleModalClose();
  };

  const formatPhoneNumber = (phone: string) => {
    // Formata: 5511999999999 -> +55 (11) 99999-9999
    if (phone.length === 13) {
      return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
    }
    return phone;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className={spacing.page}>
      <div className={spacing.section}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className={`${typography.pageTitle} flex items-center gap-3`}>
              <LinkIcon className={`${icons.large} text-purple-600`} />
              Links de WhatsApp
            </h1>
            <p className={typography.pageSubtitle}>
              Crie e gerencie links rastreáveis para WhatsApp
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className={buttons.primary}
          >
            <Plus className={`${icons.default} inline-block mr-2`} />
            Novo Link
          </button>
        </div>

        {/* Stats Cards */}
        <div className={`grid grid-cols-1 md:grid-cols-3 ${spacing.cardGap} mb-8`}>
          <div className={cards.stats}>
            <div className="flex items-center justify-between">
              <div>
                <p className={typography.caption}>Total de Links</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{links.length}</p>
              </div>
              <div className="bg-purple-100 p-4 rounded-xl">
                <LinkIcon className={`${icons.large} text-purple-600`} />
              </div>
            </div>
          </div>

          <div className={cards.stats}>
            <div className="flex items-center justify-between">
              <div>
                <p className={typography.caption}>Links Ativos</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {links.filter((l) => l.isActive).length}
                </p>
              </div>
              <div className="bg-green-100 p-4 rounded-xl">
                <CheckCircle2 className={`${icons.large} text-green-600`} />
              </div>
            </div>
          </div>

          <div className={cards.stats}>
            <div className="flex items-center justify-between">
              <div>
                <p className={typography.caption}>Total de Cliques</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">
                  {links.reduce((sum, l) => sum + l.clicks, 0)}
                </p>
              </div>
              <div className="bg-blue-100 p-4 rounded-xl">
                <BarChart2 className={`${icons.large} text-blue-600`} />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        {links.length === 0 ? (
          <div className={`${cards.default} text-center py-16`}>
            <LinkIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className={`${typography.sectionTitle} mb-2`}>Nenhum link criado ainda</h3>
            <p className={`${typography.body} text-gray-600 mb-8`}>
              Comece criando seu primeiro link rastreável para WhatsApp
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className={buttons.primary}
            >
              <Plus className={`${icons.default} inline-block mr-2`} />
              Criar Primeiro Link
            </button>
          </div>
        ) : (
          <div className={cards.default}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome / Link</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">WhatsApp</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliques</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Criado em</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {links.map((link) => (
                <tr key={link.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-gray-900">{link.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">/l/{link.slug}</code>
                        <button onClick={() => handleCopyLink(link.url)} className="text-gray-400 hover:text-gray-600" title="Copiar link">
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatPhoneNumber(link.phoneNumber)}</div>
                    {link.message && <div className="text-xs text-gray-500 truncate max-w-xs">{link.message}</div>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{link.clicks}</span>
                      <button
                        onClick={() => router.push(`/dashboard/links/${link.id}/analytics`)}
                        className="text-purple-600 hover:text-purple-800"
                        title="Ver analytics"
                      >
                        <BarChart2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button onClick={() => handleToggleActive(link)}>
                      {link.isActive ? (
                        <span className={badges.success}>
                          <CheckCircle2 className={`${icons.small} mr-1`} />
                          Ativo
                        </span>
                      ) : (
                        <span className={badges.neutral}>
                          <XCircle className={`${icons.small} mr-1`} />
                          Inativo
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={typography.body}>{formatDate(link.createdAt)}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => router.push(`/dashboard/links/${link.id}/analytics`)}
                        className="p-2.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                        title="Ver métricas"
                      >
                        <BarChart2 className={icons.default} />
                      </button>
                      <button
                        onClick={() => window.open(link.url, "_blank")}
                        className="p-2.5 text-gray-600 hover:bg-gray-50 rounded-lg transition-all"
                        title="Testar link"
                      >
                        <ExternalLink className={icons.default} />
                      </button>
                      <button
                        onClick={() => handleEdit(link)}
                        className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Editar"
                      >
                        <Edit2 className={icons.default} />
                      </button>
                      <button
                        onClick={() => setDeletingLink(link)}
                        className="p-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Deletar"
                      >
                        <Trash2 className={icons.default} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}

        {/* Modals */}
        {showCreateModal && <CreateLinkModal link={editingLink} onClose={handleModalClose} onSuccess={handleModalSuccess} />}

        {deletingLink && <DeleteConfirmModal linkName={deletingLink.name} onConfirm={handleDelete} onCancel={() => setDeletingLink(null)} />}
      </div>
    </div>
  );
}
