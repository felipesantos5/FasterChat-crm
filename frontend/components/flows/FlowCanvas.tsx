import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Pencil, ArrowLeft, History } from 'lucide-react';
import { ExecutionDrawer } from './ExecutionDrawer';
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { TriggerNode } from './nodes/TriggerNode';
import { MessageNode } from './nodes/MessageNode';
import { ConditionNode } from './nodes/ConditionNode';
import { DelayNode } from './nodes/DelayNode';
import { AudioNode } from './nodes/AudioNode';
import { MediaNode } from './nodes/MediaNode';
import { NodeSidebar } from './NodeSidebar';
import ButtonEdge from './edges/ButtonEdge';

const nodeTypes = {
  trigger: TriggerNode,
  message: MessageNode,
  condition: ConditionNode,
  delay: DelayNode,
  audio: AudioNode,
  image: MediaNode,
  video: MediaNode,
};

const edgeTypes = {
  'button-edge': ButtonEdge,
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
  const [flowName, setFlowName] = useState('Novo Fluxo');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [executions, setExecutions] = useState<any[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<any | null>(null);

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
        if (flow.name) setFlowName(flow.name);

        let loadedNodes: Node[] = [
          {
            id: `trigger-${flowId}`,
            type: 'trigger',
            position: { x: 250, y: 100 },
            data: {
              name: 'Gatilho Principal',
              description: flow.webhookSlug ? `/api/webhooks/flow/${flow.webhookSlug}` : '/api/webhooks/flow/meu-fluxo'
            },
          },
        ];

        if (flow.nodes && flow.nodes.length > 0) {
          loadedNodes = flow.nodes.map((n: any) => ({
            id: n.id,
            type: n.type,
            position: { x: n.positionX, y: n.positionY },
            data: { ...n.data, flowId },
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
            type: 'button-edge',
          })));
        }
      } catch (error) {
        console.error('Error loading flow', error);
        toast.error('Erro ao carregar o fluxo');
      } finally {
        setLoading(false);
      }
    }

    initFlow();
  }, [flowId, router, setNodes, setEdges]);

  const fetchExecutions = useCallback(async () => {
    try {
      const res = await api.get(`/flows/${flowId}/executions`);
      setExecutions(res.data);
    } catch (error) {
      console.error('Error fetching executions', error);
    }
  }, [flowId]);

  useEffect(() => {
    if (!isHistoryOpen) return;

    fetchExecutions();
    const interval = setInterval(fetchExecutions, 5000);
    return () => clearInterval(interval);
  }, [isHistoryOpen, fetchExecutions]);

  useEffect(() => {
    if (!selectedExecution) {
      setNodes((nds) => nds.map(n => ({ ...n, style: { ...n.style, opacity: 1, border: undefined, boxShadow: undefined } })));
      setEdges((eds) => eds.map(e => ({ ...e, style: { ...e.style, stroke: undefined, strokeWidth: undefined, opacity: 1 }, animated: false })));
      return;
    }

    const history = selectedExecution.history || [];

    setNodes((nds) => nds.map(n => {
      const isVisited = history.includes(n.id);
      return {
        ...n,
        style: {
          ...n.style,
          opacity: isVisited ? 1 : 0.4,
          border: isVisited ? '2px solid #22c55e' : undefined,
          boxShadow: isVisited ? '0 0 15px rgba(34, 197, 94, 0.4)' : undefined
        }
      };
    }));

    setEdges((eds) => eds.map(e => {
      const isVisited = history.includes(e.source) && history.includes(e.target);
      return {
        ...e,
        animated: isVisited,
        style: {
          ...e.style,
          stroke: isVisited ? '#22c55e' : undefined,
          strokeWidth: isVisited ? 3 : undefined,
          opacity: isVisited ? 1 : 0.3
        }
      };
    }));
  }, [selectedExecution, setNodes, setEdges]);

  const saveFlow = async () => {
    try {
      // 1. Atualiza dados do fluxo (Nome)
      if (flowId !== 'new') {
        await api.put(`/flows/${flowId}`, { name: flowName });
      }

      // 2. Atualiza Nódulos do Fluxo
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
      const newNodeId = `${type}-${Math.random().toString(36).substr(2, 9)}`;
      const lastNode = nds[nds.length - 1];
      const newNode: Node = {
        id: newNodeId,
        type,
        position: lastNode ? { x: lastNode.position.x, y: lastNode.position.y + 150 } : { x: 400, y: 300 },
        data: {
          name,
          label: name,
          flowId,
          ...(type === 'audio' ? { mediaUrl: '', fileName: '' } : {})
        },
      };

      if (lastNode) {
        setEdges((eds) => eds.concat({
          id: `e-${lastNode.id}-${newNodeId}`,
          source: lastNode.id,
          sourceHandle: lastNode.type === 'trigger' ? 'a' : undefined,
          target: newNodeId,
          type: 'button-edge',
        }));
      }

      return nds.concat(newNode);
    });
  }, [setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, type: 'button-edge' }, eds)),
    [setEdges],
  );


  return (
    <div className="flex flex-col h-full w-full font-sans bg-gray-50/50">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b z-20">
        <div className="flex items-center space-x-4">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-black flex items-center shadow-sm p-2 rounded-md border transition-colors hover:bg-gray-50" title="Voltar">
            <ArrowLeft size={18} />
          </button>

          <div className="flex items-center space-x-2">
            {isEditingName ? (
              <input
                type="text"
                className="border p-1.5 rounded text-sm text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-primary w-64"
                value={flowName}
                onChange={e => setFlowName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && setIsEditingName(false)}
              />
            ) : (
              <div
                className="font-semibold text-lg cursor-pointer flex items-center gap-2 hover:bg-gray-50 px-2 py-1 rounded transition-colors text-gray-800"
                onClick={() => setIsEditingName(true)}
                title="Editar Nome do Fluxo"
              >
                {flowName} <Pencil size={14} className="text-gray-400" />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all text-sm font-medium border ${isHistoryOpen
              ? 'bg-primary text-white border-primary shadow-inner'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 shadow-sm'
              }`}
          >
            <History size={16} />
            {isHistoryOpen ? 'Fechar Histórico' : 'Ver Execuções'}
          </button>

          <button onClick={saveFlow} className="bg-primary text-white px-6 py-2 rounded-md hover:bg-primary/90 text-sm font-semibold shadow-md transition-colors">
            Salvar
          </button>
        </div>
      </div>

      <div className="flex-1 w-full h-full flex flex-row relative z-10">
        <div className="flex-1 h-full relative">
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
              edgeTypes={edgeTypes}
              defaultEdgeOptions={{ type: 'button-edge' }}
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

        </div>
      </div>

      <ExecutionDrawer
        isOpen={isHistoryOpen}
        onClose={() => {
          setIsHistoryOpen(false);
          setSelectedExecution(null);
        }}
        executions={executions}
        onSelectExecution={setSelectedExecution}
        selectedExecutionId={selectedExecution?.id}
      />
    </div>
  );
}
