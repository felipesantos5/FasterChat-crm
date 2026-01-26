"use client";

import { X, Megaphone, Users, Tag, Clock, Send, BarChart3, Sparkles } from "lucide-react";

interface CampaignsHowItWorksModalProps {
  onClose: () => void;
}

export default function CampaignsHowItWorksModal({ onClose }: CampaignsHowItWorksModalProps) {
  return (
    <div className="mt-0 fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header com gradiente */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-500 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-xl">
              <Megaphone className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold">Campanhas de Disparo</h2>
          </div>
          <p className="text-green-100 text-sm">
            Envie mensagens em massa para grupos específicos de contatos
          </p>
        </div>

        {/* Conteúdo */}
        <div className="p-6 overflow-y-auto max-h-[calc(87vh-180px)] pb-0">
          {/* O que são campanhas */}
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-green-600" />
            O que você pode fazer
          </h3>

          <div className="space-y-4 mb-6">
            {/* Disparo por Tags */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Tag className="h-4 w-4 text-purple-600" />
                </div>
                <span className="font-medium text-gray-900">Segmentação por Tags</span>
              </div>
              <p className="text-sm text-gray-600">
                Selecione uma ou mais tags para definir quais contatos receberão a mensagem.
                Apenas contatos com as tags selecionadas serão incluídos no disparo.
              </p>
            </div>

            {/* Envio Inteligente */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Send className="h-4 w-4 text-green-600" />
                </div>
                <span className="font-medium text-gray-900">Envio com Delays Inteligentes</span>
              </div>
              <p className="text-sm text-gray-600">
                As mensagens são enviadas em fila com intervalos automáticos entre cada envio.
                Isso evita bloqueios e mantém a naturalidade das conversas.
              </p>
            </div>

            {/* Agendamento */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Clock className="h-4 w-4 text-blue-600" />
                </div>
                <span className="font-medium text-gray-900">Agendamento</span>
              </div>
              <p className="text-sm text-gray-600">
                Programe campanhas para serem disparadas automaticamente em uma data e horário específico.
                Ideal para promoções e comunicados planejados.
              </p>
            </div>

            {/* Estatísticas */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <BarChart3 className="h-4 w-4 text-emerald-600" />
                </div>
                <span className="font-medium text-gray-900">Acompanhamento em Tempo Real</span>
              </div>
              <p className="text-sm text-gray-600">
                Visualize quantas mensagens foram enviadas, quantas falharam e o progresso geral da campanha
                enquanto ela está sendo executada.
              </p>
            </div>

            {/* Personalização */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Users className="h-4 w-4 text-orange-600" />
                </div>
                <span className="font-medium text-gray-900">Personalização de Mensagem</span>
              </div>
              <p className="text-sm text-gray-600">
                Use variáveis como {"{nome}"} na mensagem para personalizar automaticamente
                com o nome de cada contato.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors"
          >
            Entendi!
          </button>
        </div>
      </div>
    </div>
  );
}
