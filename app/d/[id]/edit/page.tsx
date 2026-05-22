import { notFound } from 'next/navigation';
import { getDeck } from '@/lib/storage';
import DeckEditor from '@/components/DeckEditor';

export const dynamic = 'force-dynamic';

export default async function EditPage({ params }: { params: { id: string } }) {
  const deck = await getDeck(params.id);
  if (!deck) notFound();
  return (
    <DeckEditor
      id={deck.meta.slug}
      initialTitle={deck.meta.title}
      initialHtml={deck.html}
    />
  );
}
