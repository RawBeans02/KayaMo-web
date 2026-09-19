import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { nutritionKeysInZod } from '@kayamo/ai';
import { gymConsultPickSchema } from '../gym/consult-schema';
import { imageObservationSchema, planDayRequestSchema } from '../todo/planner-schema';

const featuresRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('codex acceptance: desks, vision, gym consult', () => {
  it('keeps gym consult on catalog slugs', () => {
    const parsed = gymConsultPickSchema.parse({
      slug: 'barbell-squat',
      sets: 3,
      reps: 8,
      why: 'Compounds first while you are fresh',
    });
    expect(parsed.slug).toBe('barbell-squat');
    expect(gymConsultPickSchema.safeParse({ name: 'Squat', sets: 3, reps: 8, why: 'Nope' }).success).toBe(
      false,
    );
  });

  it('does not let vision or plan-day invent nutrition numbers', () => {
    expect(nutritionKeysInZod(imageObservationSchema)).toEqual([]);
    expect(nutritionKeysInZod(planDayRequestSchema)).toEqual([]);
  });

  it('wires compact Mus onto gym, calories, foods, and verify', () => {
    const gym = readFileSync(join(featuresRoot, 'desk/gym-desk.tsx'), 'utf8');
    const calories = readFileSync(join(featuresRoot, 'food/today-table.tsx'), 'utf8');
    const foods = readFileSync(join(featuresRoot, 'food/foods-table.tsx'), 'utf8');
    const verify = readFileSync(join(featuresRoot, 'food/verify-table.tsx'), 'utf8');
    expect(gym).toContain('module="gym"');
    expect(calories).toContain('module="calories"');
    expect(foods).toContain('module="foods"');
    expect(verify).toContain('module="verify"');
  });

  it('uses server-confirmed context access on the Mus screen and shell', () => {
    const desk = readFileSync(join(featuresRoot, 'desk/mus-desk.tsx'), 'utf8');
    const rail = readFileSync(join(featuresRoot, 'desk/mus-rail.tsx'), 'utf8');
    const levels = readFileSync(join(featuresRoot, 'mus/perm-levels.ts'), 'utf8');
    expect(desk).toContain('MusRail');
    expect(desk).toContain('variant="page"');
    expect(desk).not.toContain('ask first');
    expect(rail).toContain('chrome="rail"');
    expect(rail).toContain('loadMusContextPermissions');
    expect(rail).toContain('updateMusContextPermission');
    expect(rail).toContain('unverified');
    expect(rail).not.toContain('writeMusPermLevels');
    expect(rail).not.toContain('ask first');
    expect(levels).toContain('edit w/ approval');
    expect(levels).toContain("'never'");
  });

  it('sends chat through /api/mus/respond and photos through observe-image', () => {
    const thread = readFileSync(join(featuresRoot, 'mus/mus-thread.tsx'), 'utf8');
    expect(thread).toContain("/api/mus/respond");
    expect(thread).toContain('/api/mus/observe-image');
    expect(thread).toContain('Nothing is saved until you confirm');
  });
});
