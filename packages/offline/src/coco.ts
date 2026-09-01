import type {
  AgentMemoryWrite,
  CocoConversationWrite,
  CocoMessageWrite,
} from '@kayamo/db';
import { incomingWins, omitServerCursor } from '@kayamo/db';
import {
  getOfflineDb,
  type LocalAgentMemory,
  type LocalCocoConversation,
  type LocalCocoMessage,
  type LocalJournalEntry,
} from './db';
import { enqueueUpsert } from './queue';
import { drainQueue } from './sync';

function newId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function createLocalCocoConversation(input: {
  userId: string;
  title?: string | null;
  id?: string;
}): Promise<LocalCocoConversation> {
  const at = nowIso();
  const row: LocalCocoConversation = {
    id: input.id ?? newId(),
    user_id: input.userId,
    title: input.title?.trim() || null,
    created_at: at,
    updated_at: at,
    server_updated_at: at,
    deleted_at: null,
  };
  await getOfflineDb().coco_conversations.put(row);
  await enqueueUpsert(
    'coco_conversations',
    row.id,
    omitServerCursor(row) satisfies CocoConversationWrite,
  );
  void drainQueue();
  return row;
}

export async function appendLocalCocoMessage(input: {
  userId: string;
  conversationId: string;
  role: LocalCocoMessage['role'];
  content: string;
  responseSource?: LocalCocoMessage['response_source'];
  id?: string;
}): Promise<LocalCocoMessage> {
  const db = getOfflineDb();
  const conversation = await db.coco_conversations.get(input.conversationId);
  if (!conversation || conversation.user_id !== input.userId || conversation.deleted_at) {
    throw new Error('Cannot append to a missing, deleted, or unowned conversation');
  }
  const at = nowIso();
  const content = typeof input.content === 'string' ? input.content.trim() : '';
  if (!content) {
    throw new Error('Coco message content is required');
  }
  const row: LocalCocoMessage = {
    id: input.id ?? newId(),
    user_id: input.userId,
    conversation_id: input.conversationId,
    role: input.role,
    content,
    response_source: input.responseSource ?? null,
    created_at: at,
    updated_at: at,
    server_updated_at: at,
    deleted_at: null,
  };
  await db.coco_messages.put(row);
  await enqueueUpsert(
    'coco_messages',
    row.id,
    omitServerCursor(row) satisfies CocoMessageWrite,
  );
  const touched = { ...conversation, updated_at: at };
  await db.coco_conversations.put(touched);
  await enqueueUpsert(
    'coco_conversations',
    touched.id,
    omitServerCursor(touched) satisfies CocoConversationWrite,
  );
  void drainQueue();
  return row;
}

export async function renameLocalCocoConversation(input: {
  id: string;
  userId: string;
  title: string;
}): Promise<LocalCocoConversation | null> {
  const db = getOfflineDb();
  const existing = await db.coco_conversations.get(input.id);
  if (!existing || existing.user_id !== input.userId || existing.deleted_at) return null;
  const title = input.title.trim().slice(0, 120);
  if (!title) return existing;
  const at = nowIso();
  const row: LocalCocoConversation = { ...existing, title, updated_at: at };
  await db.coco_conversations.put(row);
  await enqueueUpsert(
    'coco_conversations',
    row.id,
    omitServerCursor(row) satisfies CocoConversationWrite,
  );
  void drainQueue();
  return row;
}

export async function createLocalAgentMemory(input: {
  userId: string;
  kind: string;
  content: string;
  confirmed: true;
  id?: string;
}): Promise<LocalAgentMemory> {
  if (input.confirmed !== true) throw new Error('Memory requires explicit confirmation');
  const at = nowIso();
  const row: LocalAgentMemory = {
    id: input.id ?? newId(),
    user_id: input.userId,
    kind: input.kind,
    content: input.content.trim(),
    embedding: null,
    embedding_model: 'none',
    explicit: true,
    created_at: at,
    updated_at: at,
    server_updated_at: at,
    deleted_at: null,
  };
  await getOfflineDb().agent_memory.put(row);
  await enqueueUpsert(
    'agent_memory',
    row.id,
    omitServerCursor(row) satisfies AgentMemoryWrite,
  );
  void drainQueue();
  return row;
}

export async function saveLocalJournalEntry(input: {
  userId: string;
  kind: LocalJournalEntry['kind'];
  content: string;
  id?: string;
}): Promise<LocalJournalEntry> {
  const at = nowIso();
  const row: LocalJournalEntry = {
    id: input.id ?? newId(),
    user_id: input.userId,
    kind: input.kind,
    content: input.content,
    created_at: at,
    updated_at: at,
  };
  await getOfflineDb().local_journal_entries.put(row);
  return row;
}

export async function rememberJournalEntry(input: {
  journalId: string;
  userId: string;
  memoryKind: string;
  confirmed: true;
}): Promise<LocalAgentMemory> {
  if (input.confirmed !== true) throw new Error('Memory requires explicit confirmation');
  const journal = await getOfflineDb().local_journal_entries.get(input.journalId);
  if (!journal || journal.user_id !== input.userId) {
    throw new Error('Journal entry was not found for this user');
  }
  return createLocalAgentMemory({
    userId: input.userId,
    kind: input.memoryKind,
    content: journal.content,
    confirmed: true,
  });
}

export async function listLocalJournalEntries(
  userId: string,
  kind?: LocalJournalEntry['kind'],
): Promise<LocalJournalEntry[]> {
  const rows = await getOfflineDb()
    .local_journal_entries.where('user_id')
    .equals(userId)
    .toArray();
  return rows
    .filter((row) => kind === undefined || row.kind === kind)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function deleteLocalJournalEntry(params: {
  id: string;
  userId: string;
}): Promise<void> {
  const db = getOfflineDb();
  const row = await db.local_journal_entries.get(params.id);
  if (row?.user_id === params.userId) await db.local_journal_entries.delete(params.id);
}

export async function listLocalAgentMemories(
  userId: string,
): Promise<LocalAgentMemory[]> {
  const rows = await getOfflineDb()
    .agent_memory.where('user_id')
    .equals(userId)
    .toArray();
  return rows.filter((row) => row.explicit && !row.deleted_at);
}

export async function listLocalCocoConversations(
  userId: string,
): Promise<LocalCocoConversation[]> {
  const rows = await getOfflineDb()
    .coco_conversations.where('user_id')
    .equals(userId)
    .toArray();
  return rows
    .filter((row) => !row.deleted_at)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function listLocalCocoMessages(
  userId: string,
  conversationId: string,
): Promise<LocalCocoMessage[]> {
  const conversation = await getOfflineDb().coco_conversations.get(conversationId);
  if (!conversation || conversation.user_id !== userId || conversation.deleted_at)
    return [];
  const rows = await getOfflineDb()
    .coco_messages.where('conversation_id')
    .equals(conversationId)
    .toArray();
  return rows
    .filter((row) => row.user_id === userId && !row.deleted_at)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

async function tombstoneLocalCocoRecord(
  table: 'agent_memory' | 'coco_conversations' | 'coco_messages',
  params: { id: string; userId: string },
): Promise<void> {
  const db = getOfflineDb();
  const store = db.table<LocalAgentMemory | LocalCocoConversation | LocalCocoMessage>(
    table,
  );
  const existing = await store.get(params.id);
  if (!existing || existing.user_id !== params.userId || existing.deleted_at) return;
  const at = nowIso();
  const row = { ...existing, deleted_at: at, updated_at: at };
  await store.put(row);
  await enqueueUpsert(table, row.id, omitServerCursor(row));
  void drainQueue();
}

export async function tombstoneLocalAgentMemory(params: {
  id: string;
  userId: string;
}): Promise<void> {
  return tombstoneLocalCocoRecord('agent_memory', params);
}

export async function tombstoneLocalCocoConversation(params: {
  id: string;
  userId: string;
}): Promise<void> {
  return tombstoneLocalCocoRecord('coco_conversations', params);
}

export async function tombstoneLocalCocoMessage(params: {
  id: string;
  userId: string;
}): Promise<void> {
  return tombstoneLocalCocoRecord('coco_messages', params);
}

export async function mergeRemoteAgentMemories(rows: LocalAgentMemory[]): Promise<void> {
  const db = getOfflineDb();
  for (const row of rows) {
    const existing = await db.agent_memory.get(row.id);
    if (!existing || incomingWins(existing.updated_at, row.updated_at)) {
      await db.agent_memory.put(row);
    }
  }
}

export async function mergeRemoteCocoConversations(
  rows: LocalCocoConversation[],
): Promise<void> {
  const db = getOfflineDb();
  for (const row of rows) {
    const existing = await db.coco_conversations.get(row.id);
    if (!existing || incomingWins(existing.updated_at, row.updated_at)) {
      await db.coco_conversations.put(row);
    }
  }
}

export async function mergeRemoteCocoMessages(rows: LocalCocoMessage[]): Promise<void> {
  const db = getOfflineDb();
  for (const row of rows) {
    const existing = await db.coco_messages.get(row.id);
    if (!existing || incomingWins(existing.updated_at, row.updated_at)) {
      await db.coco_messages.put(row);
    }
  }
}
