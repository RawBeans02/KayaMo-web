import type { WeekBar } from '../food/week-headline';
import styles from '../food/desk.module.css';

export function DeskBarChart({
  caption,
  bars,
  unit,
}: {
  caption: string;
  bars: readonly WeekBar[];
  unit: string;
}) {
  const peak = Math.max(1, ...bars.map((bar) => bar.value));
  const chartId = caption.replace(/\s+/g, '-').toLowerCase();
  return (
    <figure className={styles.chart}>
      <figcaption className={styles.statLabel}>{caption}</figcaption>
      <svg
        className={styles.chartSvg}
        viewBox="0 0 280 132"
        role="img"
        aria-labelledby={`${chartId}-title`}
      >
        <title id={`${chartId}-title`}>
          {`${caption}: ${bars.map((bar) => `${bar.weekday} ${bar.value} ${unit}`).join(', ')}`}
        </title>
        {bars.map((bar, index) => {
          const height = bar.future ? 0 : (bar.value / peak) * 96;
          const x = 8 + index * 38;
          return (
            <g key={bar.date}>
              <rect
                x={x}
                y={104 - Math.max(height, bar.value > 0 ? 3 : 0)}
                width="26"
                height={Math.max(height, bar.value > 0 ? 3 : 0)}
                rx="3"
                className={styles.chartBar}
                data-empty={bar.value === 0 || bar.future ? 'true' : 'false'}
                data-future={bar.future ? 'true' : 'false'}
              />
              <text x={x + 13} y="122" textAnchor="middle" className={styles.chartTick}>
                {bar.weekday.slice(0, 1)}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export function DeskMacroChart({
  proteinG,
  carbsG,
  fatG,
}: {
  proteinG: number;
  carbsG: number;
  fatG: number;
}) {
  const parts = [
    { key: 'protein', label: 'Protein', value: Math.max(0, proteinG) },
    { key: 'carbs', label: 'Carbs', value: Math.max(0, carbsG) },
    { key: 'fat', label: 'Fat', value: Math.max(0, fatG) },
  ];
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  return (
    <figure className={styles.chart}>
      <figcaption className={styles.statLabel}>Today’s macros</figcaption>
      <div className={styles.macroTrack} role="img" aria-label={`Protein ${Math.round(proteinG)} grams, carbs ${Math.round(carbsG)} grams, fat ${Math.round(fatG)} grams`}>
        {total === 0 ? (
          <span className={styles.macroEmpty} />
        ) : (
          parts.map((part) => (
            <span
              key={part.key}
              className={styles.macroSeg}
              data-macro={part.key}
              style={{ width: `${(part.value / total) * 100}%` }}
            />
          ))
        )}
      </div>
      <ul className={styles.macroLegend}>
        {parts.map((part) => (
          <li key={part.key}>
            <span data-macro={part.key} />
            {part.label} {Math.round(part.value)}g
          </li>
        ))}
      </ul>
    </figure>
  );
}
