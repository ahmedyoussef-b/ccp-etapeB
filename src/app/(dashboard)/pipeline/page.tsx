//src/app/(dashboard)/pipeline/page.tsx
import { redirect } from 'next/navigation';
import PipelineClient from './PipelineClient';

export default function PipelinePage() {
  if (process.env.NODE_ENV === 'production') {
    redirect('/');
  }

  return <PipelineClient />;
}
