import { memo, useEffect, useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Trash2, GitPullRequest } from 'lucide-react';
import { pipelineApi } from '@/lib/pipeline';
import { getUser } from '@/lib/auth';
import { PipelineStage } from '@/types/pipeline';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  const handleStageChange = (value: string) => {
    updateNodeData(id, { stageId: value });
  };

  const selectedStageId = data?.stageId || '';
  const selectedStage = stages.find(s => s.id === selectedStageId);

  return (
    <div className="bg-white border-2 border-indigo-400 rounded-xl shadow-lg min-w-[280px] overflow-hidden transition-all hover:shadow-indigo-100 hover:border-indigo-500">
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
            <div className="h-10 w-full bg-gray-50 animate-pulse rounded-lg" />
          ) : (
            <Select value={selectedStageId} onValueChange={handleStageChange}>
              <SelectTrigger className="w-full bg-gray-50 border-gray-100 focus:ring-indigo-500/20 focus:border-indigo-400 nodrag h-10">
                <SelectValue placeholder="Selecione um status...">
                  {selectedStage && (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: selectedStage.color || '#CBD5E1' }}
                      />
                      <span className="truncate">{selectedStage.name}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="nodrag">
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: stage.color || '#CBD5E1' }}
                      />
                      <span>{stage.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
