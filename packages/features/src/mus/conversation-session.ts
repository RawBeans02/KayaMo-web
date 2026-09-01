const PREFIX = 'kayamo:mus-active-conversation:';

export function musConversationStorageKey(userId: string): string {
  return `${PREFIX}${userId}`;
}

export function readActiveMusConversationId(userId: string): string | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(musConversationStorageKey(userId));
  return value && value.length > 0 ? value : null;
}

export function writeActiveMusConversationId(userId: string, conversationId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(musConversationStorageKey(userId), conversationId);
}
