import { describe, expect, it } from 'vitest';
import {
  cycleMusPermLevel,
  DEFAULT_MUS_PERM_LEVELS,
  domainAllowedFromLevels,
  musMayRead,
  musMayWrite,
  parseMusPermLevels,
  permModuleForAction,
  readableModuleCount,
} from './perm-levels';

describe('five-level Mus permissions', () => {
  it('cycles read → suggest → edit w/ approval → edit → never', () => {
    expect(cycleMusPermLevel('read')).toBe('suggest');
    expect(cycleMusPermLevel('suggest')).toBe('edit w/ approval');
    expect(cycleMusPermLevel('edit w/ approval')).toBe('edit');
    expect(cycleMusPermLevel('edit')).toBe('never');
    expect(cycleMusPermLevel('never')).toBe('read');
  });

  it('never writes at read or never', () => {
    expect(musMayWrite('read')).toBe(false);
    expect(musMayWrite('never')).toBe(false);
    expect(musMayWrite('suggest')).toBe(true);
    expect(musMayWrite('edit w/ approval')).toBe(true);
    expect(musMayWrite('edit')).toBe(true);
    expect(musMayRead('never')).toBe(false);
    expect(musMayRead('read')).toBe(true);
  });

  it('maps physical_self off only when every food/gym module is never', () => {
    const allNever = parseMusPermLevels({
      today: 'never',
      foods: 'never',
      verify: 'never',
      gym: 'never',
      todos: 'edit',
    });
    expect(domainAllowedFromLevels(allNever, 'physical_self')).toBe(false);
    expect(domainAllowedFromLevels(allNever, 'goals_planning')).toBe(true);
    expect(readableModuleCount(DEFAULT_MUS_PERM_LEVELS)).toBe(5);
  });

  it('routes proposal actions onto the five modules, not a second vocabulary', () => {
    expect(permModuleForAction('log_food')).toBe('today');
    expect(permModuleForAction('replace_session_exercise')).toBe('gym');
    expect(permModuleForAction('create_task')).toBe('todos');
    expect(permModuleForAction('remember_this')).toBeNull();
  });
});
