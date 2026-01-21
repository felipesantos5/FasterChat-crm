"use client";

import { X, Link2, Tag, MapPin, Smartphone, BarChart3, Target, Sparkles, Globe, MousePointerClick, Users, TrendingUp } from "lucide-react";

interface HowItWorksModalProps {
  onClose: () => void;
}

export default function HowItWorksModal({ onClose }: HowItWorksModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
            <h2 className="text-2xl font-bold">Links Inteligentes</h2>
          </div>
          <p className="text-green-100 text-sm">
            Rastreie de onde seus clientes estão vindo e aumente suas conversões
          </p>
        </div>

        {/* Conteúdo */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Domínio Custom */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
            <div className="flex items-center gap-3 mb-2">
              <Globe className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-blue-900">Domínio Exclusivo</span>
            </div>
            <p className="text-sm text-blue-800">
              Seus links usam o domínio <code className="bg-blue-100 px-2 py-0.5 rounded font-mono text-blue-700">whatsconversas.com.br</code> para
              um visual profissional e confiável.
            </p>
            <p className="text-xs text-blue-600 mt-2">
              Exemplo: <code className="bg-blue-100 px-2 py-0.5 rounded">whatsconversas.com.br/sua-campanha</code>
            </p>
          </div>

          {/* O que você consegue */}
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-green-600" />
            O que você consegue rastrear
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Card 1 - Origem */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-green-200 hover:bg-green-50/50 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <MousePointerClick className="h-4 w-4 text-green-600" />
                </div>
                <span className="font-medium text-gray-900">Origem dos Clientes</span>
              </div>
              <p className="text-sm text-gray-600">
                Saiba exatamente de qual campanha, post ou local cada cliente veio.
                Crie links diferentes para Instagram, Facebook, Google Ads, etc.
              </p>
            </div>

            {/* Card 2 - Tags Automáticas */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-green-200 hover:bg-green-50/50 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Tag className="h-4 w-4 text-purple-600" />
                </div>
                <span className="font-medium text-gray-900">Tags Automáticas</span>
              </div>
              <p className="text-sm text-gray-600">
                Cada link pode adicionar tags automaticamente no contato.
                Ex: "veio-do-instagram", "campanha-black-friday", "link-bio".
              </p>
            </div>

            {/* Card 3 - Dispositivo */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-green-200 hover:bg-green-50/50 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Smartphone className="h-4 w-4 text-blue-600" />
                </div>
                <span className="font-medium text-gray-900">Dispositivo</span>
              </div>
              <p className="text-sm text-gray-600">
                Identifique se o cliente acessou pelo celular (iOS/Android) ou computador.
                Útil para entender o comportamento do seu público.
              </p>
            </div>

            {/* Card 4 - Localização */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-green-200 hover:bg-green-50/50 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <MapPin className="h-4 w-4 text-orange-600" />
                </div>
                <span className="font-medium text-gray-900">Localização</span>
              </div>
              <p className="text-sm text-gray-600">
                Veja de qual cidade/região seus clientes estão vindo.
                Descubra onde seu marketing está funcionando melhor.
              </p>
            </div>

            {/* Card 5 - Métricas */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-green-200 hover:bg-green-50/50 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <BarChart3 className="h-4 w-4 text-emerald-600" />
                </div>
                <span className="font-medium text-gray-900">Métricas Completas</span>
              </div>
              <p className="text-sm text-gray-600">
                Acompanhe quantos cliques cada link recebeu, taxa de conversão
                e quais campanhas estão trazendo mais resultados.
              </p>
            </div>

            {/* Card 6 - Conversões */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-green-200 hover:bg-green-50/50 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-rose-100 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-rose-600" />
                </div>
                <span className="font-medium text-gray-900">ROI das Campanhas</span>
              </div>
              <p className="text-sm text-gray-600">
                Compare o desempenho de diferentes campanhas e descubra
                qual está trazendo mais clientes para o seu WhatsApp.
              </p>
            </div>
          </div>

          {/* Exemplos de Uso */}
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-green-600" />
            Exemplos de Uso
          </h3>

          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <span className="font-medium text-gray-900">Link da Bio do Instagram</span>
                <p className="text-sm text-gray-600">Crie um link exclusivo para sua bio e saiba quantos clientes vieram do seu perfil.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div>
                <span className="font-medium text-gray-900">Campanhas de Anúncios</span>
                <p className="text-sm text-gray-600">Um link diferente para cada campanha do Facebook/Google Ads. Compare resultados facilmente.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
              <div>
                <span className="font-medium text-gray-900">QR Code em Materiais Físicos</span>
                <p className="text-sm text-gray-600">Gere QR Codes com links diferentes para panfletos, cartões e outdoors.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
              <div>
                <span className="font-medium text-gray-900">Parcerias e Influenciadores</span>
                <p className="text-sm text-gray-600">Dê um link exclusivo para cada parceiro e acompanhe quem está trazendo mais clientes.</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-full">
                <Link2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-green-900">Comece agora!</p>
                <p className="text-sm text-green-700">
                  Clique em "Novo Link" para criar seu primeiro link rastreável e começar a entender de onde seus clientes vêm.
                </p>
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
