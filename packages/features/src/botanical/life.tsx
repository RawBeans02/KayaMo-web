'use client';
import { BotanicalIcon } from './icons';
import styles from './botanical.module.css';

export function BotanicalLife() {
  return (
    <section className={styles.page} aria-labelledby="life-title">
      <header className={styles.header}>
        <div>
          <h1 id="life-title">Life</h1>
          <p>Care for the parts of life that matter to you.</p>
        </div>
      </header>
      <div className={styles.cards}>
        <section className={styles.panel}>
          <h2>Physical Self</h2>
          <p className={styles.muted}>
            Food, movement, and the records you choose to keep.
          </p>
          <a className={styles.tool} href="/calories">
            <BotanicalIcon name="food" />
            <span>Food diary</span>
            <BotanicalIcon name="next" />
          </a>
          <a className={styles.tool} href="/gym">
            <BotanicalIcon name="workout" />
            <span>Workouts</span>
            <BotanicalIcon name="next" />
          </a>
          <a className={styles.tool} href="/foods">
            <BotanicalIcon name="book" />
            <span>Food catalog</span>
            <BotanicalIcon name="next" />
          </a>
          <a className={styles.tool} href="/verify">
            <BotanicalIcon name="tasks" />
            <span>Food verification</span>
            <BotanicalIcon name="next" />
          </a>
        </section>
        <section className={styles.panel}>
          <h2>Your wider life</h2>
          <p className={styles.muted}>
            Dedicated tools for other life areas are not available on the website yet. You
            can still create goals for study, work, relationships, faith, or anything
            meaningful to you.
          </p>
          <div className={styles.actions}>
            <a href="/goals" className={styles.secondary}>
              Explore your goals
              <BotanicalIcon name="arrow" size={18} />
            </a>
          </div>
          <p className={styles.muted} style={{ marginTop: 28 }}>
            Circles are deferred for this web release.
          </p>
        </section>
      </div>
    </section>
  );
}
