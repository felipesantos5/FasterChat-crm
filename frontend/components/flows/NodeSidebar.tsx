

type NodeSidebarProps = {
  handleAddNode: (type: string, name: string) => void;
};

export function NodeSidebar({ handleAddNode }: NodeSidebarProps) {

  const addNode = (type: string, name: string) => {
    handleAddNode(type, name);
  };

  return (
    <div className="p-4 flex flex-col gap-4">
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
            onClick={() => addNode('message', 'Enviar Áudio')}
            className="flex items-center gap-3 p-3 bg-white border rounded-md shadow-sm hover:border-primary hover:shadow-md transition-all text-left"
          >
            <div className="bg-green-100 p-2 rounded-md text-green-600">🎙️</div>
            <div>
              <p className="font-medium text-sm text-gray-900">Áudio</p>
              <p className="text-xs text-gray-500">Enviar MP3/OGG</p>
            </div>
          </button>

        </div>
      </div>
    </div>
  );
}
