import {
  isEstimateResult,
  showsVerifiedCheck,
  sourceBadge,
  type FoodCandidate,
} from '@kayamo/food/search-ui';
import type { ResolveSource } from '@kayamo/food';
import styles from './provenance.module.css';

export function ProvenanceMark({
  source,
  verified,
  estimate,
}: {
  source: ResolveSource | string;
  verified?: boolean;
  estimate?: boolean;
}) {
  const badge = sourceBadge(source as FoodCandidate['source']);
  const showEstimate = estimate === true || isEstimateResult({
    source: source as FoodCandidate['source'],
    estimate,
  });
  const showCheck = showsVerifiedCheck({
    source: source as FoodCandidate['source'],
    verified,
    estimate,
  });
  return (
    <span>
      {badge ? <span className={styles.badge}>{badge}</span> : null}
      {showCheck ? (
        <span className={styles.check} aria-label="Verified">
          ✓
        </span>
      ) : null}
      {showEstimate && !showCheck ? <span className={styles.estimate}>estimate</span> : null}
    </span>
  );
}

export function ProvenanceKcal({
  kcal,
  source,
  verified,
  estimate,
  servingLabel,
  large,
}: {
  kcal: number | string;
  source: ResolveSource | string;
  verified?: boolean;
  estimate?: boolean;
  servingLabel?: string | null;
  /** Palette results rows set the numeral one step larger than suggestions. */
  large?: boolean;
}) {
  const rounded = typeof kcal === 'number' ? Math.round(kcal) : Math.round(Number(kcal));
  return (
    <span
      className={large ? `${styles.kcal} ${styles.kcalLarge}` : styles.kcal}
      title={servingLabel ?? undefined}
    >
      <span>{Number.isFinite(rounded) ? rounded.toLocaleString('en-PH') : '—'}</span>
      <span className={styles.unit}>kcal</span>
      <ProvenanceMark source={source} verified={verified} estimate={estimate} />
    </span>
  );
}
