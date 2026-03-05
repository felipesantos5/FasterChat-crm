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
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Adicionar Ação</h3>
        <div className="grid grid-cols-2 gap-2">

          <button
            onClick={() => addNode('message', 'Enviar Mensagem')}
            className="flex flex-col items-center justify-center gap-1.5 p-2 bg-white border rounded-lg shadow-sm hover:border-primary hover:shadow-md transition-all text-center group"
          >
            <div className="bg-blue-100 p-2 rounded-md text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-colors text-lg">💬</div>
            <div>
              <p className="font-semibold text-xs text-gray-800">Mensagem</p>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">Enviar texto</p>
            </div>
          </button>

          <button
            onClick={() => addNode('delay', 'Aguardar Tempo')}
            className="flex flex-col items-center justify-center gap-1.5 p-2 bg-white border rounded-lg shadow-sm hover:border-orange-400 hover:shadow-md transition-all text-center group"
          >
            <div className="bg-orange-100 p-2 rounded-md text-orange-600 group-hover:bg-orange-500 group-hover:text-white transition-colors text-lg">⏳</div>
            <div>
              <p className="font-semibold text-xs text-gray-800">Atraso</p>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">Pausar fluxo</p>
            </div>
          </button>

          <button
            onClick={() => addNode('condition', 'Verificar Resposta')}
            className="flex flex-col items-center justify-center gap-1.5 p-2 bg-white border rounded-lg shadow-sm hover:border-purple-400 hover:shadow-md transition-all text-center group"
          >
            <div className="bg-purple-100 p-2 rounded-md text-purple-600 group-hover:bg-purple-500 group-hover:text-white transition-colors text-lg">🔀</div>
            <div>
              <p className="font-semibold text-xs text-gray-800">Condição</p>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">Verificar resp.</p>
            </div>
          </button>

          <button
            onClick={() => addNode('audio', 'Enviar Áudio')}
            className="flex flex-col items-center justify-center gap-1.5 p-2 bg-white border rounded-lg shadow-sm hover:border-green-400 hover:shadow-md transition-all text-center group"
          >
            <div className="bg-green-100 p-2 rounded-md text-green-600 group-hover:bg-green-500 group-hover:text-white transition-colors text-lg">🎙️</div>
            <div>
              <p className="font-semibold text-xs text-gray-800">Áudio</p>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">Enviar voz</p>
            </div>
          </button>

          <button
            onClick={() => addNode('image', 'Enviar Imagem')}
            className="flex flex-col items-center justify-center gap-1.5 p-2 bg-white border rounded-lg shadow-sm hover:border-pink-400 hover:shadow-md transition-all text-center group"
          >
            <div className="bg-pink-100 p-2 rounded-md text-pink-600 group-hover:bg-pink-500 group-hover:text-white transition-colors text-lg">🖼️</div>
            <div>
              <p className="font-semibold text-xs text-gray-800">Imagem</p>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">Enviar foto</p>
            </div>
          </button>

          <button
            onClick={() => addNode('video', 'Enviar Vídeo')}
            className="flex flex-col items-center justify-center gap-1.5 p-2 bg-white border rounded-lg shadow-sm hover:border-indigo-400 hover:shadow-md transition-all text-center group"
          >
            <div className="bg-indigo-100 p-2 rounded-md text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white transition-colors text-lg">🎥</div>
            <div>
              <p className="font-semibold text-xs text-gray-800">Vídeo</p>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">Enviar MP4</p>
            </div>
          </button>

          <button
            onClick={() => addNode('ai_action', 'Ação da IA')}
            className="flex flex-col items-center justify-center gap-1.5 p-2 bg-white border rounded-lg shadow-sm hover:border-emerald-400 hover:shadow-md transition-all text-center group"
          >
            <div className="bg-emerald-100 p-2 rounded-md text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors text-lg">🤖</div>
            <div>
              <p className="font-semibold text-xs text-gray-800">Status IA</p>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">Ligar/Desligar</p>
            </div>
          </button>

          <button
            onClick={() => addNode('ai_image', 'Imagem IA')}
            className="flex flex-col items-center justify-center gap-1.5 p-2 bg-white border rounded-lg shadow-sm hover:border-violet-400 hover:shadow-md transition-all text-center group"
          >
            <div className="bg-violet-100 p-2 rounded-md text-violet-600 group-hover:bg-violet-500 group-hover:text-white transition-colors text-lg">✨</div>
            <div>
              <p className="font-semibold text-xs text-gray-800">Imagem IA</p>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">Gerar imagem</p>
            </div>
          </button>

          <button
            onClick={() => addNode('validation', 'Validação')}
            className="flex flex-col items-center justify-center gap-1.5 p-2 bg-white border rounded-lg shadow-sm hover:border-amber-400 hover:shadow-md transition-all text-center group"
          >
            <div className="bg-amber-100 p-2 rounded-md text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors text-lg">🛡️</div>
            <div>
              <p className="font-semibold text-xs text-gray-800">Validação</p>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">Comparar var</p>
            </div>
          </button>

          <button
            onClick={() => addNode('ai_condition', 'Validação IA')}
            className="flex flex-col items-center justify-center gap-1.5 p-2 bg-white border rounded-lg shadow-sm hover:border-blue-400 hover:shadow-md transition-all text-center group"
          >
            <div className="bg-indigo-100 p-2 rounded-md text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white transition-colors text-lg">🧠</div>
            <div>
              <p className="font-semibold text-xs text-gray-800">Valid. IA</p>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">Classificar com AI</p>
            </div>
          </button>

          <button
            onClick={() => addNode('random', 'Randomização')}
            className="flex flex-col items-center justify-center gap-1.5 p-2 bg-white border rounded-lg shadow-sm hover:border-teal-400 hover:shadow-md transition-all text-center group"
          >
            <div className="bg-teal-100 p-2 rounded-md text-teal-600 group-hover:bg-teal-500 group-hover:text-white transition-colors text-lg">🎲</div>
            <div>
              <p className="font-semibold text-xs text-gray-800">Random</p>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">Teste A/B</p>
            </div>
          </button>

          <button
            onClick={() => addNode('update_stage', 'Alterar Status')}
            className="flex flex-col items-center justify-center gap-1.5 p-2 bg-white border rounded-lg shadow-sm hover:border-sky-400 hover:shadow-md transition-all text-center group"
          >
            <div className="bg-sky-100 p-2 rounded-md text-sky-600 group-hover:bg-sky-500 group-hover:text-white transition-colors text-lg">📉</div>
            <div>
              <p className="font-semibold text-xs text-gray-800">Fase</p>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">Mudar funil</p>
            </div>
          </button>

        </div>
      </div>
    </div>
  );
}
