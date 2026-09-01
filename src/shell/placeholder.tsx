import styles from './shell.module.css';

export function PhoneFirstPlaceholder({ title }: { title: string }) {
  return (
    <section className={styles.placeholder}>
      <h1>{title}</h1>
      <p>Phone-first for now. Nothing here is invented for the desktop shell.</p>
    </section>
  );
}
