'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DeployPipeline } from '@/components/pipeline/DeployPipeline';

export default function PipelinePage() {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      router.replace('/');
    }
  }, [router]);

  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <DeployPipeline />
    </div>
  );
}
