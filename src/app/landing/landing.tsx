import Link from 'next/link';
import { ThemeToggle } from '@/shell/theme-toggle';
import { BotanicalIcon } from '@kayamo/features/icons';
import { StartDemo } from './start-demo';
import { LEGAL_ROUTES } from '@/lib/legal';
import styles from './landing.module.css';

/**
 * kayamo.fit — Liquid Glass hero.
 *
 * A centred glass nav pill over the app's own backdrop wash, one 76px
 * headline, one primary action (the no-account demo) and three glass
 * feature cards. Lis appears here by name and sparkle icon; her face renders
 * on the Lis surface in the app.
 */
export function Landing({ demoStarted = false }: { demoStarted?: boolean }) {
  return (
    <main className={styles.page} id="main-content">
      <header className={styles.navRow}>
        <nav
          className={`${styles.navPill} kgPanelStrong kgFloat`}
          aria-label="Main navigation"
        >
          <Link className={styles.brandRow} href="/" aria-label="KayaMo home">
            <span className={styles.brandMark} aria-hidden="true" />
            <span className={styles.brand}>KayaMo</span>
          </Link>
          <span className={styles.navLinks}>
            <a className={styles.navLink} href="#how-it-works">
              How it works
            </a>
            <a className={styles.navLink} href="#lis">
              Lis
            </a>
            <a className={styles.navLink} href="#questions">
              Questions
            </a>
          </span>
          <span className={styles.navActions}>
            <ThemeToggle />
            <StartDemo variant="nav">
              {demoStarted ? 'Continue' : 'Try it free'}
            </StartDemo>
          </span>
        </nav>
      </header>

      <section className={styles.hero} aria-labelledby="landing-title">
        <h1 className={styles.heroTitle} id="landing-title">
          One place for the day you meant to have.
        </h1>
        <p className={styles.heroLede}>
          Plan, meals, and movement in a single glanceable view. Lis keeps the plan
          honest; you keep the day.
        </p>
        <div className={styles.heroCtas}>
          <StartDemo>{demoStarted ? 'Continue your demo' : 'Explore the demo'}</StartDemo>
          <Link className={`kgGhost ${styles.heroSecondary}`} href="/login">
            Sign in
            <BotanicalIcon name="arrow" size={18} />
          </Link>
        </div>
        <p className={styles.heroNote}>
          Runs in your browser. No account needed. Demo entries stay on this device.
        </p>
      </section>

      <section className={styles.claims} aria-label="What KayaMo does">
        <div className={`${styles.claimLead} kgSurface`} id="lis">
          <p className={styles.claimTitle}>Lis proposes. You confirm.</p>
          <p className={styles.claimBody}>
            Say what you ate or did in plain words. Lis drafts the entry and shows where
            the numbers came from. Nothing reaches your diary until you say yes.
          </p>
        </div>
        <dl className={styles.claimList}>
          <div>
            <dt>One plan</dt>
            <dd>
              Tasks, meals and workouts on a single timeline, with the next step as the
              largest thing on screen.
            </dd>
          </div>
          <div>
            <dt>Yours, offline too</dt>
            <dd>
              Every entry is written to your device first and syncs when you are back
              online. Your diary is readable without a connection.
            </dd>
          </div>
        </dl>
      </section>

      <section className={styles.how} id="how-it-works" aria-labelledby="how-title">
        <div className={styles.sectionHeading}>
          <p className={`kgEyebrow ${styles.eyebrow}`}>Small steps. Your pace.</p>
          <h2 id="how-title">A simple rhythm for everyday growth.</h2>
        </div>
        <ol className={styles.steps}>
          <li className={styles.step}>
            <span className={styles.stepNum} aria-hidden="true">
              01
            </span>
            <div>
              <h3>Choose what matters today.</h3>
              <p>
                Capture a task, see your schedule, and make a little progress on a goal.
                The full planner is there when your day needs more detail.
              </p>
            </div>
          </li>
          <li className={styles.step}>
            <span className={styles.stepNum} aria-hidden="true">
              02
            </span>
            <div>
              <h3>Keep your everyday close.</h3>
              <p>
                Log meals with editable portions and visible nutrition sources. Continue a
                workout and keep a clear record of what you did.
              </p>
            </div>
          </li>
          <li className={styles.step}>
            <span className={styles.stepNum} aria-hidden="true">
              03
            </span>
            <div>
              <h3>See the steps add up.</h3>
              <p>
                Your Grove holds confirmed progress. Ask Lis for help when you want it.
                Suggestions become changes only after you confirm.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className={styles.closer} aria-labelledby="demo-title">
        <div className={styles.closerLead}>
          <p className={`kgEyebrow ${styles.eyebrow}`}>One day at a time</p>
          <h2 id="demo-title">Start with one small step.</h2>
          <p>Try a daily plan, create a goal, or log a meal. Explore at your own pace.</p>
          <StartDemo variant="ghost">Start the demo</StartDemo>
        </div>
        <div className={`${styles.faq} kgSurface`} id="questions">
          <details>
            <summary>What happens to my demo entries?</summary>
            <p>
              They are stored in this browser. Clearing browser data removes them. Signing
              in does not transfer demo entries to an account.
            </p>
          </details>
          <details>
            <summary>Does Lis see everything I save?</summary>
            <p>
              No. You control access to food and workouts, goals and planning, saved
              memories, and faith context. AI requires an account and is subject to
              availability and request allowances.
            </p>
          </details>
          <details>
            <summary>How do I sign in?</summary>
            <p>
              Use your email to request a sign-in link. No password is needed.{' '}
              <Link href="/login">Go to sign in</Link>.
            </p>
          </details>
        </div>
      </section>

      <footer className={styles.foot}>
        <span className={styles.brand}>KayaMo</span>
        <span>Personal growth, on your terms.</span>
        <nav className={styles.footLinks} aria-label="Legal">
          {LEGAL_ROUTES.map((route) => (
            <Link key={route.href} href={route.href}>
              {route.label}
            </Link>
          ))}
          <Link href="/login">Sign in</Link>
        </nav>
      </footer>
    </main>
  );
}
