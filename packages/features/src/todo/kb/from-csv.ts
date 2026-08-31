import { parseCsv } from '../../gym/kb/csv';
import type {
  A11Row,
  CompiledTodoKb,
  DataModelRow,
  Flexibility,
  ItemKind,
  Permission,
  PlannerRule,
} from './types';

export const REQUIRED_TODO_CSVS = [
  'item_kinds.csv',
  'flexibility.csv',
  'energy.csv',
  'focus.csv',
  'locations.csv',
  'horizons.csv',
  'planner_actions.csv',
  'planner_rules.csv',
  'permissions.csv',
  'data_model.csv',
  'dashboard_modules.csv',
  'a11_inventory.csv',
  'capture_patterns.csv',
  'constraints.csv',
] as const;

const REQUIRED_HARD_RULES = [
  'NO_SILENT_WRITE',
  'NO_MOVE_FIXED',
  'TASK_NOT_EVENT',
  'ANYTIME_OFF_CLOCK',
  'LEAVE_WHITESPACE',
  'USER_OVERRIDE',
  'ZOD_OUTPUT',
  'NO_CALORIE_WRITE',
  'NO_DIAGNOSIS',
  'NO_SHAME',
  'DEPENDENCIES',
  'OVERLOAD_NEGOTIATE',
  'PLAN_FROM_NOW',
  'EVENTS_FIRST',
] as const;

function flag(value: string | undefined): boolean {
  return value === '1';
}

function requireRows(files: Record<string, string>, name: string): Record<string, string>[] {
  const text = files[name];
  if (!text) throw new Error(`missing ${name}`);
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error(`${name} has no rows`);
  return rows;
}

function uniqueIds(label: string, ids: string[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id) {
      errors.push(`${label}: blank id`);
      continue;
    }
    if (seen.has(id)) errors.push(`${label}: duplicate ${id}`);
    seen.add(id);
  }
  return errors;
}

export function catalogFromCsvFiles(files: Record<string, string>): CompiledTodoKb {
  const itemKinds: ItemKind[] = requireRows(files, 'item_kinds.csv').map((row) => ({
    id: row.kind_id ?? '',
    name: row.name ?? '',
    hasFixedTime: flag(row.has_fixed_time),
    appearsOnToday: flag(row.appears_on_today),
    notes: row.notes ?? '',
  }));
  const flexibility: Flexibility[] = requireRows(files, 'flexibility.csv').map((row) => ({
    id: row.flexibility_id ?? '',
    name: row.name ?? '',
    aiMaySuggestMove: flag(row.ai_may_suggest_move),
    aiMayAutoMove: flag(row.ai_may_auto_move),
    notes: row.notes ?? '',
  }));
  const plannerRules: PlannerRule[] = requireRows(files, 'planner_rules.csv').map((row) => ({
    id: row.rule_id ?? '',
    severity: row.severity === 'HARD' ? 'HARD' : 'SOFT',
    appliesTo: row.applies_to ?? '',
    statement: row.statement ?? '',
  }));
  const permissions: Permission[] = requireRows(files, 'permissions.csv').map((row) => ({
    id: row.module_id ?? '',
    aiReadDefault: flag(row.ai_read_default),
    aiSuggestDefault: flag(row.ai_suggest_default),
    aiAutoWrite: flag(row.ai_auto_write),
    requireApproval: flag(row.require_approval),
    notes: row.notes ?? '',
  }));
  const dataModel: DataModelRow[] = requireRows(files, 'data_model.csv').map((row) => ({
    id: row.table_id ?? '',
    status: row.status ?? '',
    sync: row.sync ?? '',
    mapsTo: row.maps_to ?? '',
    notes: row.notes ?? '',
  }));
  const a11: A11Row[] = requireRows(files, 'a11_inventory.csv').map((row) => ({
    id: row.a11_id ?? '',
    name: row.name ?? '',
    status: row.status ?? '',
    notes: row.notes ?? '',
  }));

  return {
    version: 1,
    itemKinds,
    flexibility,
    energy: requireRows(files, 'energy.csv').map((row) => ({
      id: row.energy_id ?? '',
      name: row.name ?? '',
    })),
    focus: requireRows(files, 'focus.csv').map((row) => ({
      id: row.focus_id ?? '',
      name: row.name ?? '',
    })),
    locations: requireRows(files, 'locations.csv').map((row) => ({
      id: row.location_id ?? '',
      name: row.name ?? '',
      requiresTravel: flag(row.requires_travel),
    })),
    horizons: requireRows(files, 'horizons.csv').map((row) => ({
      id: row.horizon_id ?? '',
      name: row.name ?? '',
      dashboardDefault: flag(row.dashboard_default),
    })),
    plannerActions: requireRows(files, 'planner_actions.csv').map((row) => ({
      id: row.action_id ?? '',
      name: row.name ?? '',
      writesPlan: flag(row.writes_plan),
      requiresApproval: flag(row.requires_approval),
      notes: row.notes ?? '',
    })),
    plannerRules,
    permissions,
    dataModel,
    dashboardModules: requireRows(files, 'dashboard_modules.csv').map((row) => ({
      id: row.module_id ?? '',
      name: row.name ?? '',
      surface: row.surface ?? '',
      v1: flag(row.v1),
    })),
    a11,
    capturePatterns: requireRows(files, 'capture_patterns.csv').map((row) => ({
      id: row.pattern_id ?? '',
      phrase: row.phrase ?? '',
      mapsTo: row.maps_to ?? '',
      notes: row.notes ?? '',
    })),
    constraints: requireRows(files, 'constraints.csv').map((row) => ({
      id: row.constraint_id ?? '',
      name: row.name ?? '',
      notes: row.notes ?? '',
    })),
  };
}

export function validateCsvPackage(files: Record<string, string>): string[] {
  const errors: string[] = [];
  for (const name of REQUIRED_TODO_CSVS) {
    if (!files[name]) errors.push(`missing ${name}`);
  }
  for (const [name, text] of Object.entries(files)) {
    if (!name.endsWith('.csv')) continue;
    const rows = parseCsv(text);
    const first = rows[0];
    if (!first) {
      errors.push(`${name}: no rows`);
      continue;
    }
    const idKey = Object.keys(first)[0];
    if (!idKey) {
      errors.push(`${name}: no header`);
      continue;
    }
    errors.push(...uniqueIds(name, rows.map((row) => row[idKey] ?? '')));
  }
  return errors;
}

export function validateCompiledTodoKb(kb: CompiledTodoKb): string[] {
  const errors: string[] = [];
  errors.push(...uniqueIds('itemKinds', kb.itemKinds.map((row) => row.id)));
  errors.push(...uniqueIds('flexibility', kb.flexibility.map((row) => row.id)));
  errors.push(...uniqueIds('plannerRules', kb.plannerRules.map((row) => row.id)));
  errors.push(...uniqueIds('permissions', kb.permissions.map((row) => row.id)));
  errors.push(...uniqueIds('dataModel', kb.dataModel.map((row) => row.id)));
  errors.push(...uniqueIds('a11', kb.a11.map((row) => row.id)));

  const kindIds = new Set(kb.itemKinds.map((row) => row.id));
  for (const id of ['TASK', 'EVENT', 'ROUTINE', 'HABIT', 'PROJECT', 'INBOX']) {
    if (!kindIds.has(id)) errors.push(`missing item kind ${id}`);
  }
  const flexIds = new Set(kb.flexibility.map((row) => row.id));
  for (const id of ['FIXED', 'FLEXIBLE', 'AUTO', 'ANYTIME', 'PROTECTED']) {
    if (!flexIds.has(id)) errors.push(`missing flexibility ${id}`);
  }
  const task = kb.itemKinds.find((row) => row.id === 'TASK');
  const event = kb.itemKinds.find((row) => row.id === 'EVENT');
  if (task?.hasFixedTime) errors.push('TASK must not require a fixed time');
  if (!event?.hasFixedTime) errors.push('EVENT must have a fixed time');

  const rules = new Map(kb.plannerRules.map((row) => [row.id, row]));
  for (const id of REQUIRED_HARD_RULES) {
    const rule = rules.get(id);
    if (!rule) errors.push(`missing hard rule ${id}`);
    else if (rule.severity !== 'HARD') errors.push(`${id} must be HARD`);
  }

  for (const row of kb.permissions) {
    if (row.aiAutoWrite) errors.push(`${row.id} must not auto-write`);
    if (!row.requireApproval) errors.push(`${row.id} must require approval`);
  }

  const tasks = kb.dataModel.find((row) => row.id === 'tasks');
  const events = kb.dataModel.find((row) => row.id === 'events');
  if (tasks?.status !== 'SHIPPED') errors.push('tasks must stay SHIPPED');
  if (events?.status !== 'PLANNED') errors.push('events must stay PLANNED until implemented');

  const planMyDay = kb.a11.find((row) => row.id === 'A11_01');
  if (planMyDay?.status !== 'SHIPPED') errors.push('A11_01 Plan My Day must stay SHIPPED');

  const nutrition = kb.permissions.find((row) => row.id === 'NUTRITION');
  if (nutrition?.aiReadDefault) errors.push('NUTRITION read stays opt-in');

  return errors;
}
