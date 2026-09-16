import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Translucent surfaces have no single background, so contrast cannot be read off
 * a pair of hex values. Text on glass sits over whatever the backdrop wash
 * happens to be at that point, so this composites `--glass` / `--glass-strong`
 * over every colour the wash can produce and asserts the ink still clears AA.
 *
 * This replaces the previous test, which guarded the botanical sidebar's
 * texture image — a surface the Liquid Glass shell no longer renders.
 */
const css = readFileSync(new URL('../app/glass.css', import.meta.url), 'utf8');

const light = css.slice(0, css.indexOf("[data-kayamo-theme='night']"));
const night = css.slice(css.indexOf("[data-kayamo-theme='night']"));

function hex(source: string, name: string): number[] {
  const found = source.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!found) throw new Error(`token --${name} not found`);
  return found[1]!.slice(1).match(/../g)!.map((v) => parseInt(v, 16));
}

/** `rgba(r, g, b, a)` → [r, g, b, a]. */
function rgba(source: string, name: string): number[] {
  const found = source.match(
    new RegExp(`--${name}:\\s*rgba\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)\\)`),
  );
  if (!found) throw new Error(`token --${name} not found as rgba`);
  return found.slice(1, 5).map(Number);
}

function luminance(rgb: number[]): number {
  return rgb
    .map((v) => v / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
}

function contrast(a: number[], b: number[]): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Paint `layer` (with alpha) onto an opaque `under`. */
function over(layer: number[], under: number[]): number[] {
  const alpha = layer[3] ?? 1;
  return [0, 1, 2].map((i) => layer[i]! * alpha + under[i]! * (1 - alpha));
}

describe('Liquid Glass keeps text legible on every surface the wash can produce', () => {
  for (const [theme, source] of [
    ['day', light],
    ['night', night],
  ] as const) {
    // The wash is bg0 plus two radial glows, so a glass panel can sit over any
    // of these three grounds depending on where it lands on screen.
    const grounds = (['bg0', 'glow1', 'glow2'] as const).map((n) => hex(source, n));
    const surfaces = (['glass', 'glass-strong'] as const).map((n) => rgba(source, n));
    const ink = hex(source, 'ink');
    const ink2 = rgba(source, 'ink2');

    it(`${theme}: --ink clears 4.5:1 on glass over any wash colour`, () => {
      for (const ground of grounds) {
        for (const surface of surfaces) {
          expect(contrast(ink, over(surface, ground))).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it(`${theme}: --ink2 (meta text) clears 4.5:1 on glass over any wash colour`, () => {
      for (const ground of grounds) {
        for (const surface of surfaces) {
          const background = over(surface, ground);
          expect(contrast(over(ink2, background), background)).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it(`${theme}: accent-as-text clears 4.5:1 on glass over any wash colour`, () => {
      const accentText = hex(source, 'accent-text');
      for (const ground of grounds) {
        for (const surface of surfaces) {
          expect(contrast(accentText, over(surface, ground))).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it(`${theme}: danger-as-text clears 4.5:1 on glass over any wash colour`, () => {
      const dangerText = hex(source, 'danger-text');
      for (const ground of grounds) {
        for (const surface of surfaces) {
          expect(contrast(dangerText, over(surface, ground))).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    // Reduced transparency swaps every glass surface for the opaque ground, so
    // the ink has to clear AA there too — that is where the settings rows failed.
    it(`${theme}: ink and accent/danger text clear 4.5:1 on the opaque fallback`, () => {
      const opaque = hex(source, 'bg0');
      expect(contrast(ink, opaque)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(over(ink2, opaque), opaque)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(hex(source, 'accent-text'), opaque)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(hex(source, 'danger-text'), opaque)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('text on an accent fill clears 4.5:1', () => {
    expect(contrast(hex(light, 'accent-ink'), hex(light, 'accent'))).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});
