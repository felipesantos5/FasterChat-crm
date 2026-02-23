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
    <div className="bg-white border-2 border-primary rounded-md shadow-md min-w-[280px] overflow-hidden">
      <div className="bg-primary/10 px-3 py-2 border-b border-primary/20 flex items-center justify-between">
        <span className="text-sm font-semibold text-primary">⚡ Gatilho</span>
      </div>
      <div className="p-3">
        <p className="text-sm text-gray-700 font-medium mb-1">Webhook URL:</p>
        <div className="flex items-center gap-2">
          <div className="bg-gray-100 p-2 rounded text-xs overflow-x-hidden whitespace-nowrap border text-gray-500 font-mono flex-1 text-ellipsis">
            {fullUrl}
          </div>
          <button
            onClick={handleCopy}
            className="p-2 border rounded bg-white hover:bg-gray-50 text-gray-500 hover:text-primary transition-colors cursor-pointer nodrag"
            title="Copiar Link"
          >
            <Copy size={14} />
          </button>
        </div>
        {/* <p className="text-[10px] text-gray-400 mt-2">Dispara quando receber POST do seu Hub/Checkout.</p> */}
      </div>
      <Handle type="source" position={Position.Right} id="a" className="w-3 h-3 bg-primary" />
    </div>
  );
});

TriggerNode.displayName = 'TriggerNode';
