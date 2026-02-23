import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

export const TriggerNode = memo(({ data }: any) => {
  const getFullUrl = (path: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3051";
    // path is something like "/api/webhooks/flow/meu-fluxo"
    // Since baseUrl might have "/api", we need to be careful if NEXT_PUBLIC_API_URL already ends with /api. If path already has /api, we should combine nicely.
    // Generally, NEXT_PUBLIC_API_URL is "https://domain.com/api" or "https://domain.com"
    // Let's assume the path passed in is the exact path after the base domain like `/api/webhooks/flow/...`
    // And NEXT_PUBLIC_API_URL is the base server URL like "http://localhost:3051"

    // Actually, in `api.ts`, baseURL is `${API_URL}/api`, meaning API_URL is the server domain, e.g. "http://localhost:3051".
    return `${baseUrl}${path}`;
  };

  const currentPath = data?.description || '/api/webhooks/flow/meu-fluxo';
  const fullUrl = getFullUrl(currentPath);

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl);
    toast.success('Link do webhook copiado!');
  };

  return (
    <div className="bg-white border-2 border-primary rounded-md shadow-md min-w-[280px] max-w-[430px] overflow-hidden">
      <div className="bg-primary/10 px-3 py-2 border-b border-primary/20 flex items-center justify-between">
        <span className="text-sm font-semibold text-primary">⚡ Gatilho</span>
      </div>
      <div className="p-3 flex flex-col gap-2">
        <button
          onClick={handleCopy}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-900 border border-gray-800 text-white rounded-md text-sm hover:bg-black transition-colors cursor-pointer nodrag font-medium"
        >
          <Copy size={16} />
          Copiar link do webhook
        </button>

        <p className="text-xs text-center text-gray-500 mt-1 leading-relaxed">
          Para ativar, faça um <strong>POST</strong> enviando suas propriedades e coloque o <strong>phone</strong> para ativar o fluxo e enviar a mensagem.
        </p>
      </div>
      <Handle type="source" position={Position.Right} id="a" className="w-3 h-3 bg-primary" />
    </div>
  );
});

TriggerNode.displayName = 'TriggerNode';
