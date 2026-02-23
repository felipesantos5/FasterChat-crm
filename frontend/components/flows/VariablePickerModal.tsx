import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import api from '@/lib/api';
import { History, Tag, Search, X } from 'lucide-react';

interface VariablePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (variable: string) => void;
  flowId: string;
}

export function VariablePickerModal({ isOpen, onClose, onSelect, flowId }: VariablePickerModalProps) {
  const [variables, setVariables] = useState<{ key: string, value: any }[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchVariables = useCallback(async () => {
    if (!flowId) return;
    setLoading(true);
    try {
      const res = await api.get(`/flows/${flowId}/variables`);
      setVariables(res.data.variables || []);
    } catch (error) {
      console.error('Error fetching variables', error);
    } finally {
      setLoading(false);
    }
  }, [flowId]);

  useEffect(() => {
    if (isOpen) {
      fetchVariables();
    }
  }, [isOpen, fetchVariables]);

  const filteredVariables = variables.filter(v =>
    v.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden gap-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" />
            Variáveis do Webhook
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 border-b bg-gray-50/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar variável..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
        </div>

        <ScrollArea className="h-[400px]">
          <div className="p-4 space-y-2">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center opacity-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2" />
                <p className="text-sm">Carregando...</p>
              </div>
            ) : filteredVariables.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {filteredVariables.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => {
                      onSelect(v.key);
                      onClose();
                    }}
                    className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl hover:border-primary hover:bg-primary/5 transition-all group text-left"
                  >
                    <div className="bg-primary/10 p-2 rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <Tag size={16} />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-row items-center gap-2">
                      <code className="text-[11px] font-bold text-gray-800 truncate font-mono">
                        {`{{${v.key}}}`}
                      </code>
                      {v.value !== undefined && v.value !== null && (
                        <>
                          <span className="text-gray-400 font-bold">=</span>
                          <span className="text-[11px] text-gray-500 truncate bg-gray-50/80 px-2 py-0.5 rounded-md border border-gray-100 max-w-[200px]" title={String(v.value)}>
                            {String(v.value)}
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center text-center px-4">
                <div className="bg-gray-100 p-4 rounded-full mb-4 text-gray-400">
                  <History size={32} />
                </div>
                <h4 className="text-sm font-bold text-gray-700">Nenhuma variável encontrada</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-[200px]">
                  {searchTerm
                    ? `Nenhum resultado para "${searchTerm}"`
                    : "Envie dados para o URL de gatilho primeiro para capturar as variáveis automaticamente."}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-gray-50 flex justify-between items-center text-[10px] text-gray-400 font-medium">
          <span>Dica: Clique para inserir no texto</span>
          <span>{filteredVariables.length} campos</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
