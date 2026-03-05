import { memo, useEffect, useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Trash2, GitPullRequest } from 'lucide-react';
import { pipelineApi } from '@/lib/pipeline';
import { getUser } from '@/lib/auth';
import { PipelineStage } from '@/types/pipeline';

export const UpdateStageNode = memo(({ id, data }: any) => {
  const { deleteElements, updateNodeData } = useReactFlow();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStages() {
      const user = getUser();
      if (!user) return;
      try {
        const res = await pipelineApi.getStages(user.companyId);
        setStages(res);
      } catch (error) {
        console.error('Error fetching pipeline stages:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStages();
  }, []);

  const handleStageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateNodeData(id, { stageId: e.target.value });
  };

  const selectedStageId = data?.stageId || '';

  return (
    <div className="bg-white border-2 border-indigo-400 rounded-xl shadow-lg min-w-[260px] overflow-hidden transition-all hover:shadow-indigo-100 hover:border-indigo-500">
      <Handle type="target" position={Position.Left} className="w-8 h-8 bg-indigo-500 border-2 border-white" />

      <div className="bg-indigo-50 px-3 py-3 border-b border-indigo-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-500 p-1.5 rounded-lg">
            <GitPullRequest size={16} className="text-white" />
          </div>
          <span className="text-sm font-bold text-indigo-900 tracking-tight">Alterar Status</span>
        </div>
        <button
          onClick={() => { if (confirm('Excluir este bloco?')) deleteElements({ nodes: [{ id }] }) }}
          className="text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-700 transition-colors nodrag p-1 rounded-md"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="p-4 bg-white">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest ml-1">
            Novo Estágio no Funil
          </label>

          {loading ? (
            <div className="h-9 w-full bg-gray-50 animate-pulse rounded-lg" />
          ) : (
            <select
              className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 nodrag cursor-pointer transition-all"
              value={selectedStageId}
              onChange={handleStageChange}
            >
              <option value="">Selecione um status...</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          )}

          <p className="text-[10px] text-gray-400 text-center mt-2 italic px-1">
            Move o cliente para este estágio do funil automaticamente.
          </p>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="w-8 h-8 bg-indigo-500 border-2 border-white" />
    </div>
  );
});

UpdateStageNode.displayName = 'UpdateStageNode';
