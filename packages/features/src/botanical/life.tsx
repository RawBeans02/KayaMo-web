'use client';
import { BotanicalIcon, type BotanicalIconName } from './icons';
import styles from './botanical.module.css';

/**
 * Life is a hub, not a workspace: every card is a destination and none of them
 * carry controls. The grouping follows the real shape of the desk build, so
 * nothing here points at a section that does not exist yet, and nothing here
 * describes what is not on the web: roadmap copy belongs in docs, not in a hub.
 * Workouts are off this hub for the first release (owner decision, 2026-09-18).
 */
const physical: { href: string; icon: BotanicalIconName; title: string; meta: string }[] =
  [
    {
      href: '/calories',
      icon: 'food',
      title: 'Food diary',
      meta: 'What you ate, with the source kept on every entry',
    },
    {
      href: '/foods',
      icon: 'book',
      title: 'Food catalog',
      meta: 'The foods and servings your diary draws from',
    },
    {
      href: '/verify',
      icon: 'tasks',
      title: 'Food verification',
      meta: 'Check a food before it becomes a number you trust',
    },
  ];

const growth: { href: string; icon: BotanicalIconName; title: string; meta: string }[] = [
  {
    href: '/goals',
    icon: 'goals',
    title: 'Goals',
    meta: 'One today-sized step at a time',
  },
  {
    href: '/grove',
    icon: 'grove',
    title: 'Grove',
    meta: 'The steps you have confirmed, kept as a record',
  },
];

export function BotanicalLife() {
  return (
    <section className={styles.page} aria-labelledby="life-title">
      <header className={styles.header}>
        <div>
          <h1 id="life-title" className="kgTitle">
            Life
          </h1>
          <p className={styles.lede}>What you eat and what you are growing toward.</p>
        </div>
      </header>
      <div className={styles.cards}>
        <section
          className={`${styles.panel} kgSurface`}
          aria-labelledby="life-physical-title"
        >
          <div className={styles.panelHead}>
            <h2 id="life-physical-title">Physical self</h2>
          </div>
          {physical.map((item) => (
            <a className={styles.tool} href={item.href} key={item.href}>
              <BotanicalIcon name={item.icon} size={22} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.meta}</small>
              </span>
              <BotanicalIcon name="next" size={18} />
            </a>
          ))}
        </section>
        <section
          className={`${styles.panel} kgSurface`}
          aria-labelledby="life-growth-title"
        >
          <div className={styles.panelHead}>
            <h2 id="life-growth-title">Your wider life</h2>
          </div>
          {growth.map((item) => (
            <a className={styles.tool} href={item.href} key={item.href}>
              <BotanicalIcon name={item.icon} size={22} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.meta}</small>
              </span>
              <BotanicalIcon name="next" size={18} />
            </a>
          ))}
        </section>
      </div>
    </section>
  );
}
