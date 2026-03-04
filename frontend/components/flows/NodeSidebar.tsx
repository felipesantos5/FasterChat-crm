type NodeSidebarProps = {
  handleAddNode: (type: string, name: string) => void;
};

export function NodeSidebar({ handleAddNode }: NodeSidebarProps) {
  const addNode = (type: string, name: string) => {
    handleAddNode(type, name);
  };

  return (
    <div className="p-4 flex flex-col gap-4 h-full">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider mb-3">Adicionar Ação</h3>
        <div className="grid grid-cols-1 gap-2">


          <button
            onClick={() => addNode('message', 'Enviar Mensagem')}
            className="flex items-center gap-3 p-3 bg-white border rounded-md shadow-sm hover:border-primary hover:shadow-md transition-all text-left"
          >
            <div className="bg-blue-100 p-2 rounded-md text-blue-600">💬</div>
            <div>
              <p className="font-medium text-sm text-gray-900">Mensagem</p>
              <p className="text-xs text-gray-500">Enviar texto de WhatsApp</p>
            </div>
          </button>

          <button
            onClick={() => addNode('delay', 'Aguardar Tempo')}
            className="flex items-center gap-3 p-3 bg-white border rounded-md shadow-sm hover:border-primary hover:shadow-md transition-all text-left"
          >
            <div className="bg-orange-100 p-2 rounded-md text-orange-600">⏳</div>
            <div>
              <p className="font-medium text-sm text-gray-900">Atraso</p>
              <p className="text-xs text-gray-500">Pausar fluxo</p>
            </div>
          </button>

          <button
            onClick={() => addNode('condition', 'Verificar Resposta')}
            className="flex items-center gap-3 p-3 bg-white border rounded-md shadow-sm hover:border-primary hover:shadow-md transition-all text-left"
          >
            <div className="bg-purple-100 p-2 rounded-md text-purple-600">🔀</div>
            <div>
              <p className="font-medium text-sm text-gray-900">Condição</p>
              <p className="text-xs text-gray-500">Respondeu / Não Respondeu</p>
            </div>
          </button>

          <button
            onClick={() => addNode('audio', 'Enviar Áudio')}
            className="flex items-center gap-3 p-3 bg-white border rounded-md shadow-sm hover:border-primary hover:shadow-md transition-all text-left"
          >
            <div className="bg-green-100 p-2 rounded-md text-green-600">🎙️</div>
            <div>
              <p className="font-medium text-sm text-gray-900">Áudio</p>
              <p className="text-xs text-gray-500">Enviar voz/música</p>
            </div>
          </button>

          <button
            onClick={() => addNode('image', 'Enviar Imagem')}
            className="flex items-center gap-3 p-3 bg-white border rounded-md shadow-sm hover:border-pink-400 hover:shadow-md transition-all text-left group"
          >
            <div className="bg-pink-100 p-2 rounded-md text-pink-600 group-hover:bg-pink-500 group-hover:text-white transition-colors">🖼️</div>
            <div>
              <p className="font-medium text-sm text-gray-900 font-sans">Imagem</p>
              <p className="text-xs text-gray-500">Enviar foto ou arte</p>
            </div>
          </button>

          <button
            onClick={() => addNode('video', 'Enviar Vídeo')}
            className="flex items-center gap-3 p-3 bg-white border rounded-md shadow-sm hover:border-indigo-400 hover:shadow-md transition-all text-left group"
          >
            <div className="bg-indigo-100 p-2 rounded-md text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white transition-colors">🎥</div>
            <div>
              <p className="font-medium text-sm text-gray-900 font-sans">Vídeo</p>
              <p className="text-xs text-gray-500">Enviar MP4/Vídeo</p>
            </div>
          </button>

          <button
            onClick={() => addNode('ai_action', 'Ação da IA')}
            className="flex items-center gap-3 p-3 bg-white border rounded-md shadow-sm hover:border-emerald-400 hover:shadow-md transition-all text-left group"
          >
            <div className="bg-emerald-100 p-2 rounded-md text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors">🤖</div>
            <div>
              <p className="font-medium text-sm text-gray-900 font-sans">Status da IA</p>
              <p className="text-xs text-gray-500">Ligar ou Desligar IA</p>
            </div>
          </button>

          <button
            onClick={() => addNode('ai_image', 'Imagem IA')}
            className="flex items-center gap-3 p-3 bg-white border rounded-md shadow-sm hover:border-violet-400 hover:shadow-md transition-all text-left group"
          >
            <div className="bg-violet-100 p-2 rounded-md text-violet-600 group-hover:bg-violet-500 group-hover:text-white transition-colors">✨</div>
            <div>
              <p className="font-medium text-sm text-gray-900 font-sans">Imagem IA</p>
              <p className="text-xs text-gray-500">Gerar imagem com Gemini</p>
            </div>
          </button>

          <button
            onClick={() => addNode('validation', 'Validação')}
            className="flex items-center gap-3 p-3 bg-white border rounded-md shadow-sm hover:border-amber-400 hover:shadow-md transition-all text-left group"
          >
            <div className="bg-amber-100 p-2 rounded-md text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors">🛡️</div>
            <div>
              <p className="font-medium text-sm text-gray-900 font-sans">Validação</p>
              <p className="text-xs text-gray-500">Comparar variável</p>
            </div>
          </button>

          <button
            onClick={() => addNode('ai_condition', 'Validação IA')}
            className="flex items-center gap-3 p-3 bg-white border rounded-md shadow-sm hover:border-indigo-400 hover:shadow-md transition-all text-left group"
          >
            <div className="bg-indigo-100 p-2 rounded-md text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white transition-colors">🧠</div>
            <div>
              <p className="font-medium text-sm text-gray-900 font-sans">Validação IA</p>
              <p className="text-xs text-gray-500">Classificar com AI</p>
            </div>
          </button>

          <button
            onClick={() => addNode('random', 'Randomização')}
            className="flex items-center gap-3 p-3 bg-white border rounded-md shadow-sm hover:border-teal-400 hover:shadow-md transition-all text-left group"
          >
            <div className="bg-teal-100 p-2 rounded-md text-teal-600 group-hover:bg-teal-500 group-hover:text-white transition-colors">🎲</div>
            <div>
              <p className="font-medium text-sm text-gray-900 font-sans">Randomização</p>
              <p className="text-xs text-gray-500">Teste A/B aleatório</p>
            </div>
          </button>

        </div>
      </div>
    </div>
  );
}
