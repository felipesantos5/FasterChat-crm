"use client";

import { use } from 'react';
import { FlowCanvas } from '@/components/flows/FlowCanvas';
import { useRouter } from 'next/navigation';
import { ReactFlowProvider } from '@xyflow/react';

export default function FlowBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const isNew = id === 'new';

  // Real implementation would fetch flow by ID from our created API
  // For now, let's just render the FlowCanvas

  return (
    <div className="flex flex-col h-[calc(100vh-65px)] w-full relative">
      <div className="absolute top-4 left-4 z-10 bg-white shadow-sm p-3 rounded-md border flex items-center space-x-4">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-black">
          &larr; Voltar
        </button>
        <span className="font-semibold">{isNew ? 'Novo Fluxo' : 'Editando Fluxo'}</span>
      </div>

      <ReactFlowProvider>
        <FlowCanvas flowId={id} />
      </ReactFlowProvider>
    </div>
  );
}
