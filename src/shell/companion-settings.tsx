'use client';

import { useEffect, useId, useState } from 'react';
import styles from './settings.module.css';

/**
 * How Lis speaks to you.
 *
 * Deliberately not behind a permission toggle: this holds no life data, and
 * typing it is the consent. A user who never opens this screen has no row and
 * gets an impersonal Lis — which is why every field here is optional and the
 * empty state says nothing rather than nagging.
 */

const REGISTERS = [
  { value: 'match_me', label: 'Match me' },
  { value: 'english', label: 'English' },
  { value: 'taglish', label: 'Taglish' },
] as const;

/** Index is the stored smallint. See migration 0021. */
const DIALS = [
  {
    key: 'encouragement',
    label: 'Encouragement',
    scale: ['Sparing', 'Balanced', 'Generous'],
  },
  {
    key: 'accountability',
    label: 'Accountability',
    scale: ['Gentle', 'Balanced', 'Firm'],
  },
  { key: 'humor', label: 'Humour', scale: ['Serious', 'Balanced', 'Playful'] },
  {
    key: 'proactivity',
    label: 'Proactivity',
    scale: ['Quiet', 'Balanced', 'Proactive'],
  },
] as const;

type DialKey = (typeof DIALS)[number]['key'];

type Profile = {
  displayName: string;
  pronouns: string;
  languageRegister: (typeof REGISTERS)[number]['value'];
  aboutMe: string;
  avoidTopics: string;
} & Record<DialKey, number>;

const EMPTY: Profile = {
  displayName: '',
  pronouns: '',
  languageRegister: 'match_me',
  aboutMe: '',
  avoidTopics: '',
  encouragement: 1,
  accountability: 1,
  humor: 1,
  proactivity: 1,
};

export function CompanionSettings() {
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'error'>(
    'loading',
  );
  const [note, setNote] = useState<string | null>(null);
  const nameId = useId();
  const pronounsId = useId();
  const aboutId = useId();
  const avoidId = useId();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/mus/profile');
        if (!response.ok) throw new Error('unavailable');
        const body = (await response.json()) as { profile: Record<string, unknown> | null };
        if (cancelled) return;
        const row = body.profile;
        if (row) {
          setProfile({
            displayName: String(row.display_name ?? ''),
            pronouns: String(row.pronouns ?? ''),
            languageRegister:
              (row.language_register as Profile['languageRegister']) ?? 'match_me',
            aboutMe: String(row.about_me ?? ''),
            avoidTopics: Array.isArray(row.avoid_topics)
              ? (row.avoid_topics as string[]).join(', ')
              : '',
            encouragement: Number(row.encouragement ?? 1),
            accountability: Number(row.accountability ?? 1),
            humor: Number(row.humor ?? 1),
            proactivity: Number(row.proactivity ?? 1),
          });
        }
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setState('saving');
    setNote(null);
    try {
      const response = await fetch('/api/mus/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          displayName: profile.displayName.trim() || null,
          pronouns: profile.pronouns.trim() || null,
          languageRegister: profile.languageRegister,
          encouragement: profile.encouragement,
          accountability: profile.accountability,
          humor: profile.humor,
          proactivity: profile.proactivity,
          aboutMe: profile.aboutMe.trim() || null,
          avoidTopics: profile.avoidTopics
            .split(',')
            .map((topic) => topic.trim())
            .filter(Boolean)
            .slice(0, 10),
        }),
      });
      if (!response.ok) throw new Error('save failed');
      setState('ready');
      setNote('Saved. Lis will speak this way from your next message.');
    } catch {
      setState('ready');
      setNote('Could not save that. Nothing changed.');
    }
  }

  if (state === 'error') {
    return (
      <p className={styles.rowNote}>
        Companion settings are unavailable right now. Lis still works.
      </p>
    );
  }

  return (
    <div className={styles.companion}>
      <div className={styles.companionRow}>
        <label htmlFor={nameId}>What should Lis call you?</label>
        <input
          id={nameId}
          value={profile.displayName}
          maxLength={40}
          placeholder="Your name"
          autoComplete="given-name"
          onChange={(event) =>
            setProfile((p) => ({ ...p, displayName: event.target.value }))
          }
        />
      </div>

      <div className={styles.companionRow}>
        <label htmlFor={pronounsId}>Pronouns</label>
        <input
          id={pronounsId}
          value={profile.pronouns}
          maxLength={24}
          placeholder="they/them"
          onChange={(event) =>
            setProfile((p) => ({ ...p, pronouns: event.target.value }))
          }
        />
      </div>

      <fieldset className={styles.companionGroup}>
        <legend>Language</legend>
        {REGISTERS.map((register) => (
          <label key={register.value} className={styles.companionChoice}>
            <input
              type="radio"
              name="language-register"
              value={register.value}
              checked={profile.languageRegister === register.value}
              onChange={() =>
                setProfile((p) => ({ ...p, languageRegister: register.value }))
              }
            />
            {register.label}
          </label>
        ))}
      </fieldset>

      {DIALS.map((dial) => (
        <fieldset key={dial.key} className={styles.companionGroup}>
          <legend>{dial.label}</legend>
          {dial.scale.map((label, index) => (
            <label key={label} className={styles.companionChoice}>
              <input
                type="radio"
                name={dial.key}
                value={index}
                checked={profile[dial.key] === index}
                onChange={() => setProfile((p) => ({ ...p, [dial.key]: index }))}
              />
              {label}
            </label>
          ))}
        </fieldset>
      ))}

      <div className={styles.companionRow}>
        <label htmlFor={aboutId}>Anything Lis should know about you</label>
        <textarea
          id={aboutId}
          rows={3}
          value={profile.aboutMe}
          maxLength={600}
          placeholder="I train early and I hate being nagged."
          onChange={(event) =>
            setProfile((p) => ({ ...p, aboutMe: event.target.value }))
          }
        />
      </div>

      <div className={styles.companionRow}>
        <label htmlFor={avoidId}>Do not bring these up unless I do</label>
        <input
          id={avoidId}
          value={profile.avoidTopics}
          placeholder="weight, family"
          onChange={(event) =>
            setProfile((p) => ({ ...p, avoidTopics: event.target.value }))
          }
        />
        <small className={styles.rowNote}>Separate with commas. Up to ten.</small>
      </div>

      <button
        type="button"
        className="kgAccent"
        disabled={state !== 'ready'}
        onClick={() => void save()}
      >
        {state === 'saving' ? 'Saving…' : 'Save'}
      </button>

      {note ? (
        <p role="status" className={styles.rowNote}>
          {note}
        </p>
      ) : null}
    </div>
  );
}
