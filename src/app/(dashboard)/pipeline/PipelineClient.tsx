'use client';

import { DeployPipeline } from '@/components/pipeline/DeployPipeline';

export default function PipelineClient() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <DeployPipeline />
    </div>
  );
}
