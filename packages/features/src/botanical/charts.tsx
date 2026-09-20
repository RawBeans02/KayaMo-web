'use client';
import styles from './progress.module.css';

/**
 * Hand-drawn SVG bars on glass. No chart library: the series here are short
 * (14 to 28 points), the look has to be the design system's, and the bundle
 * budget is real. Colour comes from CSS classes, so themes and forced
 * colours apply; the numbers are in the accessible name, so a screen reader
 * gets the same reading a sighted person does.
 */
export function BarChart({
  values,
  labels,
  ariaLabel,
  formatValue = (value) => String(value),
  ticks,
  height = 120,
}: {
  values: readonly number[];
  /** One per value; only the first and last are drawn, the rest name the bars. */
  labels: readonly string[];
  ariaLabel: string;
  formatValue?: (value: number) => string;
  /** Indices to draw a label under, in addition to first and last. */
  ticks?: readonly number[];
  height?: number;
}) {
  const width = 600;
  const top = 8;
  const axis = 22;
  const plot = height - top - axis;
  const max = Math.max(1, ...values);
  const slot = width / Math.max(values.length, 1);
  const bar = Math.max(4, Math.min(28, slot * 0.62));
  const drawn = new Set<number>([0, values.length - 1, ...(ticks ?? [])]);
  const peak = values.reduce((best, value, index) => (value > values[best]! ? index : best), 0);
  const summary =
    values.every((value) => value === 0)
      ? 'nothing recorded yet'
      : `peak ${formatValue(values[peak]!)} on ${labels[peak]}`;

  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${ariaLabel}: ${summary}`}
      preserveAspectRatio="none"
    >
      <line
        className={styles.baseline}
        x1={0}
        x2={width}
        y1={top + plot + 0.5}
        y2={top + plot + 0.5}
      />
      {values.map((value, index) => {
        const h = value > 0 ? Math.max(3, (value / max) * plot) : 3;
        const x = index * slot + (slot - bar) / 2;
        const y = top + plot - h;
        return (
          <g key={index}>
            <rect
              className={value > 0 ? styles.barOn : styles.barOff}
              x={x}
              y={y}
              width={bar}
              height={h}
              rx={Math.min(6, bar / 2)}
            >
              <title>{`${labels[index]}: ${formatValue(value)}`}</title>
            </rect>
            {drawn.has(index) ? (
              <text
                className={styles.tick}
                x={index * slot + slot / 2}
                y={height - 6}
                textAnchor={index === 0 ? 'start' : index === values.length - 1 ? 'end' : 'middle'}
              >
                {labels[index]}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/** A ring for "how far to the next stage". Decorative; the text beside it carries the value. */
export function ProgressRing({ fraction, size = 64 }: { fraction: number; size?: number }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <svg className={styles.ring} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle className={styles.ringTrack} cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
      <circle
        className={styles.ringFill}
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - clamped)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
