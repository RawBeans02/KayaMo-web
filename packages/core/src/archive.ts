export const COMPLEXITY_LEVELS = ['simple', 'balanced', 'advanced'] as const;
export type ComplexityLevel = (typeof COMPLEXITY_LEVELS)[number];

export const COMPLEXITY_LABELS: Record<ComplexityLevel, string> = {
  simple: 'Simple',
  balanced: 'Balanced',
  advanced: 'Advanced',
};

export function isMusLite(level: ComplexityLevel): boolean {
  return level === 'simple';
}

export const STORY_KINDS = [
  'goal_completed',
  'goal_released',
  'milestone',
  'chapter',
  'note',
] as const;
export type StoryKind = (typeof STORY_KINDS)[number];

export type StoryDraft = {
  title: string;
  summary: string;
  happenedOn: string;
  kind: StoryKind;
  professional: boolean;
  sourceId: string | null;
};

export function professionalForArea(lifeArea: string | null | undefined): boolean {
  return lifeArea === 'work';
}

export function proposeStoryFromGoal(input: {
  title: string;
  status: 'completed' | 'released';
  happenedOn: string;
  lifeArea?: string | null;
  id: string;
}): StoryDraft {
  const released = input.status === 'released';
  return {
    title: input.title.trim(),
    summary: released
      ? 'Set down. The trail stays. Nothing was taken away.'
      : 'Reached, after you confirmed it.',
    happenedOn: input.happenedOn,
    kind: released ? 'goal_released' : 'goal_completed',
    professional: professionalForArea(input.lifeArea),
    sourceId: input.id,
  };
}

export type ChapterCloseInput = {
  changed: string;
  accomplished: string;
  letGo: string;
  learned: string;
  carries: string;
};

export function chapterCloseSummary(input: ChapterCloseInput): string {
  const lines = [
    input.changed.trim() && `What changed: ${input.changed.trim()}`,
    input.accomplished.trim() && `Accomplished: ${input.accomplished.trim()}`,
    input.letGo.trim() && `Let go: ${input.letGo.trim()}`,
    input.learned.trim() && `Learned: ${input.learned.trim()}`,
    input.carries.trim() && `Carries forward: ${input.carries.trim()}`,
  ].filter((line): line is string => Boolean(line));
  return lines.join('\n');
}

export function chapterCloseReady(input: ChapterCloseInput): boolean {
  return chapterCloseSummary(input).length > 0;
}

export type ArchiveStoryEntry = {
  title: string;
  summary: string;
  happenedOn: string;
  kind: StoryKind;
  professional: boolean;
};

export type ArchiveGoal = {
  title: string;
  status: string;
  lifeArea: string | null;
  targetDate: string | null;
};

export type PersonalArchive = {
  product: 'KayaMo';
  companion: 'Lis';
  exportedAt: string;
  futureSelf: string | null;
  compass: { mattersNow: string | null; protect: string | null } | null;
  grove: { totalPoints: number; stageKey: string };
  story: ArchiveStoryEntry[];
  goals: ArchiveGoal[];
};

export function buildPersonalArchive(input: {
  exportedAt: string;
  futureSelf: string | null;
  compass: { mattersNow: string | null; protect: string | null } | null;
  grove: { totalPoints: number; stageKey: string };
  story: ArchiveStoryEntry[];
  goals: ArchiveGoal[];
}): PersonalArchive {
  return {
    product: 'KayaMo',
    companion: 'Lis',
    exportedAt: input.exportedAt,
    futureSelf: input.futureSelf,
    compass: input.compass,
    grove: input.grove,
    story: [...input.story].sort((a, b) => a.happenedOn.localeCompare(b.happenedOn)),
    goals: input.goals,
  };
}

export function evidenceBankEntries(story: readonly ArchiveStoryEntry[]): ArchiveStoryEntry[] {
  return story.filter((row) => row.professional);
}

export function renderArchiveMarkdown(archive: PersonalArchive): string {
  const story = archive.story.length
    ? archive.story.map((row) => `- ${row.happenedOn} · ${row.title} — ${row.summary}`).join('\n')
    : '- Nothing confirmed into Life Story yet.';
  const goals = archive.goals.length
    ? archive.goals.map((row) => `- ${row.title} (${row.status})`).join('\n')
    : '- No goals on this device.';
  return [
    '# KayaMo · Personal Life Archive',
    '',
    `Companion: Lis`,
    `Exported: ${archive.exportedAt}`,
    `Grove: ${archive.grove.totalPoints} points · ${archive.grove.stageKey}`,
    '',
    '## Who you are becoming',
    archive.futureSelf?.trim() || 'No future-self sentence saved.',
    '',
    '## Compass',
    archive.compass?.mattersNow
      ? `Matters now: ${archive.compass.mattersNow}`
      : 'No compass sentence saved.',
    archive.compass?.protect ? `Protect: ${archive.compass.protect}` : '',
    '',
    '## Life Story',
    story,
    '',
    '## Goals',
    goals,
    '',
    'Nutrition and weight are not in this file. This is not a generated CV.',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

export function renderEvidenceMarkdown(entries: readonly ArchiveStoryEntry[]): string {
  const body = entries.length
    ? entries.map((row) => `- ${row.happenedOn} · ${row.title} — ${row.summary}`).join('\n')
    : '- No professional evidence has been confirmed yet.';
  return [
    '# KayaMo · Professional Evidence Bank',
    '',
    'This is a compile of work you marked as professionally relevant. It is not a generated CV.',
    '',
    body,
  ].join('\n');
}
