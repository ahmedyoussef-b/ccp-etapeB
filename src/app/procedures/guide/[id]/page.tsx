import { ProcedureGuidePageClient } from "./ProcedureGuidePageClient";

interface PageProps {
  params: { id: string };
}

export default function ProcedureGuidePage({ params }: PageProps) {
  return <ProcedureGuidePageClient id={params.id} />;
}
