import { describe, expect, it } from 'vitest';
import { allowedMusActions } from './allowed-actions';
import { defaultMusContextPermissions } from './context-permissions';

describe('allowedMusActions', () => {
  it('does not give Todos gym or food mutations', () => {
    const actions = allowedMusActions({
      mode: 'chat',
      entry: { module: 'todos' },
      permissions: {
        ...defaultMusContextPermissions(),
        physical_self: true,
        memory: true,
        goals_planning: true,
      },
    });
    expect(actions).toContain('create_task');
    expect(actions).toContain('create_goal');
    expect(actions).toContain('remember_this');
    expect(actions).not.toContain('log_food');
    expect(actions).not.toContain('start_workout');
    expect(actions).not.toContain('add_session_exercise');
  });

  it('scopes workout mode to gym actions when Physical Self is allowed', () => {
    const actions = allowedMusActions({
      mode: 'workout',
      entry: { module: 'mus' },
      permissions: { ...defaultMusContextPermissions(), physical_self: true },
    });
    expect(actions).toEqual(
      expect.arrayContaining(['start_workout', 'add_session_exercise']),
    );
    expect(actions).not.toContain('create_task');
    expect(actions).not.toContain('log_food');
  });

  it('withholds gym actions when Physical Self is private', () => {
    const actions = allowedMusActions({
      mode: 'chat',
      entry: { module: 'gym' },
      permissions: defaultMusContextPermissions(),
    });
    expect(actions).toEqual([]);
  });
});
