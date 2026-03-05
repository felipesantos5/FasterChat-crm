"use client";

import { X, GitBranch, MousePointerClick, Bot, Sparkles, Database, Target, Zap, Clock, MessageSquare } from "lucide-react";

interface FlowsHowItWorksModalProps {
  onClose: () => void;
}

export default function FlowsHowItWorksModal({ onClose }: FlowsHowItWorksModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 !mt-0">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
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
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold">Fluxos de Automação</h2>
          </div>
          <p className="text-green-100 text-sm">
            Crie robôs dinâmicos e fluxos de conversa automatizados sem escrever código
          </p>
        </div>

        {/* Conteúdo */}
        <div className="p-6 overflow-y-auto max-h-[calc(87vh-180px)] pb-0">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-green-600" />
            Recursos e Possibilidades
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Card 1 - Editor */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-green-200 hover:bg-green-50/50 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <MousePointerClick className="h-4 w-4 text-green-600" />
                </div>
                <span className="font-medium text-gray-900">Editor Arrastar e Soltar</span>
              </div>
              <p className="text-sm text-gray-600">
                Construa caminhos de conversa ligando blocos de forma fácil. Envie mensagens, áudios e imagens em poucos cliques.
              </p>
            </div>

            {/* Card 2 - Condições */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-green-200 hover:bg-green-50/50 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <GitBranch className="h-4 w-4 text-green-600" />
                </div>
                <span className="font-medium text-gray-900">Condições de Resposta</span>
              </div>
              <p className="text-sm text-gray-600">
                Crie ramificações baseadas no que o cliente responde. Avalie palavras-chave e direcione a conversa corretamente.
              </p>
            </div>

            {/* Card 3 - IA Avançada */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-green-200 hover:bg-green-50/50 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Bot className="h-4 w-4 text-green-600" />
                </div>
                <span className="font-medium text-gray-900">Inteligência Artificial</span>
              </div>
              <p className="text-sm text-gray-600">
                Aproveite blocos de IA para aprovar e avaliar interações ou para até gerar imagens na hora no meio do fluxo.
              </p>
            </div>

            {/* Card 4 - CRM Automático */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-green-200 hover:bg-green-50/50 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Database className="h-4 w-4 text-green-600" />
                </div>
                <span className="font-medium text-gray-900">Ações no CRM</span>
              </div>
              <p className="text-sm text-gray-600">
                Atribua tags automaticamente, atualize o estágio no funil de vendas, e organize leads no piloto automático.
              </p>
            </div>

            {/* Card 5 - Delays e Timing */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-green-200 hover:bg-green-50/50 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Clock className="h-4 w-4 text-green-600" />
                </div>
                <span className="font-medium text-gray-900">Delays Temporais</span>
              </div>
              <p className="text-sm text-gray-600">
                Adicione pausas naturais na digitação antes de responder para parecer humano e evitar punições do WhatsApp.
              </p>
            </div>

            {/* Card 6 - Atendimento Dinâmico */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-green-200 hover:bg-green-50/50 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Zap className="h-4 w-4 text-green-600" />
                </div>
                <span className="font-medium text-gray-900">Transbordo e Alertas</span>
              </div>
              <p className="text-sm text-gray-600">
                Transfira a conversa de volta para você instantaneamente quando necessário ou se o cliente não avançar mais.
              </p>
            </div>
          </div>

          {/* Exemplos de Uso */}
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            Exemplos de Uso
          </h3>

          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <span className="font-medium text-gray-900">Qualificação de Leads Automática</span>
                <p className="text-sm text-gray-600">Construa um mini-questionário que separa contatos desqualificados daqueles prontos para venda.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div>
                <span className="font-medium text-gray-900">Respostas Baseadas em Botões</span>
                <p className="text-sm text-gray-600">Ofereça um botão de sim, não, ou outras alternativas para mapear a dor do seu lead.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
              <div>
                <span className="font-medium text-gray-900">Avisos e Lembretes Temporais</span>
                <p className="text-sm text-gray-600">Mande uma mensagem e aguarde um tempo longo ou resposta para tentar reativar o seu lead.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors"
          >
            Entendi, vamos começar!
          </button>
        </div>
      </div>
    </div>
  );
}
