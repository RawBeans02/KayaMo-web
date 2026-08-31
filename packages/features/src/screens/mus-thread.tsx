'use client';

import { Check, Clock, Image as ImageIcon, PaperPlaneTilt, PushPin } from '@phosphor-icons/react';
import type { CocoActionProposal, MusEntry } from '@kayamo/ai';
import { createBrowserSupabase } from '@kayamo/db';
import {
  appendLocalCocoMessage,
  createLocalAgentMemory,
  createLocalCocoConversation,
  listLocalCocoMessages,
  type LocalCocoMessage,
} from '@kayamo/offline';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { apiFetch } from '../api/api-origin';
import { hydrateFoodHistory } from '../food/hydrate-food-history';
import { applyMusProposal } from '../mus/apply-proposal';
import { musReplyFromApi } from '../mus/mus-reply';
import { applyCaptureItems } from '../todo/apply-plan';
import {
  imageObservationSchema,
  type CaptureProposal,
} from '../todo/planner-schema';
import styles from './kayamo-app.module.css';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 2_000_000;

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
  entry,
}: {
  userId: string;
  logicalDate: string;
  recommended: string | null;
  compact?: boolean;
  entry?: MusEntry;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
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

  useEffect(() => {
    if (conversationId) return;
    void createLocalCocoConversation({ userId, title: `Mus · ${logicalDate}` }).then((conversation) => {
      setConversationId(conversation.id);
      setMessages([]);
    });
  }, [conversationId, logicalDate, userId]);

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

  async function confirmProposal(proposal: CocoActionProposal) {
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
    void listLocalCocoMessages(userId, conversationId).then(setMessages);
  }, [conversationId, userId]);

  const canSend = Boolean(text.trim() || pendingImage) && !busy;

  return (
    <div
      className={`${styles.screen} ${styles.musScreen} ${compact ? styles.musCompact : ''}`}
      aria-labelledby="mus-chat-title"
    >
      <header className={styles.chatHeader}>
        <img src="/coco-seed.png" alt="" width={48} height={48} />
        <div><h2 id="mus-chat-title">Mus</h2><p>tone · balanced · adapts to the moment</p></div>
        <button className={styles.chatHistoryButton} type="button" aria-label="Conversation history"><Clock size={19} /></button>
      </header>
      <div className={styles.chatMessages} aria-live="polite">
        {messages.length === 0 ? <div className={styles.cocoBubble}>I’m with you. We can talk, reflect, or choose one realistic next step.</div> : null}
        {messages.map((message) => message.role === 'user' ? (
          <div key={message.id} className={styles.userBubble}>{message.content}</div>
        ) : (
          <div key={message.id} className={styles.cocoMessageGroup}>
            <div className={styles.cocoBubble}>{message.content}</div>
            {recommended ? <p className={styles.chatSource}><Clock size={13} /> From your confirmed plan for today.</p> : null}
            <button className={styles.rememberButton} type="button" onClick={() => void rememberMessage(message)} disabled={rememberedMessageId === message.id}>
              {rememberedMessageId === message.id ? <Check size={15} /> : <PushPin size={15} />} {rememberedMessageId === message.id ? 'Remembered' : 'Remember this'}
            </button>
          </div>
        ))}
        {capture ? (
          <div className={styles.cocoMessageGroup}>
            <div className={styles.workingToward}>
              <span>
                <b>brain dump</b>
                <strong>
                  {capture.items.map((item) => item.title).join(', ')}
                </strong>
                <small>Nothing is saved until you confirm.</small>
                {capture.questions.length > 0 ? (
                  <small>{capture.questions.join(' ')}</small>
                ) : null}
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
            {proposals.map((proposal) => (
              <div key={proposal.proposalId} className={styles.workingToward}>
                <span>
                  <b>{proposal.action.replaceAll('_', ' ')}</b>
                  <strong>{proposal.summary}</strong>
                  <small>Nothing is saved until you confirm.</small>
                </span>
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={busy}
                  onClick={() => void confirmProposal(proposal)}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={busy}
                  onClick={() =>
                    setProposals((current) =>
                      current.filter((row) => row.proposalId !== proposal.proposalId),
                    )
                  }
                >
                  Dismiss
                </button>
              </div>
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
        <label className={styles.srOnly} htmlFor={compact ? 'mus-message-dash' : 'mus-message'}>
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
          id={compact ? 'mus-message-dash' : 'mus-message'}
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
      <p className={styles.chatPrivacy}>Mus proposes. You confirm every write.</p>
    </div>
  );
}