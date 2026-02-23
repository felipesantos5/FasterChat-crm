import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { TriggerNode } from './nodes/TriggerNode';
import { MessageNode } from './nodes/MessageNode';
import { ConditionNode } from './nodes/ConditionNode';
import { DelayNode } from './nodes/DelayNode';
import { NodeSidebar } from './NodeSidebar';

const nodeTypes = {
  trigger: TriggerNode,
  message: MessageNode,
  condition: ConditionNode,
  delay: DelayNode,
};

const initialNodes: Node[] = [
  {
    id: 'trigger-1',
    type: 'trigger',
    position: { x: 250, y: 100 },
    data: { name: 'Gatilho Principal', description: '/api/webhooks/flow/meu-fluxo' },
  },
];

const initialEdges: Edge[] = [];

type FlowCanvasProps = {
  flowId: string;
};

export function FlowCanvas({ flowId }: FlowCanvasProps) {
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [loading, setLoading] = useState(true);
  const [variables, setVariables] = useState<string[]>([]);
  const { updateNodeData, getNodes } = useReactFlow();

  // Load or Create Flow
  useEffect(() => {
    async function initFlow() {
      try {
        if (flowId === 'new') {
          // Create new flow to get ID and webhook slug
          const res = await api.post('/flows', { name: 'Novo Fluxo de Automação', triggerType: 'webhook' });
          router.replace(`/dashboard/flows/${res.data.id}`);
          return;
        }

        const res = await api.get(`/flows/${flowId}`);
        const flow = res.data;

        let loadedNodes = initialNodes;

        // Ensure trigger node webhook slug is updated
        loadedNodes[0].data = {
          ...loadedNodes[0].data,
          description: flow.webhookSlug ? `/api/webhooks/flow/${flow.webhookSlug}` : '/api/webhooks/flow/meu-fluxo'
        };

        if (flow.nodes && flow.nodes.length > 0) {
          loadedNodes = flow.nodes.map((n: any) => ({
            id: n.id,
            type: n.type,
            position: { x: n.positionX, y: n.positionY },
            data: n.data,
          }));
        }

        setNodes(loadedNodes);

        if (flow.edges && flow.edges.length > 0) {
          setEdges(flow.edges.map((e: any) => ({
            id: e.id,
            source: e.sourceNodeId,
            sourceHandle: e.sourceHandle,
            target: e.targetNodeId,
            targetHandle: e.targetHandle,
          })));
        }
      } catch (error) {
        console.error('Error loading flow', error);
        toast.error('Erro ao carregar o fluxo');
      } finally {
        setLoading(false);
      }
    }

    async function fetchVariables() {
      if (flowId === 'new') return;
      try {
        const res = await api.get(`/flows/${flowId}/variables`);
        if (res.data.variables?.length > 0) {
          setVariables(res.data.variables);
        }
      } catch (e) {
        console.error('Failed to load variables', e);
      }
    }

    initFlow();
    fetchVariables();
  }, [flowId, router, setNodes, setEdges]);

  const saveFlow = async () => {
    try {
      const payload = {
        nodes: nodes.map(n => ({
          id: n.id,
          type: n.type,
          position: { x: n.position.x, y: n.position.y },
          data: n.data,
        })),
        edges: edges.map(e => ({
          id: e.id,
          source: e.source,
          sourceHandle: e.sourceHandle,
          target: e.target,
          targetHandle: e.targetHandle,
        }))
      };

      await api.post(`/flows/${flowId}/nodes`, payload);
      toast.success('Fluxo salvo com sucesso!');
    } catch (error) {
      console.error('Error saving flow', error);
      toast.error('Erro ao salvar fluxo');
    }
  };

  const handleAddNode = useCallback((type: string, name: string) => {
    setNodes((nds) => {
      const newNodeId = `${type}-${Date.now()}`;
      const lastNode = nds[nds.length - 1];
      const newNode: Node = {
        id: newNodeId,
        type,
        position: lastNode ? { x: lastNode.position.x, y: lastNode.position.y + 150 } : { x: 400, y: 300 },
        data: { name, label: name },
      };

      if (lastNode) {
        setEdges((eds) => eds.concat({
          id: `e-${lastNode.id}-${newNodeId}`,
          source: lastNode.id,
          sourceHandle: lastNode.type === 'trigger' ? 'a' : undefined,
          target: newNodeId,
        }));
      }

      return nds.concat(newNode);
    });
  }, [setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const handleVariableClick = (variable: string) => {
    // Find selected message nodes where we can insert the variable
    const selectedNodes = getNodes().filter(n => n.selected && n.type === 'message');

    if (selectedNodes.length === 0) {
      toast.info('Selecione um bloco de Mensagem para inserir a variável');
      return;
    }

    selectedNodes.forEach(node => {
      const currentText = node.data?.text as string || '';
      const textToAppend = ` {{${variable}}}`;
      updateNodeData(node.id, { text: currentText + textToAppend });
    });

    toast.success(`Variável {{${variable}}} adicionada!`);
  };

  return (
    <div className="w-full h-full flex flex-row mt-16 border-t font-sans relative">
      <div className="absolute top-[-50px] right-4 z-10 flex space-x-2">
        <button onClick={saveFlow} className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 text-sm font-medium shadow-sm">
          Salvar
        </button>
      </div>

      <div className="flex-1 h-full">
        {loading ? (
          <div className="flex w-full h-full items-center justify-center text-gray-400">Carregando fluxo...</div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Controls />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          </ReactFlow>
        )}
      </div>

      <div className="w-80 border-l bg-gray-50 h-full flex flex-col z-10">
        <div className="flex-1 overflow-y-auto">
          <NodeSidebar handleAddNode={handleAddNode} />
        </div>

        {/* Painel de Variáveis */}
        <div className="border-t bg-white p-4 max-h-[40%] overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider mb-2">Variáveis do Webhook</h3>
          {variables.length > 0 ? (
            <div className="flex flex-wrap gap-2 text-xs">
              {variables.map(v => (
                <button
                  key={v}
                  onClick={() => handleVariableClick(v)}
                  className="bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded hover:bg-primary/20 transition cursor-pointer"
                  title="Clique para adicionar no bloco selecionado"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded text-center">
              Nenhuma variável detectada ainda. Seu webhook precisa receber dados primeiro.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
