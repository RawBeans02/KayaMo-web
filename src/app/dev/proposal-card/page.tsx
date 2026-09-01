import { notFound } from 'next/navigation';

/**
 * Isolation gallery for the proposal-card contract. Production builds 404
 * and the import lives in the else-branch so webpack can drop the chunk.
 * Delete this route once every mutation renders ProposalCard on a real screen.
 */
export default async function DevProposalCardPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  } else {
    const { ProposalCardGallery } = await import('./gallery');
    return <ProposalCardGallery />;
  }
}
