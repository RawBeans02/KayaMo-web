import type { CocoActionName, CocoMode, MusEntryModule } from './contracts';
import type { MusContextPermissions } from './context-permissions';

const TASK_ACTIONS: CocoActionName[] = [
  'create_task',
  'complete_task',
  'edit_task',
  'delete_task',
  'schedule_task',
  'create_time_block',
  'move_time_block',
  'bulk_edit_tasks',
  'set_recurrence',
  'create_routine',
];

const GOAL_ACTIONS: CocoActionName[] = ['create_goal'];
const GYM_ACTIONS: CocoActionName[] = [
  'start_workout',
  'add_session_exercise',
  'replace_session_exercise',
  'skip_session_exercise',
  'edit_planned_set',
  'schedule_workout',
];
const FOOD_ACTIONS: CocoActionName[] = ['log_food'];
const FOCUS_ACTIONS: CocoActionName[] = ['start_focus'];
const MEMORY_ACTIONS: CocoActionName[] = ['remember_this'];

function addAll(into: Set<CocoActionName>, actions: readonly CocoActionName[]): void {
  for (const action of actions) into.add(action);
}

export function allowedMusActions(input: {
  mode: CocoMode | 'chat' | 'focus' | 'workout';
  entry?: { module: MusEntryModule } | null;
  permissions: MusContextPermissions;
}): CocoActionName[] {
  const allowed = new Set<CocoActionName>();
  const module = input.entry?.module ?? null;
  const { permissions } = input;

  if (input.mode === 'workout') {
    if (permissions.physical_self) addAll(allowed, GYM_ACTIONS);
    return [...allowed];
  }

  if (input.mode === 'focus') {
    addAll(allowed, FOCUS_ACTIONS);
    if (permissions.memory) addAll(allowed, MEMORY_ACTIONS);
    return [...allowed];
  }

  if (module === 'todos') {
    addAll(allowed, TASK_ACTIONS);
    if (permissions.goals_planning) addAll(allowed, GOAL_ACTIONS);
  } else if (module === 'gym') {
    if (permissions.physical_self) addAll(allowed, GYM_ACTIONS);
  } else if (module === 'calories' || module === 'foods') {
    if (permissions.physical_self) addAll(allowed, FOOD_ACTIONS);
  } else {
    addAll(allowed, TASK_ACTIONS);
    addAll(allowed, FOCUS_ACTIONS);
    if (permissions.goals_planning) addAll(allowed, GOAL_ACTIONS);
    if (permissions.physical_self) {
      addAll(allowed, GYM_ACTIONS);
      addAll(allowed, FOOD_ACTIONS);
    }
  }

  if (permissions.memory) addAll(allowed, MEMORY_ACTIONS);
  return [...allowed];
}
