"use client";

import { use, Suspense } from 'react';
import { FlowCanvas } from '@/components/flows/FlowCanvas';
import { ReactFlowProvider } from '@xyflow/react';

function FlowBuilderInner({ id }: { id: string }) {
  return (
    <div className="flex flex-col h-[calc(100vh-65px)] w-full bg-white relative overflow-hidden">
      <ReactFlowProvider>
        <FlowCanvas flowId={id} />
      </ReactFlowProvider>
    </div>
  );
}

export default function FlowBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center text-gray-400">Carregando fluxo...</div>}>
      <FlowBuilderInner id={id} />
    </Suspense>
  );
}
