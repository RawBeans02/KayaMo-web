'use client';

import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { LoginForm } from './login-form';
import { LoginTheme } from './login-theme';
import styles from './login.module.css';

export function LoginView() {
  const params = useSearchParams();
  const sent = params.get('sent') === '1';
  const setup = params.get('setup') === '1';
  const error = params.get('error');

  return (
    <main className={styles.viewport}>
      <LoginTheme />
      <div className={styles.atmosphere} aria-hidden="true" />
      <div className={styles.shell}>
        <section className={styles.hero} aria-label="KayaMo">
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.heroCopy}>
            <p className={styles.wordmark}>KayaMo</p>
            <h1>Pasok muna.</h1>
            <p>Magic link only. After you sign in, ⌘K logs a known food without touching the mouse.</p>
          </div>
          <Image
            className={styles.mus}
            src="/mus-neutral.png"
            alt="Mus"
            width={196}
            height={196}
            priority
          />
        </section>
        <div className={styles.form}>
          <LoginForm sent={sent} setup={setup} error={error} />
        </div>
      </div>
    </main>
  );
}
