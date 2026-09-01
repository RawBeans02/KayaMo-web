import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendLocalCocoMessage,
  createLocalCocoConversation,
  deleteLocalJournalEntry,
  listLocalAgentMemories,
  listLocalCocoConversations,
  listLocalCocoMessages,
  listLocalJournalEntries,
  renameLocalCocoConversation,
  mergeRemoteAgentMemories,
  rememberJournalEntry,
  saveLocalJournalEntry,
  tombstoneLocalAgentMemory,
} from './coco';
import { getOfflineDb, resetOfflineDb } from './db';
import { pendingCount } from './queue';

vi.mock('./sync', async () => {
  const status = await import('./status');
  return {
    drainQueue: vi.fn(async () => undefined),
    startSync: vi.fn(),
    getSyncStatusSnapshot: vi.fn(() => ({ kind: 'synced' })),
    bindStatusStore: status.subscribeSyncStatus,
    resumeSync: vi.fn(),
  };
});

describe('Coco offline privacy boundary', () => {
  beforeEach(async () => {
    await resetOfflineDb();
  });

  afterEach(async () => {
    await resetOfflineDb();
  });

  it.each(['diary', 'vent', 'prayer'] as const)(
    'keeps %s entries out of every sync record',
    async (kind) => {
      const entry = await saveLocalJournalEntry({
        id: `journal-${kind}`,
        userId: 'user-a',
        kind,
        content: `private ${kind} content`,
      });

      expect((await listLocalJournalEntries('user-a', kind))[0]?.id).toBe(entry.id);
      expect(await pendingCount()).toBe(0);
      expect(await getOfflineDb().agent_memory.count()).toBe(0);
      expect(JSON.stringify(await getOfflineDb().sync_queue.toArray())).not.toContain(
        `private ${kind} content`,
      );
    },
  );

  it('syncs journal content only after explicit Remember this confirmation', async () => {
    const journal = await saveLocalJournalEntry({
      userId: 'user-a',
      kind: 'diary',
      content: 'Morning walks help me feel grounded.',
    });
    const memory = await rememberJournalEntry({
      journalId: journal.id,
      userId: 'user-a',
      memoryKind: 'preference',
      confirmed: true,
    });

    expect(memory.explicit).toBe(true);
    expect((await listLocalAgentMemories('user-a'))[0]?.content).toContain(
      'Morning walks',
    );
    expect(await pendingCount()).toBe(1);
  });

  it('deletes a local journal entry without creating a sync event', async () => {
    const journal = await saveLocalJournalEntry({
      userId: 'user-a',
      kind: 'prayer',
      content: 'Private prayer',
    });
    await deleteLocalJournalEntry({ id: journal.id, userId: 'user-a' });

    expect(await listLocalJournalEntries('user-a')).toEqual([]);
    expect(await pendingCount()).toBe(0);
  });

  it('stores ordinary Coco chat as a synced conversation', async () => {
    const conversation = await createLocalCocoConversation({
      userId: 'user-a',
      title: 'Today',
    });
    await appendLocalCocoMessage({
      userId: 'user-a',
      conversationId: conversation.id,
      role: 'user',
      content: 'Help me choose one task.',
    });

    expect(await listLocalCocoMessages('user-a', conversation.id)).toHaveLength(1);
    expect((await listLocalCocoConversations('user-a'))[0]?.updated_at).toBeTruthy();
    expect(await pendingCount()).toBe(2);

    const renamed = await renameLocalCocoConversation({
      id: conversation.id,
      userId: 'user-a',
      title: 'Planning help',
    });
    expect(renamed?.title).toBe('Planning help');
  });

  it('rejects an empty assistant reply instead of throwing on trim', async () => {
    const conversation = await createLocalCocoConversation({
      userId: 'user-a',
      title: 'Today',
    });
    await expect(
      appendLocalCocoMessage({
        userId: 'user-a',
        conversationId: conversation.id,
        role: 'assistant',
        content: undefined as unknown as string,
      }),
    ).rejects.toThrow('Coco message content is required');
  });

  it('does not resurrect tombstoned explicit memory from stale sync data', async () => {
    const journal = await saveLocalJournalEntry({
      userId: 'user-a',
      kind: 'diary',
      content: 'I prefer quiet mornings.',
    });
    const live = await rememberJournalEntry({
      journalId: journal.id,
      userId: 'user-a',
      memoryKind: 'preference',
      confirmed: true,
    });
    await tombstoneLocalAgentMemory({ id: live.id, userId: 'user-a' });
    await mergeRemoteAgentMemories([{ ...live, updated_at: '2000-01-01T00:00:00.000Z' }]);

    expect(await listLocalAgentMemories('user-a')).toEqual([]);
    expect((await getOfflineDb().agent_memory.get(live.id))?.deleted_at).toBeTruthy();
  });
});
