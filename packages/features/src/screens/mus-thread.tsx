'use client';

import {
  Check,
  Clock,
  Image as ImageIcon,
  MagnifyingGlass,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  PushPin,
  X,
} from '@phosphor-icons/react';
import type { CocoActionProposal, MusEntry } from '@kayamo/ai';
import { createBrowserSupabase } from '@kayamo/db';
import {
  appendLocalCocoMessage,
  createLocalAgentMemory,
  createLocalCocoConversation,
  listLocalCocoConversations,
  listLocalCocoMessages,
  recoverClosedOfflineDb,
  renameLocalCocoConversation,
  tombstoneLocalCocoConversation,
  type LocalCocoConversation,
  type LocalCocoMessage,
} from '@kayamo/offline';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { apiFetch } from '../api/api-origin';
import { hydrateFoodHistory } from '../food/hydrate-food-history';
import { applyMusProposal } from '../mus/apply-proposal';
import {
  readActiveMusConversationId,
  writeActiveMusConversationId,
} from '../mus/conversation-session';
import { MusProposalCard } from '../mus/mus-proposal-card';
import { musReplyFromApi } from '../mus/mus-reply';
import { setMusBusy } from '../mus/mus-selection';
import {
  musMayWrite,
  permModuleForAction,
  readMusPermLevels,
} from '../mus/perm-levels';
import { applyCaptureItems } from '../todo/apply-plan';
import {
  imageObservationSchema,
  type CaptureProposal,
} from '../todo/planner-schema';
import styles from './kayamo-app.module.css';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 2_000_000;
const MUS_SEED_SRC = '/mus-neutral.png';

function foodHintProposals(
  hints: { name: string; portionHint: string | null }[],
): CocoActionProposal[] {
  return hints.slice(0, 6).map((hint) => ({
    proposalId: crypto.randomUUID(),
    action: 'log_food' as const,
    summary: hint.portionHint ? `Log ${hint.name} (${hint.portionHint})` : `Log ${hint.name}`,
    requiresConfirmation: true as const,
    arguments: { inputHint: hint.name },
  }));
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export function MusThread({
  userId,
  logicalDate,
  recommended,
  compact = false,
  chrome,
  entry,
}: {
  userId: string;
  logicalDate: string;
  recommended: string | null;
  compact?: boolean;
  chrome?: 'full' | 'rail' | 'page';
  entry?: MusEntry;
}) {
  const layout = chrome ?? (compact ? 'rail' : 'full');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<LocalCocoConversation[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [messages, setMessages] = useState<LocalCocoMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [rememberedMessageId, setRememberedMessageId] = useState<string | null>(null);
  const [proposals, setProposals] = useState<CocoActionProposal[]>([]);
  const [capture, setCapture] = useState<CaptureProposal | null>(null);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [proposalNote, setProposalNote] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 136)}px`;
  }, [text]);

  async function reloadConversations() {
    const rows = await recoverClosedOfflineDb(() => listLocalCocoConversations(userId));
    setConversations(rows);
    return rows;
  }

  function selectConversation(id: string) {
    setConversationId(id);
    writeActiveMusConversationId(userId, id);
    setProposals([]);
    setCapture(null);
    setProposalNote(null);
    setHistoryOpen(false);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const convos = await recoverClosedOfflineDb(() => listLocalCocoConversations(userId));
        if (cancelled) return;
        setConversations(convos);
        const saved = readActiveMusConversationId(userId);
        const pick = convos.find((row) => row.id === saved) ?? convos[0];
        if (pick) {
          setConversationId(pick.id);
          writeActiveMusConversationId(userId, pick.id);
          return;
        }
        const created = await createLocalCocoConversation({ userId, title: `Mus · ${logicalDate}` });
        if (cancelled) return;
        setConversationId(created.id);
        setConversations([created]);
        writeActiveMusConversationId(userId, created.id);
      } catch {
        // Composer stays disabled until a conversation exists.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [logicalDate, userId]);

  async function startNewConversation() {
    const created = await createLocalCocoConversation({ userId, title: `Mus · ${logicalDate}` });
    setMessages([]);
    setConversations((current) => [created, ...current]);
    selectConversation(created.id);
  }

  async function archiveConversation(id: string) {
    await tombstoneLocalCocoConversation({ id, userId });
    const remaining = (await reloadConversations()).filter((row) => row.id !== id);
    if (conversationId !== id) return;
    if (remaining[0]) {
      selectConversation(remaining[0].id);
      return;
    }
    await startNewConversation();
  }

  async function saveRename(id: string) {
    const title = renameDraft.trim().slice(0, 120);
    if (!title) {
      setRenamingId(null);
      return;
    }
    const row = await renameLocalCocoConversation({ id, userId, title });
    if (row) {
      setConversations((current) => current.map((item) => (item.id === id ? row : item)));
    }
    setRenamingId(null);
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const message = text.trim();
    const image = pendingImage;
    if ((!message && !image) || !conversationId || busy) return;
    setText('');
    setPendingImage(null);
    setBusy(true);
    setProposalNote(null);
    try {
      const shown = message || (image ? `Photo: ${image.name}` : '');
      const local = await appendLocalCocoMessage({
        userId,
        conversationId,
        role: 'user',
        content: shown,
      });
      setMessages((current) => [...current, local]);
      void reloadConversations();

      let observationText = '';
      const hintProposals: CocoActionProposal[] = [];
      if (image) {
        if (!IMAGE_TYPES.has(image.type) || image.size > MAX_IMAGE_BYTES) {
          setProposalNote('Use a JPEG, PNG, or WebP under 2 MB.');
          return;
        }
        try {
          const response = await apiFetch('/api/mus/observe-image', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              logicalDate,
              mediaType: image.type,
              imageBase64: await fileToBase64(image),
              caption: message || null,
              module: entry?.module ?? 'mus',
            }),
          });
          const body: unknown = await response.json().catch(() => null);
          const observation = imageObservationSchema.safeParse(
            body && typeof body === 'object' && 'observation' in body
              ? (body as { observation: unknown }).observation
              : body,
          );
          if (response.ok && observation.success) {
            observationText = observation.data.summary;
            hintProposals.push(...foodHintProposals(observation.data.foodHints));
            if (observation.data.captureItems.length > 0) {
              setCapture({
                items: observation.data.captureItems,
                questions: observation.data.questions,
              });
            }
            const seen = await appendLocalCocoMessage({
              userId,
              conversationId,
              role: 'assistant',
              content: observationText,
              responseSource: 'model',
            });
            setMessages((current) => [...current, seen]);
          } else {
            setProposalNote('Could not read that photo. Try again or describe it in text.');
          }
        } catch {
          setProposalNote('Could not read that photo. Try again or describe it in text.');
        }
      }

      const outbound = [message, observationText ? `[Image observation]\n${observationText}` : '']
        .filter(Boolean)
        .join('\n\n');
      if (!outbound) {
        setProposals(hintProposals);
        return;
      }

      let reply = recommended
        ? `I’m here. Your confirmed next action is “${recommended}.” We can make it smaller, but I won’t change it without you.`
        : 'I’m here. We can name one small next action together, and nothing will be saved until you confirm it.';
      let source: LocalCocoMessage['response_source'] = 'fallback';
      let nextProposals: CocoActionProposal[] = [];
      try {
        const response = await apiFetch('/api/mus/respond', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            mode: 'chat',
            message: outbound,
            logicalDate,
            ...(entry ? { entry } : {}),
          }),
        });
        if (response.ok) {
          const parsed = musReplyFromApi(await response.json());
          if (parsed) {
            reply = parsed.message;
            source = parsed.source;
            nextProposals = parsed.proposals;
          }
        }
      } catch {
        // The deterministic reply keeps Mus useful offline.
      }
      const mus = await appendLocalCocoMessage({
        userId,
        conversationId,
        role: 'assistant',
        content: reply,
        responseSource: source,
      });
      setMessages((current) => [...current, mus]);
      setProposals([...hintProposals, ...nextProposals]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setMusBusy(busy);
    return () => setMusBusy(false);
  }, [busy]);

  async function confirmProposal(proposal: CocoActionProposal) {
    const module = permModuleForAction(proposal.action);
    if (module && !musMayWrite(readMusPermLevels(userId)[module])) {
      setProposalNote('Mus cannot write this while that module is at read or never.');
      return;
    }
    setBusy(true);
    setProposalNote(null);
    try {
      const client = createBrowserSupabase();
      const clock = await hydrateFoodHistory({ client, userId }).catch(() => ({
        timeZone: 'Asia/Manila',
        dayStartsAt: '00:00:00',
      }));
      const result = await applyMusProposal({
        userId,
        proposal,
        timeZone: clock.timeZone,
        dayStartsAt: clock.dayStartsAt,
        today: logicalDate,
      });
      setProposalNote(result.message);
      if (result.ok) {
        setProposals((current) => current.filter((row) => row.proposalId !== proposal.proposalId));
      }
    } catch {
      setProposalNote('Could not save that. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmAllProposals() {
    if (proposals.length === 0) return;
    const blocked = proposals.some((proposal) => {
      const module = permModuleForAction(proposal.action);
      return module ? !musMayWrite(readMusPermLevels(userId)[module]) : false;
    });
    if (blocked) {
      setProposalNote('Mus cannot write this while that module is at read or never.');
      return;
    }
    setBusy(true);
    setProposalNote(null);
    try {
      const client = createBrowserSupabase();
      const clock = await hydrateFoodHistory({ client, userId }).catch(() => ({
        timeZone: 'Asia/Manila',
        dayStartsAt: '00:00:00',
      }));
      let applied = 0;
      for (const proposal of proposals) {
        const result = await applyMusProposal({
          userId,
          proposal,
          timeZone: clock.timeZone,
          dayStartsAt: clock.dayStartsAt,
          today: logicalDate,
        });
        if (!result.ok) {
          setProposalNote(result.message);
          return;
        }
        applied += 1;
        setProposals((current) => current.filter((row) => row.proposalId !== proposal.proposalId));
      }
      setProposalNote(`Applied ${applied} ${applied === 1 ? 'change' : 'changes'}.`);
    } catch {
      setProposalNote('Could not save those. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmCapture() {
    if (!capture) return;
    setBusy(true);
    setProposalNote(null);
    try {
      const result = await applyCaptureItems({ userId, today: logicalDate, capture });
      setProposalNote(result.message);
      if (result.ok) setCapture(null);
    } catch {
      setProposalNote('Could not save that dump. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function rememberMessage(message: LocalCocoMessage) {
    await createLocalAgentMemory({
      userId,
      kind: 'conversation_note',
      content: message.content,
      confirmed: true,
    });
    setRememberedMessageId(message.id);
  }

  useEffect(() => {
    if (!conversationId) return;
    void recoverClosedOfflineDb(() => listLocalCocoMessages(userId, conversationId))
      .then(setMessages)
      .catch(() => undefined);
  }, [conversationId, userId]);

  const canSend = Boolean(text.trim() || pendingImage) && !busy && Boolean(conversationId);
  const filteredConversations = conversations.filter((row) => {
    const q = historyQuery.trim().toLowerCase();
    if (!q) return true;
    return (row.title ?? 'Untitled').toLowerCase().includes(q);
  });

  const composerId = layout === 'rail' ? 'mus-message-rail' : layout === 'page' ? 'mus-message-page' : 'mus-message';
  const showHeader = layout !== 'rail';
  const showHistoryOverlay = layout !== 'page' && layout !== 'rail' && historyOpen;
  const showPageList = layout === 'page';

  const conversationList = (
    <div className={showPageList ? styles.musPageList : styles.historyPanel} role={showPageList ? 'navigation' : 'dialog'} aria-label="Conversations">
      <div className={showPageList ? styles.musPageListHead : styles.historyToolbar}>
        {showPageList ? <p className={styles.musPageEyebrow}>Conversations</p> : null}
        {showPageList ? null : (
          <label className={styles.historySearch}>
            <MagnifyingGlass size={15} />
            <input
              value={historyQuery}
              onChange={(event) => setHistoryQuery(event.target.value)}
              placeholder="Search conversations"
              autoComplete="off"
            />
          </label>
        )}
        <button type="button" className={showPageList ? styles.musPageNew : styles.historyGhost} onClick={() => void startNewConversation()}>
          {showPageList ? 'New conversation' : <><Plus size={15} /> New</>}
        </button>
        {showPageList ? null : (
          <button type="button" className={styles.historyGhost} onClick={() => setHistoryOpen(false)} aria-label="Close history">
            <X size={15} />
          </button>
        )}
      </div>
      <ul className={styles.historyList}>
        {filteredConversations.length === 0 ? (
          <li className={styles.mutedNote}>No conversations yet.</li>
        ) : (
          filteredConversations.map((row) => (
            <li key={row.id} className={styles.historyRow} data-active={row.id === conversationId ? 'true' : undefined}>
              {renamingId === row.id ? (
                <input
                  className={styles.historyRename}
                  value={renameDraft}
                  onChange={(event) => setRenameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void saveRename(row.id);
                    }
                    if (event.key === 'Escape') setRenamingId(null);
                  }}
                  aria-label="Conversation title"
                />
              ) : (
                <button type="button" className={styles.historyOpen} onClick={() => selectConversation(row.id)}>
                  <strong>{row.title?.trim() || 'Untitled'}</strong>
                  <small>{row.updated_at.slice(0, 10)}</small>
                </button>
              )}
              <button
                type="button"
                className={styles.historyGhost}
                aria-label="Rename conversation"
                onClick={() => {
                  setRenamingId(row.id);
                  setRenameDraft(row.title ?? '');
                }}
              >
                <PencilSimple size={14} />
              </button>
              <button
                type="button"
                className={styles.historyGhost}
                onClick={() => void archiveConversation(row.id)}
              >
                Archive
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );

  return (
    <div
      className={`${styles.screen} ${styles.musScreen} ${layout === 'rail' ? styles.musRailThread : ''} ${layout === 'page' ? styles.musPage : ''} ${compact || layout === 'rail' ? styles.musCompact : ''}`}
      aria-labelledby="mus-chat-title"
      data-mus-thread={layout}
    >
      {showPageList ? conversationList : null}
      {showHeader ? (
        <header className={styles.chatHeader}>
          <img src={MUS_SEED_SRC} alt="" width={48} height={48} />
          <div>
            <h2 id="mus-chat-title">Mus</h2>
            <p>tone · balanced · adapts to the moment</p>
          </div>
          {layout === 'page' ? (
            <span className={styles.musPageMeta}>state · {busy ? 'thinking' : 'neutral'}</span>
          ) : (
            <button
              className={styles.chatHistoryButton}
              type="button"
              aria-label="Conversation history"
              aria-expanded={historyOpen}
              onClick={() => {
                setHistoryOpen((open) => !open);
                void reloadConversations();
              }}
            >
              <Clock size={19} />
            </button>
          )}
        </header>
      ) : (
        <h2 id="mus-chat-title" className={styles.srOnly}>
          Mus
        </h2>
      )}
      {showHistoryOverlay ? conversationList : null}
      <div className={styles.chatMessages} aria-live="polite">
        {messages.length === 0 ? (
          <div className={styles.cocoBubble}>I’m with you. We can talk, reflect, or choose one realistic next step.</div>
        ) : null}
        {messages.map((message) =>
          message.role === 'user' ? (
            <div key={message.id} className={styles.userBubble}>
              {message.content}
            </div>
          ) : (
            <div key={message.id} className={styles.cocoMessageGroup}>
              <div className={styles.cocoBubble}>{message.content}</div>
              {recommended ? (
                <p className={styles.chatSource}>
                  <Clock size={13} /> From your confirmed plan for today.
                </p>
              ) : null}
              <button
                className={styles.rememberButton}
                type="button"
                onClick={() => void rememberMessage(message)}
                disabled={rememberedMessageId === message.id}
              >
                {rememberedMessageId === message.id ? <Check size={15} /> : <PushPin size={15} />}{' '}
                {rememberedMessageId === message.id ? 'Remembered' : 'Remember this'}
              </button>
            </div>
          ),
        )}
        {capture ? (
          <div className={styles.cocoMessageGroup}>
            <div className={styles.workingToward}>
              <span>
                <b>brain dump</b>
                <strong>{capture.items.map((item) => item.title).join(', ')}</strong>
                <small>Nothing is saved until you confirm.</small>
                {capture.questions.length > 0 ? <small>{capture.questions.join(' ')}</small> : null}
              </span>
              <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => void confirmCapture()}>
                Confirm
              </button>
              <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => setCapture(null)}>
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
        {proposals.length > 0 ? (
          <div className={styles.cocoMessageGroup}>
            {proposals.length > 1 ? (
              <div className={styles.workingToward}>
                <span>
                  <b>several changes</b>
                  <strong>Mus wants to make {proposals.length} changes.</strong>
                  <small>Review the diffs below. Nothing is saved until you confirm.</small>
                </span>
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={busy}
                  onClick={() => void confirmAllProposals()}
                >
                  Confirm all
                </button>
              </div>
            ) : null}
            {proposals.map((proposal) => (
              <MusProposalCard
                key={proposal.proposalId}
                proposal={proposal}
                userId={userId}
                onConfirm={() => void confirmProposal(proposal)}
                onDismiss={() =>
                  setProposals((current) => current.filter((row) => row.proposalId !== proposal.proposalId))
                }
              />
            ))}
          </div>
        ) : null}
        {proposalNote ? <p className={styles.mutedNote}>{proposalNote}</p> : null}
        {busy ? <div className={styles.cocoBubble}>Thinking carefully…</div> : null}
      </div>
      <form className={styles.chatComposer} onSubmit={send}>
        {pendingImage ? (
          <p className={styles.chatPendingImage}>
            {pendingImage.name}
            <button type="button" onClick={() => setPendingImage(null)}>
              Remove
            </button>
          </p>
        ) : null}
        <label className={styles.srOnly} htmlFor={composerId}>
          Message Mus. Enter sends. Shift+Enter starts a new line.
        </label>
        <input
          ref={fileRef}
          className={styles.srOnly}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            event.target.value = '';
            if (!file) return;
            if (!IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES) {
              setProposalNote('Use a JPEG, PNG, or WebP under 2 MB.');
              return;
            }
            setPendingImage(file);
            setProposalNote(null);
          }}
        />
        <button
          type="button"
          className={styles.chatAttach}
          disabled={busy}
          aria-label="Attach a photo"
          onClick={() => fileRef.current?.click()}
        >
          <ImageIcon size={20} />
        </button>
        <textarea
          id={composerId}
          ref={composerRef}
          rows={2}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }}
          placeholder="Say what’s actually going on…"
        />
        <button type="submit" className={styles.chatSend} disabled={!canSend} aria-label="Send message">
          <PaperPlaneTilt size={21} weight="fill" />
        </button>
      </form>
      {layout === 'full' ? <p className={styles.chatPrivacy}>Mus proposes. You confirm every write.</p> : null}
    </div>
  );
}
