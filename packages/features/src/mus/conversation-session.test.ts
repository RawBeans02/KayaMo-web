import { describe, expect, it } from 'vitest';
import { musConversationStorageKey } from './conversation-session';

describe('mus conversation session', () => {
  it('scopes the active thread key to the user', () => {
    expect(musConversationStorageKey('user-a')).toBe('kayamo:mus-active-conversation:user-a');
    expect(musConversationStorageKey('user-b')).not.toBe(musConversationStorageKey('user-a'));
  });
});
