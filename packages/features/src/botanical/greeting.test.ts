import { findBannedCopy } from '@kayamo/ai';
import { describe, expect, it } from 'vitest';
import { GAP_DAYS, homeGreeting, mealAhead, streakLabel, type GreetingInput } from './greeting';

const base: GreetingInput = {
  name: 'Ana',
  today: '2026-09-22',
  hour: 9,
  todayKcal: 0,
  mealsLogged: 0,
  targetKcal: 1480,
  loggedDates: new Set(),
  yesterdayKcal: null,
};

function allVariants(): string[] {
  const inputs: GreetingInput[] = [
    base,
    { ...base, name: null },
    { ...base, loggedDates: new Set(['2026-09-21']), hour: 15 },
    { ...base, loggedDates: new Set(['2026-09-21']), hour: 23 },
    {
      ...base,
      loggedDates: new Set(['2026-09-21', '2026-09-22']),
      mealsLogged: 1,
      todayKcal: 640,
      yesterdayKcal: 1500,
    },
    { ...base, loggedDates: new Set(['2026-09-22']), mealsLogged: 2, todayKcal: 900, targetKcal: null, yesterdayKcal: 1720 },
    { ...base, loggedDates: new Set(['2026-09-15']), targetKcal: null },
    { ...base, loggedDates: new Set(['2026-09-15']) },
  ];
  return inputs.map((input) => homeGreeting(input).text);
}

describe('homeGreeting', () => {
  it('treats a person with no entries at all as on their first day', () => {
    const g = homeGreeting(base);
    expect(g.kind).toBe('first');
    expect(g.dateNote).toBe('your first day');
    expect(g.text).toMatch(/^Hi Ana\./);
    expect(g.text).toContain('exactly right for a first day');
  });

  it('greets a guest without a name and without an awkward gap', () => {
    expect(homeGreeting({ ...base, name: null }).text).toMatch(/^Hi\. /);
    expect(
      homeGreeting({ ...base, name: null, loggedDates: new Set(['2026-09-21']) }).text,
    ).toMatch(/^Morning\. /);
  });

  it('reads the day so far against the target, with the next meal and yesterday', () => {
    const g = homeGreeting({
      ...base,
      hour: 11,
      loggedDates: new Set(['2026-09-21', '2026-09-22']),
      mealsLogged: 1,
      todayKcal: 640,
      yesterdayKcal: 1500,
    });
    expect(g.kind).toBe('normal');
    expect(g.text).toBe(
      'Morning, Ana. You are at 640 of 1,480 with tanghalian still ahead, and yesterday landed right on target.',
    );
  });

  it('never calls yesterday over or under, it only names a landing near the target', () => {
    const over = homeGreeting({
      ...base,
      loggedDates: new Set(['2026-09-21', '2026-09-22']),
      mealsLogged: 1,
      todayKcal: 300,
      yesterdayKcal: 2400,
    });
    expect(over.text).not.toMatch(/over|under|too much|missed/i);
    expect(over.text).not.toContain('2,400');
  });

  it('works before onboarding, with no target at all', () => {
    const g = homeGreeting({
      ...base,
      hour: 19,
      targetKcal: null,
      loggedDates: new Set(['2026-09-22']),
      mealsLogged: 2,
      todayKcal: 900,
      yesterdayKcal: 1720,
    });
    expect(g.text).toBe(
      'Evening, Ana. You are at 900 kcal so far with hapunan still ahead, and yesterday came to 1,720.',
    );
  });

  it('welcomes a return after a gap and keeps the target steady', () => {
    const g = homeGreeting({ ...base, loggedDates: new Set(['2026-09-16']) });
    expect(g.kind).toBe('gap');
    expect(g.text).toBe(
      'Welcome back Ana. It has been 6 days, and the numbers pick up from today. Your target is still 1,480 unless you would like to look at it again.',
    );
  });

  it(`does not call ${GAP_DAYS} quiet days a gap`, () => {
    const g = homeGreeting({ ...base, loggedDates: new Set([`2026-09-${22 - GAP_DAYS}`]) });
    expect(g.kind).toBe('quiet');
  });

  it('keeps a quiet morning inviting and a quiet night settled', () => {
    expect(homeGreeting({ ...base, hour: 8, loggedDates: new Set(['2026-09-21']) }).text).toContain(
      'almusal starts the count',
    );
    expect(homeGreeting({ ...base, hour: 23, loggedDates: new Set(['2026-09-21']) }).text).toContain(
      'that is fine',
    );
  });

  it('passes the banned-copy sweep in every variant', () => {
    for (const text of allVariants()) {
      expect(findBannedCopy(JSON.stringify(text))).toEqual([]);
    }
  });
});

describe('mealAhead', () => {
  it('names the slot the day still holds', () => {
    expect(mealAhead(7)).toBe('almusal');
    expect(mealAhead(12)).toBe('tanghalian');
    expect(mealAhead(15)).toBe('meryenda');
    expect(mealAhead(19)).toBe('hapunan');
    expect(mealAhead(22)).toBeNull();
  });
});

describe('streakLabel', () => {
  it('counts a run and never frames zero as a loss', () => {
    expect(streakLabel(3, true)).toBe('3 days');
    expect(streakLabel(1, true)).toBe('1 day');
    expect(streakLabel(0, true)).toBe('Picks up today');
    expect(streakLabel(0, false)).toBe('Starts with today');
  });
});
