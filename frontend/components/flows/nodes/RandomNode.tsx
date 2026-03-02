import { memo, useCallback } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Trash2, Dice5 } from 'lucide-react';

const PATH_COLORS = [
  { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700', handle: 'bg-blue-500', bar: 'bg-blue-500', label: 'A' },
  { bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-700', handle: 'bg-green-500', bar: 'bg-green-500', label: 'B' },
  { bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-700', handle: 'bg-orange-500', bar: 'bg-orange-500', label: 'C' },
];

const DEFAULT_PATHS = [
  { id: 'path_a', label: 'A', percent: 50 },
  { id: 'path_b', label: 'B', percent: 50 },
  { id: 'path_c', label: 'C', percent: 0 },
];

export const RandomNode = memo(({ id, data }: any) => {
  const { deleteElements, updateNodeData } = useReactFlow();

  const paths = data?.paths || DEFAULT_PATHS;
  const enabledPaths = data?.enabledPaths || 2;

  const updatePaths = useCallback((newPaths: typeof DEFAULT_PATHS, newEnabled?: number) => {
    updateNodeData(id, {
      paths: newPaths,
      enabledPaths: newEnabled ?? enabledPaths,
    });
  }, [id, enabledPaths, updateNodeData]);

  const handleEnabledChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const count = Number(e.target.value);
    const equalPercent = Math.floor(100 / count);
    const remainder = 100 - equalPercent * count;

    const newPaths = paths.map((p: any, i: number) => ({
      ...p,
      percent: i < count ? (i === 0 ? equalPercent + remainder : equalPercent) : 0,
    }));
    updatePaths(newPaths, count);
  };

  const handlePercentChange = (index: number, value: number) => {
    const clamped = Math.max(0, Math.min(100, value));
    const newPaths = [...paths];
    newPaths[index] = { ...newPaths[index], percent: clamped };

    // Auto-adjust the last enabled path to make total = 100
    const otherSum = newPaths
      .filter((_: any, i: number) => i < enabledPaths && i !== index)
      .reduce((sum: number, p: any) => sum + p.percent, 0);

    const lastEnabledIdx = enabledPaths - 1;
    if (index !== lastEnabledIdx && lastEnabledIdx < newPaths.length) {
      newPaths[lastEnabledIdx] = {
        ...newPaths[lastEnabledIdx],
        percent: Math.max(0, 100 - clamped - otherSum + newPaths[lastEnabledIdx].percent - newPaths[lastEnabledIdx].percent),
      };
      // Recalculate properly
      const sumOthers = newPaths
        .filter((_: any, i: number) => i < enabledPaths && i !== lastEnabledIdx)
        .reduce((sum: number, p: any) => sum + p.percent, 0);
      newPaths[lastEnabledIdx] = {
        ...newPaths[lastEnabledIdx],
        percent: Math.max(0, 100 - sumOthers),
      };
    }

    updatePaths(newPaths);
  };

  const total = paths
    .filter((_: any, i: number) => i < enabledPaths)
    .reduce((sum: number, p: any) => sum + p.percent, 0);

  const isValid = total === 100;

  return (
    <div className="bg-white border-2 border-teal-400 rounded-xl shadow-lg min-w-[300px] overflow-hidden transition-all hover:shadow-teal-100 hover:border-teal-500/50">
      <Handle type="target" position={Position.Left} className="w-8 h-8 bg-teal-500 border-2 border-white" />

      {/* Header */}
      <div className="bg-teal-50 px-3 py-3 border-b border-teal-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="bg-teal-500 p-1.5 rounded-lg shadow-sm">
            <Dice5 size={16} className="text-white" />
          </div>
          <span className="text-sm font-bold text-teal-900 tracking-tight">Randomização A/B</span>
        </div>
        <button
          onClick={() => { if (confirm('Excluir este bloco?')) deleteElements({ nodes: [{ id }] }); }}
          className="text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-700 transition-colors nodrag p-1 rounded-md"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 bg-white space-y-3">
        {/* Path count selector */}
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">
            Caminhos Ativos
          </label>
          <select
            value={enabledPaths}
            onChange={handleEnabledChange}
            className="p-1.5 bg-teal-50 border border-teal-200 rounded-lg text-sm font-semibold text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 nodrag cursor-pointer"
          >
            <option value={2}>2 caminhos</option>
            <option value={3}>3 caminhos</option>
          </select>
        </div>

        {/* Path inputs */}
        {paths.map((path: any, index: number) => {
          const colors = PATH_COLORS[index];
          const isEnabled = index < enabledPaths;

          return (
            <div
              key={path.id}
              className={`flex items-center justify-between p-2.5 rounded-lg border relative transition-all ${isEnabled
                ? `${colors.bg} ${colors.border} hover:opacity-90`
                : 'bg-gray-50 border-gray-100 opacity-50'
                }`}
            >
              <div className="flex items-center gap-2 flex-1">
                <span className={`text-[11px] font-bold uppercase ${isEnabled ? colors.text : 'text-gray-400'}`}>
                  Caminho {colors.label}
                </span>
                {isEnabled ? (
                  <div className="flex items-center gap-1 ml-auto mr-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={path.percent}
                      onChange={(e) => handlePercentChange(index, Number(e.target.value))}
                      className={`w-14 p-1 text-center text-sm font-bold rounded border ${colors.border} ${colors.text} bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 nodrag`}
                    />
                    <span className={`text-xs font-bold ${colors.text}`}>%</span>
                  </div>
                ) : (
                  <span className="text-[10px] text-gray-400 ml-auto mr-2">desabilitado</span>
                )}
              </div>
              <Handle
                type="source"
                position={Position.Right}
                id={path.id}
                className={`w-8 h-8 border-2 border-white -mr-1 ${isEnabled ? colors.handle : 'bg-gray-300'}`}
              />
            </div>
          );
        })}

        {/* Distribution bar */}
        <div className="space-y-1">
          <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
            {paths
              .filter((_: any, i: number) => i < enabledPaths)
              .map((path: any, index: number) => (
                <div
                  key={path.id}
                  className={`${PATH_COLORS[index].bar} transition-all duration-300`}
                  style={{ width: `${path.percent}%` }}
                />
              ))}
          </div>
          <div className={`text-center text-[10px] font-bold tracking-wider ${isValid ? 'text-green-600' : 'text-red-500'}`}>
            Total: {total}% {isValid ? '✓' : '✗ (deve ser 100%)'}
          </div>
        </div>
      </div>
    </div>
  );
});

RandomNode.displayName = 'RandomNode';
