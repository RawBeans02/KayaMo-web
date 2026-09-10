import Image from 'next/image';
import Link from 'next/link';
import { ThemeToggle } from '@/shell/theme-toggle';
import { StartDemo } from './start-demo';
import styles from './landing.module.css';

export function Landing({ demoStarted = false }: { demoStarted?: boolean }) {
  return (
    <main className={styles.page} id="main-content">
      <header className={styles.nav}>
        <Link className={styles.brandRow} href="/" aria-label="KayaMo home">
          <Image
            src="/mus-neutral.webp"
            alt=""
            width={38}
            height={38}
            className={styles.brandMark}
          />
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
          <p className={styles.eyebrow}>Made for your everyday · Philippines</p>
          <h1 className={styles.heroTitle} id="landing-title">
            The tracker that already knows kanin.
          </h1>
          <p className={styles.heroLede}>
            Food you actually eat. Portions you actually use. Keep your meals and training
            in one place, with Filipino foods and the source behind the numbers.
          </p>
          <div className={styles.heroCtas}>
            <StartDemo>{demoStarted ? 'Continue your demo' : 'Explore the demo'}</StartDemo>
            <Link className={styles.textLink} href="/login">
              Already here? Sign in <span aria-hidden="true">→</span>
            </Link>
          </div>
          <p className={styles.heroNote}>
            No account needed. Demo entries stay in this browser.
          </p>
          <ul className={styles.tags} aria-label="Product highlights">
            <li>Filipino food catalog</li>
            <li>tasa · piraso · serving</li>
            <li>Keyboard-friendly logging</li>
          </ul>
        </div>
        <div className={styles.product}>
          <figure className={styles.heroPanel}>
            <figcaption className={styles.panelHead}>
              <span className={styles.eyebrow}>A little look inside</span>
              <span className={styles.exampleBadge}>Sample meal</span>
            </figcaption>
            <div className={styles.mealTitle}>
              Kanin at adobo.<span>A familiar lunch, a clear record.</span>
            </div>
            <table className={styles.mealTable}>
              <caption className={styles.srOnly}>
                Illustrative meal with recipe-based calorie estimates
              </caption>
              <thead className={styles.srOnly}>
                <tr>
                  <th scope="col">Food and portion</th>
                  <th scope="col">Calories</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">
                    Kanin <span>2 tasa · 400 g</span>
                  </th>
                  <td>
                    520 <small>kcal</small>
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    Chicken adobo <span>1 serving · 150 g</span>
                  </th>
                  <td>
                    285 <small>kcal</small>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">
                    This meal <span>2 items</span>
                  </th>
                  <td>
                    805 <small>kcal</small>
                  </td>
                </tr>
              </tfoot>
            </table>
            <p className={styles.panelFoot}>
              Recipe-based estimates. Portions and preparation can change the numbers.
            </p>
          </figure>
          <div className={styles.companion}>
            <p>
              <strong>Meet Mus, your companion.</strong>A little encouragement for the
              everyday.
            </p>
            <Image
              src="/mus-neutral.webp"
              alt="Mus, KayaMo’s seed companion"
              width={120}
              height={120}
              sizes="120px"
            />
          </div>
        </div>
      </section>
      <section className={styles.how} id="how-it-works" aria-labelledby="how-title">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Less friction. More everyday.</p>
          <h2 id="how-title">A log that fits your life.</h2>
        </div>
        <div className={styles.points}>
          <article>
            <span className={styles.step}>01 / FOOD</span>
            <h3>Start with what you ate.</h3>
            <p>
              Search the food catalog, choose a portion, and add it to your diary. On
              desktop, <kbd>⌘ / Ctrl K</kbd> opens the food logger.
            </p>
          </article>
          <article>
            <span className={styles.step}>02 / CONTEXT</span>
            <h3>See more than a number.</h3>
            <p>
              Review portions and source details alongside your entries. A recipe estimate
              is a starting point, not an exact measurement of your plate.
            </p>
          </article>
          <article>
            <span className={styles.step}>03 / ROUTINE</span>
            <h3>Make room for training.</h3>
            <p>
              Keep your workout log and daily tasks close to your food diary. Open Mus
              when you want help; keep the rest of your screen for your day.
            </p>
          </article>
        </div>
      </section>
      <section className={styles.closer} aria-labelledby="demo-title">
        <div>
          <p className={styles.eyebrow}>Kaya mo. One day at a time.</p>
          <h2 id="demo-title">Get a feel for your day.</h2>
          <p>
            Explore a sample diary, try logging a meal, and see whether KayaMo fits your
            routine.
          </p>
          <StartDemo>Try KayaMo without an account</StartDemo>
        </div>
        <div className={styles.faq}>
          <details>
            <summary>What happens to my demo entries?</summary>
            <p>
              They are stored in this browser. Clearing browser data removes them. Signing
              in does not currently transfer demo entries to an account.
            </p>
          </details>
          <details>
            <summary>Are the calorie numbers exact?</summary>
            <p>
              No. Recipes and portions vary. Check the source and serving assumptions for
              each entry. KayaMo is a logging tool, not medical advice.
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
