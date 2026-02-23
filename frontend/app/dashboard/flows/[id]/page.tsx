"use client";

import { use } from 'react';
import { FlowCanvas } from '@/components/flows/FlowCanvas';
import { ReactFlowProvider } from '@xyflow/react';

export default function FlowBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  // Real implementation would fetch flow by ID from our created API
  // For now, let's just render the FlowCanvas

  return (
    <div className="flex flex-col h-[calc(100vh-65px)] w-full bg-white relative">
      <ReactFlowProvider>
        <FlowCanvas flowId={id} />
      </ReactFlowProvider>
    </div>
  );
}
