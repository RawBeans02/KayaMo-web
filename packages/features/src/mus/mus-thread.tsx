'use client';

import {
  Check,
  Clock,
  Image as ImageIcon,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  PushPin,
  X,
} from '@phosphor-icons/react';
import { CONTEXT_LIMITS } from '@kayamo/ai';
import type { CocoActionName, CocoActionProposal, MusEntry } from '@kayamo/ai';
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
import {
  HIGH_RISK_CONFIRM_WORD,
  proposalApplyEnabled,
  proposalRiskLabel,
  type ProposalRisk,
} from '@kayamo/ui';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { apiFetch } from '../api/api-origin';
import { BotanicalIcon } from '../botanical/icons';
import { hydrateFoodHistory } from '../food/hydrate-food-history';
import { applyMusProposal } from './apply-proposal';
import {
  readActiveMusConversationId,
  writeActiveMusConversationId,
} from './conversation-session';
import { musReplyFromApi } from './mus-reply';
import { setMusBusy } from './mus-selection';
import {
  musMayWrite,
  permModuleForAction,
  readMusPermLevels,
} from './perm-levels';
import { previewMusProposal } from './proposal-preview';
import { applyCaptureItems } from '../todo/apply-plan';
import {
  imageObservationSchema,
  type CaptureProposal,
} from '../todo/planner-schema';
import styles from '../desk/mus-desk.module.css';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 2_000_000;

/** Lis never writes on its own; nothing here is saved until you confirm. */
const CONFIRM_FOOT = 'Nothing is saved until you confirm.';

const HIGH_RISK: ReadonlySet<CocoActionName> = new Set(['create_goal']);
const LOW_RISK: ReadonlySet<CocoActionName> = new Set(['remember_this']);

function riskFor(action: CocoActionName): ProposalRisk {
  if (HIGH_RISK.has(action)) return 'high';
  if (LOW_RISK.has(action)) return 'low';
  return 'medium';
}

function touchesFor(action: CocoActionName): string[] {
  if (action === 'log_food') return ['Today'];
  if (
    action === 'start_workout' ||
    action === 'add_session_exercise' ||
    action === 'replace_session_exercise' ||
    action === 'skip_session_exercise' ||
    action === 'edit_planned_set' ||
    action === 'schedule_workout'
  ) {
    return ['Gym'];
  }
  if (action === 'create_goal') return ['Goals', 'Todos'];
  if (action === 'remember_this') return ['Lis'];
  return ['Todos'];
}

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

/**
 * One proposal, in the rebrand's card language: eyebrow, title, key/value
 * lines, then confirm or decline. The high-risk confirm word stays — a goal
 * target still needs the word typed before Save is enabled.
 */
function LisProposalCard({
  proposal,
  userId,
  busy,
  primary,
  onConfirm,
  onDismiss,
}: {
  proposal: CocoActionProposal;
  userId: string;
  busy: boolean;
  primary: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const inputId = useId();
  const [diff, setDiff] = useState<{ before: string; after: string } | undefined>();
  const [typed, setTyped] = useState('');

  useEffect(() => {
    void previewMusProposal(userId, proposal).then((next) => {
      if (!next.before && !next.after) {
        setDiff(undefined);
        return;
      }
      setDiff({ before: next.before ?? '—', after: next.after ?? '—' });
    });
  }, [proposal, userId]);

  const risk = riskFor(proposal.action);
  const canApply = proposalApplyEnabled(risk, typed) && !busy;
  const saveLabel = proposal.action === 'log_food' ? 'Save to diary' : 'Save to plan';

  return (
    <article
      className={`${styles.card} kgRise`}
      data-risk={risk}
      aria-label={`${proposalRiskLabel(risk)}: ${proposal.summary}`}
    >
      <p className="kgEyebrow">Proposal</p>
      <h3 className={styles.cardTitle}>{proposal.summary}</h3>
      <ul className={styles.lines}>
        <li className={styles.line}>
          <span>Action</span>
          <span className={styles.lineValue}>{proposal.action.replaceAll('_', ' ')}</span>
        </li>
        <li className={styles.line}>
          <span>Touches</span>
          <span className={styles.lineValue}>{touchesFor(proposal.action).join(' · ')}</span>
        </li>
        {diff ? (
          <>
            <li className={styles.line}>
              <span>Now</span>
              <span className={styles.lineValue}>{diff.before}</span>
            </li>
            <li className={styles.line}>
              <span>After</span>
              <span className={styles.lineValue}>{diff.after}</span>
            </li>
          </>
        ) : null}
        <li className={styles.line}>
          <span>Risk</span>
          <span className={styles.lineValue}>{proposalRiskLabel(risk)}</span>
        </li>
        <li className={styles.line}>
          <span>Source</span>
          <span className={styles.lineValue}>Lis · this conversation</span>
        </li>
      </ul>
      {risk === 'high' ? (
        <div className={styles.confirm}>
          <label className={styles.confirmLabel} htmlFor={inputId}>
            This one changes a target, so it needs the word. Type{' '}
            <span className={styles.confirmWord}>{HIGH_RISK_CONFIRM_WORD}</span>.
          </label>
          <input
            id={inputId}
            className={`${styles.confirmInput} kgField`}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={HIGH_RISK_CONFIRM_WORD}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      ) : null}
      <div className={styles.cardActions}>
        <button
          type="button"
          className={`${styles.apply} ${primary ? 'kgAccent' : 'kgGhost'}`}
          disabled={!canApply}
          onClick={onConfirm}
        >
          {saveLabel}
        </button>
        <button type="button" className="kgGhost" disabled={busy} onClick={onDismiss}>
          Not now
        </button>
      </div>
      <p className={styles.cardFoot}>{CONFIRM_FOOT}</p>
    </article>
  );
}

/** Mirrors CONTEXT_LIMITS on the server; the server clamps again regardless. */
const HISTORY_TURNS = CONTEXT_LIMITS.historyTurns;
const HISTORY_TURN_CHARS = CONTEXT_LIMITS.historyTurnChars;

/**
 * The last few turns, oldest first, as the API expects them. Trimmed here as
 * well as on the server so a long thread does not put a megabyte on the wire
 * for the server to throw away.
 */
function recentHistory(
  messages: readonly { role: string; content: string }[],
): { role: 'user' | 'assistant'; content: string }[] {
  return messages
    .filter(
      (message): message is { role: 'user' | 'assistant'; content: string } =>
        (message.role === 'user' || message.role === 'assistant') &&
        message.content.trim().length > 0,
    )
    .slice(-HISTORY_TURNS)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, HISTORY_TURN_CHARS),
    }));
}

export function MusThread({
  userId,
  logicalDate,
  recommended,
  compact = false,
  chrome,
  entry,
  unavailableMessage,
  headingLevel = 2,
}: {
  userId: string;
  logicalDate: string;
  recommended: string | null;
  compact?: boolean;
  chrome?: 'full' | 'rail' | 'page';
  entry?: MusEntry;
  unavailableMessage?: string;
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
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
    el.style.height = `${Math.min(el.scrollHeight, 108)}px`;
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
        const created = await createLocalCocoConversation({ userId, title: `Lis · ${logicalDate}` });
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
    const created = await createLocalCocoConversation({ userId, title: `Lis · ${logicalDate}` });
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
        ? `Your confirmed next action is “${recommended}.” We can make it smaller. I won’t change it without you.`
        : 'We can name one small next action together. Nothing is saved until you confirm it.';
      let source: LocalCocoMessage['response_source'] = 'fallback';
      let nextProposals: CocoActionProposal[] = [];
      // A capability or reachability message is status, not something Lis
      // says. It renders once, as the muted note under the thread — never
      // also as a bubble, which is what used to happen.
      let statusOnly = false;
      try {
        const response = await apiFetch('/api/mus/respond', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            mode: 'chat',
            message: outbound,
            logicalDate,
            // The tail of the thread this device already holds. Without it every
            // turn was stateless and Lis could not resolve "that one" or "no,
            // tomorrow" — the single largest reason it read as a machine. The
            // server clamps count and length; this is the UX input, not an
            // authority, and safety still reads only the newest message.
            history: recentHistory(messages),
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
        } else {
          statusOnly = true;
          setProposalNote(
            response.status === 429
              ? 'Your AI request allowance is used for today. Manual tracking still works.'
              : 'Lis is temporarily unavailable. Please try again later; your message is saved locally.',
          );
        }
      } catch {
        statusOnly = true;
        setProposalNote(
          userId.startsWith('guest-')
            ? 'Lis is not available in the local demo. Sign in to use it.'
            : 'Could not reach Lis. Your message is saved locally; please try again when connected.',
        );
      }
      if (!statusOnly) {
        const lis = await appendLocalCocoMessage({
          userId,
          conversationId,
          role: 'assistant',
          content: reply,
          responseSource: source,
        });
        setMessages((current) => [...current, lis]);
      }
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
      setProposalNote('Lis cannot write this while that module is at read or never.');
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
      setProposalNote('Lis cannot write this while that module is at read or never.');
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

  // A composer that accepts keystrokes it intends to throw away is the worst of
  // both: in the demo, typing and pressing Enter cleared the field and gave no
  // sign anything had happened.
  const composerUnavailable = Boolean(unavailableMessage);
  const canSend =
    Boolean(text.trim() || pendingImage) &&
    !busy &&
    !composerUnavailable &&
    Boolean(conversationId);
  const filteredConversations = conversations.filter((row) => {
    const q = historyQuery.trim().toLowerCase();
    if (!q) return true;
    return (row.title ?? 'Untitled').toLowerCase().includes(q);
  });

  const composerId = layout === 'rail' ? 'mus-message-rail' : layout === 'page' ? 'mus-message-page' : 'mus-message';
  const showHeader = layout !== 'rail';
  const showHistoryOverlay = layout !== 'page' && layout !== 'rail' && historyOpen;
  const showPageList = layout === 'page';
  const singleProposal = proposals.length === 1;

  const conversationList = (
    <div
      className={showPageList ? styles.list : `${styles.panel} kgSurface`}
      role={showPageList ? 'navigation' : 'dialog'}
      aria-label="Conversations"
    >
      <div className={styles.listHead}>
        {showPageList ? <p className={`${styles.listEyebrow} kgEyebrow`}>Conversations</p> : null}
        {showPageList ? null : (
          <label className={styles.search}>
            <MagnifyingGlass size={16} aria-hidden="true" />
            <input
              value={historyQuery}
              onChange={(event) => setHistoryQuery(event.target.value)}
              placeholder="Search conversations"
              autoComplete="off"
            />
          </label>
        )}
        <button type="button" className={styles.listNew} onClick={() => void startNewConversation()}>
          {showPageList ? 'New conversation' : <><Plus size={15} aria-hidden="true" /> New</>}
        </button>
        {showPageList ? null : (
          <button type="button" className={styles.rowGhost} onClick={() => setHistoryOpen(false)} aria-label="Close history">
            <X size={15} aria-hidden="true" />
          </button>
        )}
      </div>
      <ul className={styles.rows}>
        {filteredConversations.length === 0 ? (
          <li className={styles.empty}>No conversations yet.</li>
        ) : (
          filteredConversations.map((row) => (
            <li key={row.id} className={styles.row} data-active={row.id === conversationId ? 'true' : undefined}>
              {renamingId === row.id ? (
                <input
                  className={styles.rename}
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
                <button type="button" className={styles.open} onClick={() => selectConversation(row.id)}>
                  <strong>{row.title?.trim() || 'Untitled'}</strong>
                  <small>{row.updated_at.slice(0, 10)}</small>
                </button>
              )}
              <button
                type="button"
                className={styles.rowGhost}
                aria-label="Rename conversation"
                onClick={() => {
                  setRenamingId(row.id);
                  setRenameDraft(row.title ?? '');
                }}
              >
                <PencilSimple size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.rowGhost}
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
      className={styles.thread}
      aria-labelledby="mus-chat-title"
      data-mus-thread={layout}
    >
      {showPageList ? conversationList : null}
      {showHeader ? (
        <header className={styles.header}>
          {/* Lis is a sparkle in an accent circle — never a character. */}
          <span className={styles.mark} aria-hidden="true">
            <BotanicalIcon name="lis" size={18} weight="fill" />
          </span>
          <div className={styles.identity}>
            <Heading id="mus-chat-title" className={styles.name}>
              Lis
            </Heading>
            <p className={styles.tagline}>{unavailableMessage ?? 'Proposes · you confirm'}</p>
          </div>
          {layout === 'page' ? (
            <span className={styles.headState}>{busy ? 'Thinking…' : 'Ready'}</span>
          ) : (
            <button
              className={styles.iconButton}
              type="button"
              aria-label="Conversation history"
              aria-expanded={historyOpen}
              onClick={() => {
                setHistoryOpen((open) => !open);
                void reloadConversations();
              }}
            >
              <Clock size={19} aria-hidden="true" />
            </button>
          )}
        </header>
      ) : (
        <h2 id="mus-chat-title" className={styles.srOnly}>
          Lis
        </h2>
      )}
      {showHistoryOverlay ? conversationList : null}
      <div className={`${styles.log} kgSurface`} aria-live="polite">
        {messages.length === 0 ? (
          <div className={styles.bubbleLis}>
            Tell me what you ate or did. I’ll propose an entry and wait for your yes.
          </div>
        ) : null}
        {messages.map((message) =>
          message.role === 'user' ? (
            <div key={message.id} className={`${styles.bubbleUser} kgRise`}>
              {message.content}
            </div>
          ) : (
            <div key={message.id} className={`${styles.group} kgRise`}>
              <div className={styles.bubbleLis}>{message.content}</div>
              {recommended ? (
                <p className={styles.source}>
                  <Clock size={13} aria-hidden="true" /> From your confirmed plan for today.
                </p>
              ) : null}
              <button
                className={styles.remember}
                type="button"
                onClick={() => void rememberMessage(message)}
                disabled={rememberedMessageId === message.id}
              >
                {rememberedMessageId === message.id ? (
                  <Check size={15} aria-hidden="true" />
                ) : (
                  <PushPin size={15} aria-hidden="true" />
                )}{' '}
                {rememberedMessageId === message.id ? 'Remembered' : 'Remember this'}
              </button>
            </div>
          ),
        )}
        {capture ? (
          <article className={`${styles.card} kgRise`} aria-label="Brain dump proposal">
            <p className="kgEyebrow">Brain dump</p>
            <h3 className={styles.cardTitle}>{capture.items.map((item) => item.title).join(', ')}</h3>
            <ul className={styles.lines}>
              <li className={styles.line}>
                <span>Items</span>
                <span className={styles.lineValue}>{capture.items.length}</span>
              </li>
              {capture.questions.length > 0 ? (
                <li className={styles.line}>
                  <span>Open questions</span>
                  <span className={styles.lineValue}>{capture.questions.join(' ')}</span>
                </li>
              ) : null}
              <li className={styles.line}>
                <span>Source</span>
                <span className={styles.lineValue}>Lis · this conversation</span>
              </li>
            </ul>
            <div className={styles.cardActions}>
              <button
                type="button"
                className={`${styles.apply} kgAccent`}
                disabled={busy}
                onClick={() => void confirmCapture()}
              >
                Save to plan
              </button>
              <button type="button" className="kgGhost" disabled={busy} onClick={() => setCapture(null)}>
                Not now
              </button>
            </div>
            <p className={styles.cardFoot}>{CONFIRM_FOOT}</p>
          </article>
        ) : null}
        {proposals.length > 1 ? (
          <article className={`${styles.card} kgRise`} aria-label="Several proposals">
            <p className="kgEyebrow">Several changes</p>
            <h3 className={styles.cardTitle}>Lis proposes {proposals.length} changes.</h3>
            <div className={styles.cardActions}>
              <button
                type="button"
                className={`${styles.apply} kgAccent`}
                disabled={busy}
                onClick={() => void confirmAllProposals()}
              >
                Save all
              </button>
            </div>
            <p className={styles.cardFoot}>Review each one below. {CONFIRM_FOOT}</p>
          </article>
        ) : null}
        {proposals.map((proposal) => (
          <LisProposalCard
            key={proposal.proposalId}
            proposal={proposal}
            userId={userId}
            busy={busy}
            primary={singleProposal}
            onConfirm={() => void confirmProposal(proposal)}
            onDismiss={() =>
              setProposals((current) => current.filter((row) => row.proposalId !== proposal.proposalId))
            }
          />
        ))}
        {proposalNote ? (
          <p className={styles.note} role="status">
            {proposalNote}
          </p>
        ) : null}
        {busy ? <div className={`${styles.bubbleLis} kgRise`}>Thinking…</div> : null}
      </div>
      <form className={`${styles.composer} kgPanelStrong`} onSubmit={send}>
        {pendingImage ? (
          <p className={styles.pending}>
            {pendingImage.name}
            <button type="button" onClick={() => setPendingImage(null)}>
              Remove
            </button>
          </p>
        ) : null}
        <label className={styles.srOnly} htmlFor={composerId}>
          Message Lis. Enter sends. Shift+Enter starts a new line.
        </label>
        <input
          ref={fileRef}
          className={styles.srOnly}
          type="file"
          aria-label="Choose a photo for Lis"
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
          className={styles.attach}
          disabled={busy || composerUnavailable}
          aria-label="Attach a photo"
          onClick={() => fileRef.current?.click()}
        >
          <ImageIcon size={20} aria-hidden="true" />
        </button>
        <textarea
          id={composerId}
          ref={composerRef}
          rows={1}
          value={text}
          disabled={composerUnavailable}
          // The server rejects anything longer; stop it at the field rather
          // than spending one of five daily requests on a 400.
          maxLength={5000}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }}
          placeholder={unavailableMessage ?? 'Tell Lis what you ate or did…'}
        />
        <button type="submit" className={styles.send} disabled={!canSend} aria-label="Send message">
          <BotanicalIcon name="send" size={18} weight="bold" />
        </button>
      </form>
      {layout === 'full' ? (
        <p className={styles.privacy}>Lis proposes. You confirm every write.</p>
      ) : null}
    </div>
  );
}
