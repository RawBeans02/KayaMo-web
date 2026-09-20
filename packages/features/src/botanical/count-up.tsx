'use client';
import { useCountUp } from './use-count-up';

/** A whole-number reading that settles into place the first time it shows. */
export function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  const shown = useCountUp(value);
  return <>{format ? format(shown) : String(shown)}</>;
}
