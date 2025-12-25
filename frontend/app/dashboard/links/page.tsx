"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, ExternalLink, Copy, BarChart2, Edit2, Trash2, Link as LinkIcon, CheckCircle2, XCircle } from "lucide-react";
import { whatsappLinkService, WhatsAppLink } from "@/lib/whatsapp-link";
import { toast } from "react-hot-toast";
import CreateLinkModal from "@/components/links/CreateLinkModal";
import DeleteConfirmModal from "@/components/links/DeleteConfirmModal";
import { buttons, cards, typography, spacing, badges, icons } from "@/lib/design-system";
import { ProtectedPage } from "@/components/layout/protected-page";
import { LoadingErrorState } from "@/components/ui/error-state";
import { useErrorHandler } from "@/hooks/use-error-handler";

export default function LinksPage() {
  return (
    <ProtectedPage requiredPage="WHATSAPP_LINKS">
      <LinksPageContent />
    </ProtectedPage>
  );
}

function LinksPageContent() {
  const router = useRouter();
  const [links, setLinks] = useState<WhatsAppLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLink, setEditingLink] = useState<WhatsAppLink | null>(null);
  const [deletingLink, setDeletingLink] = useState<WhatsAppLink | null>(null);
  const { hasError, handleError, clearError } = useErrorHandler();

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    try {
      setLoading(true);
      clearError();
      const data = await whatsappLinkService.getAll();
      setLinks(data);
    } catch (error: any) {
      console.error("Error loading links:", error);
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("✅ Link copiado para área de transferência!", {
        duration: 3000,
      });
    } catch (error) {
      console.error("Error copying link:", error);
    }
  };

  const handleToggleActive = async (link: WhatsAppLink) => {
    try {
      await whatsappLinkService.update(link.id, {
        isActive: !link.isActive,
      });

      setLinks(links.map((l) => (l.id === link.id ? { ...l, isActive: !l.isActive } : l)));

      const statusText = !link.isActive ? "ativado" : "desativado";
      toast.success(`✅ Link ${statusText} com sucesso!`, {
        duration: 3000,
      });
    } catch (error: any) {
      console.error("Error toggling link status:", error);
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
      toast.success("✅ Link deletado com sucesso!", {
        duration: 3000,
      });
      setDeletingLink(null);
    } catch (error: any) {
      console.error("Error deleting link:", error);
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (hasError) {
    return <LoadingErrorState resource="links" onRetry={loadLinks} />;
  }

  return (
    <div className="p-3 md:p-6">
      <div className={spacing.section}>
        {/* Header */}
        <div className="flex items-center justify-end mb-6">
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
              <div className="bg-green-100 p-4 rounded-xl">
                <LinkIcon className={`${icons.large} text-green-600`} />
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
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Nome / Link</th>
                    <th className="px-2 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">WhatsApp</th>
                    <th className="px-2 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Cliques</th>
                    <th className="px-2 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                    <th className="px-2 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Criado em</th>
                    <th className="px-2 md:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {links.map((link) => (
                    <tr key={link.id} className="hover:bg-gray-50">
                      <td className="px-2 md:px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="text-xs md:text-sm font-medium text-gray-900 truncate max-w-[120px] md:max-w-none">{link.name}</div>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            <code className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded truncate max-w-[100px] md:max-w-xs">/{link.slug}</code>
                            <button onClick={() => handleCopyLink(link.url)} className="text-gray-400 hover:text-gray-600 flex-shrink-0" title="Copiar link">
                              <Copy className="h-3 w-3 md:h-4 md:w-4" />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 md:px-6 py-4 whitespace-nowrap">
                        <div className="text-xs md:text-sm text-gray-900 truncate max-w-[100px] md:max-w-none">{formatPhoneNumber(link.phoneNumber)}</div>
                        {link.message && <div className="text-xs text-gray-500 truncate max-w-[100px] md:max-w-xs">{link.message}</div>}
                      </td>
                      <td className="px-2 md:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 md:gap-2">
                          <span className="text-xs md:text-sm font-semibold text-gray-900">{link.clicks}</span>
                          <button
                            onClick={() => router.push(`/dashboard/links/${link.id}/analytics`)}
                            className="text-green-600 hover:text-green-800 flex-shrink-0"
                            title="Ver analytics"
                          >
                            <BarChart2 className="h-3 w-3 md:h-4 md:w-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-2 md:px-6 py-4 whitespace-nowrap">
                        <button onClick={() => handleToggleActive(link)}>
                          {link.isActive ? (
                            <span className={badges.success}>
                              <CheckCircle2 className={`${icons.small} mr-1 h-3 w-3 md:h-4 md:w-4`} />
                              <span className="hidden md:inline">Ativo</span>
                              <span className="md:hidden">Ativo</span>
                            </span>
                          ) : (
                            <span className={badges.neutral}>
                              <XCircle className={`${icons.small} mr-1 h-3 w-3 md:h-4 md:w-4`} />
                              <span className="hidden md:inline">Inativo</span>
                              <span className="md:hidden">Ina.</span>
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="px-2 md:px-6 py-4 whitespace-nowrap">
                        <span className="text-xs md:text-sm text-gray-700">{formatDate(link.createdAt)}</span>
                      </td>
                      <td className="px-2 md:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1 md:gap-3">
                          <button
                            onClick={() => router.push(`/dashboard/links/${link.id}/analytics`)}
                            className="p-1.5 md:p-2.5 text-green-600 hover:bg-green-50 rounded-lg transition-all flex-shrink-0"
                            title="Ver métricas"
                          >
                            <BarChart2 className="h-3 w-3 md:h-4 md:w-4" />
                          </button>
                          <button
                            onClick={() => window.open(link.url, "_blank")}
                            className="p-1.5 md:p-2.5 text-gray-600 hover:bg-gray-50 rounded-lg transition-all flex-shrink-0"
                            title="Testar link"
                          >
                            <ExternalLink className="h-3 w-3 md:h-4 md:w-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(link)}
                            className="p-1.5 md:p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all flex-shrink-0"
                            title="Editar"
                          >
                            <Edit2 className="h-3 w-3 md:h-4 md:w-4" />
                          </button>
                          <button
                            onClick={() => setDeletingLink(link)}
                            className="p-1.5 md:p-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-all flex-shrink-0"
                            title="Deletar"
                          >
                            <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modals */}
        {showCreateModal && <CreateLinkModal link={editingLink} onClose={handleModalClose} onSuccess={handleModalSuccess} />}

        {deletingLink && <DeleteConfirmModal linkName={deletingLink.name} onConfirm={handleDelete} onCancel={() => setDeletingLink(null)} />}
      </div>
    </div>
  );
}
