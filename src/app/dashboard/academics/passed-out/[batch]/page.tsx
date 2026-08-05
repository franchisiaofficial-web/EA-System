import { BatchDetailClient } from './BatchDetailClient';

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ batch: string }>;
}) {
  const { batch } = await params;
  return <BatchDetailClient batch={batch} />;
}
