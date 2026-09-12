import Image from 'next/image';
import Link from 'next/link';
import { ThemeToggle } from '@/shell/theme-toggle';
import { BotanicalIcon } from '@kayamo/features/desktop';
import { StartDemo } from './start-demo';
import styles from './landing.module.css';

export function Landing({ demoStarted = false }: { demoStarted?: boolean }) {
  return (
    <main className={styles.page} id="main-content">
      <header className={styles.nav}>
        <Link className={styles.brandRow} href="/" aria-label="KayaMo home">
          <Image src="/botanical/seed-mark.webp" alt="" width={38} height={38} />
          <span className={styles.brand}>KayaMo</span>
        </Link>
        <nav className={styles.navLinks} aria-label="Main navigation">
          <ThemeToggle />
          <a className={styles.aboutLink} href="#how-it-works">
            How it works
          </a>
          <Link className={styles.navSignIn} href="/login">
            Sign in
          </Link>
        </nav>
      </header>
      <section className={styles.hero} aria-labelledby="landing-title">
        <div>
          <p className={styles.eyebrow}>A little room to grow</p>
          <h1 className={styles.heroTitle} id="landing-title">
            A calmer day.
            <br />A step toward you.
          </h1>
          <p className={styles.heroLede}>
            Bring your daily plan, meaningful goals, food, and movement into one quiet
            space. Start small. Keep what matters.
          </p>
          <div className={styles.heroCtas}>
            <StartDemo>
              {demoStarted ? 'Continue your demo' : 'Explore the demo'}
            </StartDemo>
            <Link className={styles.textLink} href="/login">
              Already here? Sign in
              <BotanicalIcon name="arrow" size={18} />
            </Link>
          </div>
          <p className={styles.heroNote}>
            No account needed. Demo entries stay in this browser.
          </p>
          <ul className={styles.tags} aria-label="Product highlights">
            <li>Daily steps</li>
            <li>Personal goals</li>
            <li>Food & movement</li>
          </ul>
        </div>
        <div className={styles.product}>
          <Image
            src="/botanical/mus-neutral.webp"
            width={300}
            height={300}
            alt="Mus, KayaMo’s seed companion"
            className={styles.heroMus}
            priority
          />
          <p className={styles.musNote}>
            <strong>Meet Mus.</strong> A companion for thinking things through.
            <br />
            You choose what to share—and what to do next.
          </p>
        </div>
      </section>
      <figure className={styles.preview}>
        <figcaption>
          <strong>Your day, with room to breathe.</strong>
          <span>
            A real Home screen with illustrative tasks. Your own space starts with your
            records.
          </span>
        </figcaption>
        <Image
          src="/botanical/home-preview.webp"
          alt="KayaMo Home: a daily timeline, priorities, and quick access to food and workouts"
          width={1440}
          height={1024}
          sizes="(max-width: 960px) 100vw, 1248px"
        />
      </figure>
      <section className={styles.how} id="how-it-works" aria-labelledby="how-title">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Small steps. Your pace.</p>
          <h2 id="how-title">A simple rhythm for everyday growth.</h2>
        </div>
        <div className={styles.points}>
          <article>
            <span className={styles.step}>01 / PLAN</span>
            <h3>Choose what matters today.</h3>
            <p>
              Capture a task, see your schedule, and make a little progress on a goal. The
              full planner is there when your day needs more detail.
            </p>
          </article>
          <article>
            <span className={styles.step}>02 / CARE</span>
            <h3>Keep your everyday close.</h3>
            <p>
              Log food with familiar Filipino portions and visible sources. Continue a
              workout and keep a clear record of what you did.
            </p>
          </article>
          <article>
            <span className={styles.step}>03 / REFLECT</span>
            <h3>See the steps add up.</h3>
            <p>
              Your Grove holds confirmed progress. Ask Mus for help when you want it.
              Suggestions become changes only after you confirm.
            </p>
          </article>
        </div>
      </section>
      <section className={styles.closer} aria-labelledby="demo-title">
        <div>
          <p className={styles.eyebrow}>Kaya mo. One day at a time.</p>
          <h2 id="demo-title">Start with one small step.</h2>
          <p>Try a daily plan, create a goal, or log a meal. Explore at your own pace.</p>
          <StartDemo>Try KayaMo without an account</StartDemo>
        </div>
        <div className={styles.faq}>
          <details>
            <summary>What happens to my demo entries?</summary>
            <p>
              They are stored in this browser. Clearing browser data removes them. Signing
              in does not transfer demo entries to an account.
            </p>
          </details>
          <details>
            <summary>Does Mus see everything I save?</summary>
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
        <span>Made for the everyday. Made for the Philippines.</span>
        <Link href="/login">Sign in</Link>
      </footer>
    </main>
  );
}
