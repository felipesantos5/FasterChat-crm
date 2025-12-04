"use client";

import { useState, useEffect } from "react";
import { X, Link, Phone, MessageSquare } from "lucide-react";
import { whatsappLinkService, WhatsAppLink } from "@/lib/whatsapp-link";
import { toast } from "react-hot-toast";

interface CreateLinkModalProps {
  link?: WhatsAppLink | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateLinkModal({ link, onClose, onSuccess }: CreateLinkModalProps) {
  const isEditing = !!link;

  const [formData, setFormData] = useState({
    name: link?.name || "",
    slug: link?.slug || "",
    phoneNumber: link?.phoneNumber || "",
    message: link?.message || "",
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (link) {
      setFormData({
        name: link.name,
        slug: link.slug,
        phoneNumber: link.phoneNumber,
        message: link.message || "",
      });
    }
  }, [link]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Nome é obrigatório";
    }

    if (!formData.slug.trim()) {
      newErrors.slug = "Slug é obrigatório";
    } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      newErrors.slug = "Slug deve conter apenas letras minúsculas, números e hífens";
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = "Número é obrigatório";
    } else if (!/^\d{10,15}$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = "Número inválido (apenas dígitos, 10-15 caracteres)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      if (isEditing && link) {
        await whatsappLinkService.update(link.id, formData);
        toast.success("Link atualizado com sucesso!");
      } else {
        await whatsappLinkService.create(formData);
        toast.success("Link criado com sucesso!");
      }

      onSuccess();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message;
      toast.error(errorMessage || "Erro ao salvar link");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: "" });
    }
  };

  const formatPhonePreview = (phone: string) => {
    if (phone.length === 13) {
      return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
    }
    return phone;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Link className="h-5 w-5 text-purple-600" />
              {isEditing ? "Editar Link" : "Criar Novo Link"}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {isEditing ? "Atualize as informações do seu link" : "Crie um link rastreável para WhatsApp"}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Nome do Link */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Link *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Ex: Instagram Bio, Campanha Black Friday"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            <p className="text-xs text-gray-500 mt-1">Nome descritivo para identificar o link internamente</p>
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Slug (URL) *</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="flex items-center">
                  <span className="inline-flex items-center px-3 py-[10px] border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm rounded-l-lg">
                    /
                  </span>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => handleChange("slug", e.target.value.toLowerCase())}
                    placeholder="meu-link"
                    className={`flex-1 px-4 py-2 border rounded-r-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                      errors.slug ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                </div>
              </div>
            </div>
            {errors.slug && <p className="text-red-500 text-sm mt-1">{errors.slug}</p>}
            <p className="text-xs text-gray-500 mt-1">URL curta para compartilhar (apenas letras minúsculas, números e hífens)</p>
          </div>

          {/* Número do WhatsApp */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Número do WhatsApp *
            </label>
            <input
              type="text"
              value={formData.phoneNumber}
              onChange={(e) => handleChange("phoneNumber", e.target.value.replace(/\D/g, ""))}
              placeholder="5511999999999"
              maxLength={15}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                errors.phoneNumber ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.phoneNumber && <p className="text-red-500 text-sm mt-1">{errors.phoneNumber}</p>}
            {formData.phoneNumber && !errors.phoneNumber && (
              <p className="text-green-600 text-sm mt-1">✓ {formatPhonePreview(formData.phoneNumber)}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">Formato: código do país + DDD + número (apenas números, sem espaços)</p>
          </div>

          {/* Mensagem Pré-preenchida */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Mensagem Pré-preenchida (Opcional)
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => handleChange("message", e.target.value)}
              placeholder="Olá! Vim através do link..."
              rows={3}
              maxLength={1000}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-gray-500">Mensagem que aparecerá automaticamente no WhatsApp</p>
              <span className="text-xs text-gray-500">{formData.message.length}/1000</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Salvando...
                </>
              ) : (
                <>{isEditing ? "Atualizar Link" : "Criar Link"}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
