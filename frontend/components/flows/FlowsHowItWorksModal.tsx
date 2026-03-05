"use client";

import { X, GitBranch, MousePointerClick, Bot, Sparkles, Database } from "lucide-react";

interface FlowsHowItWorksModalProps {
  onClose: () => void;
}

export default function FlowsHowItWorksModal({ onClose }: FlowsHowItWorksModalProps) {
  return (
    <div className="mt-0 fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header com gradiente */}
        <div className="bg-gradient-to-r from-primary to-blue-500 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-xl">
              <GitBranch className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold">Fluxos de Automação</h2>
          </div>
          <p className="text-blue-50 text-sm">
            Crie robôs e fluxos de conversa automatizados sem programar
          </p>
        </div>

        {/* Conteúdo */}
        <div className="p-6 overflow-y-auto max-h-[calc(87vh-180px)] pb-0">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            O que você pode fazer
          </h3>

          <div className="space-y-4 mb-6">
            {/* Editor Visual */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <MousePointerClick className="h-4 w-4 text-purple-600" />
                </div>
                <span className="font-medium text-gray-900">Editor Arrastar e Soltar</span>
              </div>
              <p className="text-sm text-gray-600">
                Construa caminhos de conversa ligando blocos de forma fácil e intuitiva.
                Você pode enviar textos, áudios como se fossem gravados na hora, e mídias sem precisar escrever código.
              </p>
            </div>

            {/* Condições */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <GitBranch className="h-4 w-4 text-blue-600" />
                </div>
                <span className="font-medium text-gray-900">Condições e Respostas</span>
              </div>
              <p className="text-sm text-gray-600">
                Aguarde respostas do seu cliente e crie ramificações dependendo do que ele disse,
                podendo validar com palavras-chave exatas ou analisando a intenção através de Inteligência Artificial.
              </p>
            </div>

            {/* IA */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Bot className="h-4 w-4 text-emerald-600" />
                </div>
                <span className="font-medium text-gray-900">Blocos de IA Avançada</span>
              </div>
              <p className="text-sm text-gray-600">
                Aproveite blocos dinâmicos para gerar áudios com vozes realistas em tempo real,
                ou até mesmo criar e enviar imagens geradas por IA no meio do atendimento.
              </p>
            </div>

            {/* CRM */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Database className="h-4 w-4 text-orange-600" />
                </div>
                <span className="font-medium text-gray-900">Ações no CRM</span>
              </div>
              <p className="text-sm text-gray-600">
                Acione blocos de ação para transferir o contato, atualizar o estágio do funil,
                adicionar tags de segmentação e organizar seu CRM tudo no piloto automático.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-3 bg-primary hover:bg-primary/90 text-white font-medium rounded-xl transition-colors"
          >
            Entendi!
          </button>
        </div>
      </div>
    </div>
  );
}
