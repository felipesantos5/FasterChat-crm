import { memo, useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Trash2, Tag, ShieldCheck } from 'lucide-react';
import { VariablePickerModal } from '../VariablePickerModal';

const OPERATORS = [
  { value: 'equals', label: 'é igual a', symbol: '===' },
  { value: 'not_equals', label: 'é diferente de', symbol: '!==' },
  { value: 'contains', label: 'contém', symbol: '∋' },
  { value: 'not_contains', label: 'não contém', symbol: '∌' },
  { value: 'starts_with', label: 'começa com', symbol: 'A…' },
  { value: 'ends_with', label: 'termina com', symbol: '…Z' },
  { value: 'greater_than', label: 'maior que', symbol: '>' },
  { value: 'less_than', label: 'menor que', symbol: '<' },
  { value: 'is_empty', label: 'está vazio', symbol: '∅' },
  { value: 'is_not_empty', label: 'não está vazio', symbol: '≠∅' },
];

export const ValidationNode = memo(({ id, data }: any) => {
  const { updateNodeData, deleteElements } = useReactFlow();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const variable = data?.variable || '';
  const operator = data?.operator || 'equals';
  const compareValue = data?.compareValue || '';

  const selectedOp = OPERATORS.find(o => o.value === operator) || OPERATORS[0];
  const isUnaryOp = operator === 'is_empty' || operator === 'is_not_empty';

  const handleVariableSelect = (varName: string) => {
    updateNodeData(id, { variable: `{{${varName}}}` });
  };

  const handleOperatorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateNodeData(id, { operator: e.target.value });
  };

  const handleCompareValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { compareValue: e.target.value });
  };

  // Render variable with highlight
  const renderVariable = (v: string) => {
    if (!v) return <span className="text-gray-400 italic text-xs">Selecione uma variável</span>;
    if (v.startsWith('{{') && v.endsWith('}}')) {
      return <code className="text-xs font-mono font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">{v}</code>;
    }
    return <span className="text-xs text-gray-700">{v}</span>;
  };

  return (
    <div className="bg-white border-2 border-amber-400 rounded-xl shadow-lg min-w-[320px] max-w-[380px] overflow-hidden transition-all hover:shadow-amber-100 hover:border-amber-500">
      <Handle type="target" position={Position.Left} className="w-5 h-5 bg-amber-500 border-2 border-white" />

      {/* Header */}
      <div className="bg-amber-50 px-3 py-3 border-b border-amber-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="bg-amber-500 p-1.5 rounded-lg shadow-sm">
            <ShieldCheck size={16} className="text-white" />
          </div>
          <span className="text-sm font-bold text-amber-900 tracking-tight">Validação</span>
        </div>
        <button
          onClick={() => { if (confirm('Excluir este bloco?')) deleteElements({ nodes: [{ id }] }) }}
          className="text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-700 transition-colors nodrag p-1 rounded-md"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 bg-white space-y-3">
        {/* Variable selector */}
        <div>
          <label className="text-[10px] font-bold text-amber-600 uppercase tracking-widest ml-1 mb-1.5 block">
            Variável
          </label>
          <button
            onClick={() => setIsPickerOpen(true)}
            className="w-full flex items-center justify-between gap-2 p-2.5 bg-amber-50/50 border border-amber-200 rounded-lg hover:bg-amber-50 hover:border-amber-300 transition-all nodrag text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Tag size={14} className="text-amber-500 flex-shrink-0" />
              {renderVariable(variable)}
            </div>
            <span className="text-[10px] font-bold text-amber-400 bg-amber-100 px-1.5 py-0.5 rounded flex-shrink-0">
              Trocar
            </span>
          </button>
        </div>

        {/* Operator */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">
            Operador
          </label>
          <select
            value={operator}
            onChange={handleOperatorChange}
            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 nodrag cursor-pointer transition-all hover:bg-gray-100"
          >
            {OPERATORS.map(op => (
              <option key={op.value} value={op.value}>
                {op.symbol} {op.label}
              </option>
            ))}
          </select>
        </div>

        {/* Compare value (hide for unary operators) */}
        {!isUnaryOp && (
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">
              Comparar com
            </label>
            <input
              type="text"
              value={compareValue}
              onChange={handleCompareValueChange}
              placeholder='Ex: felipe, sim, ativo...'
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 nodrag transition-all placeholder:text-gray-300"
            />
          </div>
        )}

        {/* Visual summary */}
        <div className="bg-gray-50 border border-gray-100 rounded-lg p-2.5 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">SE</span>
          {variable ? (
            <code className="text-[11px] font-mono font-bold text-amber-700 bg-amber-100 px-1 py-0.5 rounded">{variable}</code>
          ) : (
            <span className="text-[11px] text-gray-300">???</span>
          )}
          <span className="text-[11px] font-bold text-gray-500">{selectedOp.symbol}</span>
          {!isUnaryOp && (
            compareValue ? (
              <code className="text-[11px] font-mono text-blue-700 bg-blue-100 px-1 py-0.5 rounded">&quot;{compareValue}&quot;</code>
            ) : (
              <span className="text-[11px] text-gray-300">&quot;???&quot;</span>
            )
          )}
        </div>

        {/* Output handles */}
        <div className="space-y-2 pt-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
            Caminhos de Saída
          </label>

          <div className="flex items-center justify-between bg-green-50/50 p-2.5 rounded-lg border border-green-200 relative group hover:bg-green-50 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-[11px] font-bold text-green-700 uppercase">✓ Verdadeiro</span>
            </div>
            <Handle type="source" position={Position.Right} id="true" className="w-5 h-5 bg-green-500 border-2 border-white -mr-1" />
          </div>

          <div className="flex items-center justify-between bg-red-50/50 p-2.5 rounded-lg border border-red-200 relative group hover:bg-red-50 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-[11px] font-bold text-red-700 uppercase">✗ Falso</span>
            </div>
            <Handle type="source" position={Position.Right} id="false" className="w-5 h-5 bg-red-500 border-2 border-white -mr-1" />
          </div>
        </div>
      </div>

      <VariablePickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={handleVariableSelect}
        flowId={data?.flowId}
      />
    </div>
  );
});

ValidationNode.displayName = 'ValidationNode';
