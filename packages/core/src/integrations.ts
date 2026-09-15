export const ACTION_LEVELS = [
  'observe',
  'suggest',
  'act_with_permission',
  'auto_manage',
] as const;
export type ActionLevel = (typeof ACTION_LEVELS)[number];

export const ACTION_LEVEL_LABELS: Record<ActionLevel, string> = {
  observe: 'Observe',
  suggest: 'Suggest',
  act_with_permission: 'Act with permission',
  auto_manage: 'Auto-manage',
};

export const INTEGRATION_IDS = [
  'calendar',
  'health',
  'wearable',
  'location',
  'weather',
  'screen_time',
  'app_blocking',
  'voice',
  'web_research',
  'notifications',
] as const;
export type IntegrationId = (typeof INTEGRATION_IDS)[number];

export type IntegrationAvailability =
  | 'local_alternative'
  | 'pwa_optional'
  | 'native_required'
  | 'needs_provider';

export type IntegrationDescriptor = {
  id: IntegrationId;
  title: string;
  summary: string;
  availability: IntegrationAvailability;
  restriction: string;
  defaultLevel: ActionLevel;
};

export const INTEGRATION_CATALOG: readonly IntegrationDescriptor[] = [
  {
    id: 'calendar',
    title: 'Calendar',
    summary: 'Google and Apple calendars are not connected.',
    availability: 'local_alternative',
    restriction:
      'Two-way calendar sync needs the Android or iOS app plus your account. Until then, add the hours you already committed. That is not a fake calendar connection.',
    defaultLevel: 'act_with_permission',
  },
  {
    id: 'health',
    title: 'Health apps',
    summary: 'Apple Health and Health Connect are not connected.',
    availability: 'native_required',
    restriction:
      'Health and wearable reads need a native wrap. Weight and workouts you confirm in Physical Self still count. Kai will not invent steps or heart-rate.',
    defaultLevel: 'suggest',
  },
  {
    id: 'wearable',
    title: 'Wearables',
    summary: 'No watch or band is connected.',
    availability: 'native_required',
    restriction: 'Wearable APIs are not available in the PWA. Nothing here is simulated.',
    defaultLevel: 'suggest',
  },
  {
    id: 'location',
    title: 'Location',
    summary: 'Location is off.',
    availability: 'pwa_optional',
    restriction:
      'Location is asked only when a trip or nearby search needs it. This slice does not request it.',
    defaultLevel: 'suggest',
  },
  {
    id: 'weather',
    title: 'Weather',
    summary: 'Weather is not connected.',
    availability: 'needs_provider',
    restriction: 'Weather needs a real provider and a location grant. Days are not invented from a fake forecast.',
    defaultLevel: 'suggest',
  },
  {
    id: 'screen_time',
    title: 'Screen time',
    summary: 'App usage is not readable here.',
    availability: 'native_required',
    restriction: 'Screen-time and app blocking need OS support that this PWA does not have.',
    defaultLevel: 'suggest',
  },
  {
    id: 'app_blocking',
    title: 'App blocking',
    summary: 'KayaMo cannot block other apps in the browser.',
    availability: 'native_required',
    restriction: 'Focus is a timer and a nudge only. The browser cannot silence Instagram or TikTok.',
    defaultLevel: 'suggest',
  },
  {
    id: 'voice',
    title: 'Voice capture',
    summary: 'Speak into Life Inbox when this browser supports it.',
    availability: 'pwa_optional',
    restriction:
      'Voice uses the browser speech engine when it exists. If it does not, type instead. Nothing is faked as a recording.',
    defaultLevel: 'act_with_permission',
  },
  {
    id: 'web_research',
    title: 'Web research',
    summary: 'Kai cannot browse the web yet.',
    availability: 'needs_provider',
    restriction: 'External research needs a real search tool and citations. This slice does not invent sources.',
    defaultLevel: 'suggest',
  },
  {
    id: 'notifications',
    title: 'Reminders',
    summary: 'One quiet reminder, if you allow the browser.',
    availability: 'pwa_optional',
    restriction: 'Reminders stay off until you enable them. Quiet hours are still respected.',
    defaultLevel: 'act_with_permission',
  },
];

export type IntegrationStatus = IntegrationDescriptor & {
  connected: boolean;
  level: ActionLevel;
};

export function voiceCaptureAvailability(speechCtorPresent: boolean): 'available' | 'unsupported' {
  return speechCtorPresent ? 'available' : 'unsupported';
}

export function hoursBetweenClock(startHm: string, endHm: string): number {
  const start = parseClock(startHm);
  const end = parseClock(endHm);
  if (start === null || end === null || end <= start) return 0;
  return (end - start) / 60;
}

function parseClock(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function busyHoursFromBlocks(
  blocks: readonly { startsAt: string | null; endsAt: string | null }[],
): number {
  let hours = 0;
  for (const block of blocks) {
    if (block.startsAt && block.endsAt) {
      hours += hoursBetweenClock(block.startsAt, block.endsAt);
    } else {
      hours += 2;
    }
  }
  return hours;
}

/** Each 3 hours of confirmed busy time removes one plan slot. Never below 1. */
export function adjustedPlanLimit(base: number, busyHours: number): number {
  const reduction = Math.floor(Math.max(0, busyHours) / 3);
  return Math.max(1, base - reduction);
}

export function resolveActionLevel(
  stored: ActionLevel | null | undefined,
  descriptor: IntegrationDescriptor,
): ActionLevel {
  const level = stored ?? descriptor.defaultLevel;
  if (level === 'auto_manage') return 'act_with_permission';
  return ACTION_LEVELS.includes(level) ? level : descriptor.defaultLevel;
}

export function integrationStatuses(
  storedLevels: Partial<Record<IntegrationId, ActionLevel>>,
  runtime: { voiceAvailable: boolean; notificationsEnabled: boolean },
): IntegrationStatus[] {
  return INTEGRATION_CATALOG.map((row) => {
    const connected =
      (row.id === 'voice' && runtime.voiceAvailable) ||
      (row.id === 'notifications' && runtime.notificationsEnabled);
    return {
      ...row,
      connected,
      level: resolveActionLevel(storedLevels[row.id], row),
    };
  });
}
