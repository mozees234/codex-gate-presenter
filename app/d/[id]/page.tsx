import { notFound } from 'next/navigation';
import { getDeckMeta } from '@/lib/storage';
import DeckPlayer from '@/components/DeckPlayer';

export const dynamic = 'force-dynamic';

export default async function PresentPage({ params }: { params: { id: string } }) {
  const meta = await getDeckMeta(params.id);
  if (!meta) notFound();
  return <DeckPlayer id={meta.slug} title={meta.title} />;
}
