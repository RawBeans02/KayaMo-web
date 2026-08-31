import type { Mechanic, SplitGroup } from './enums';
import type {
  CatalogExercise,
  EquipmentDef,
  MovementPatternDef,
  MuscleDef,
  TrainingRule,
} from './types';
import { parseCsv } from './csv';

export type CompiledGymKb = {
  version: 1;
  muscles: MuscleDef[];
  equipment: EquipmentDef[];
  patterns: MovementPatternDef[];
  exercises: CatalogExercise[];
  rules: TrainingRule[];
};

const PUSH_PATTERNS = new Set([
  'horizontal_push',
  'vertical_push',
  'elbow_extension',
  'shoulder_abduction',
  'shoulder_flexion',
]);
const PULL_PATTERNS = new Set([
  'horizontal_pull',
  'vertical_pull',
  'elbow_flexion',
  'scapular_retraction',
  'scapular_elevation',
]);
const LEG_PATTERNS = new Set([
  'squat',
  'hip_hinge',
  'lunge',
  'step',
  'hip_extension',
  'hip_abduction',
  'hip_adduction',
  'knee_extension',
  'knee_flexion',
  'plantar_flexion',
  'dorsiflexion',
]);
const CORE_PATTERNS = new Set([
  'anti_extension',
  'anti_rotation',
  'anti_lateral_flexion',
  'spinal_flexion',
  'spinal_extension',
  'trunk_rotation',
  'lateral_flexion',
  'carry',
  'crawl',
]);

function snake(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/['’]/g, '')
    .replace(/[\s/.-]+/g, '_');
}

function flag(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

function score(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 1;
}

function mechanicOf(value: string): Mechanic {
  return snake(value) === 'compound' ? 'compound' : 'isolated';
}

function splitOf(pattern: string, group: string, region: string): SplitGroup {
  if (PUSH_PATTERNS.has(pattern)) return 'push';
  if (PULL_PATTERNS.has(pattern)) return 'pull';
  if (LEG_PATTERNS.has(pattern)) return 'legs';
  if (CORE_PATTERNS.has(pattern)) return 'core';
  const g = snake(group);
  if (['chest', 'shoulders', 'triceps'].includes(g)) return 'push';
  if (['back', 'lats', 'biceps', 'forearms'].includes(g)) return 'pull';
  if (['quads', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'].includes(g)) {
    return 'legs';
  }
  const r = snake(region);
  if (r === 'lower_body') return 'legs';
  if (r === 'trunk' || r === 'core') return 'core';
  return 'core';
}

function defaultReps(tracking: string, hypertrophy: number): { min: number; max: number } {
  if (tracking === 'duration') return { min: 20, max: 45 };
  if (tracking === 'load_distance' || tracking === 'distance_time') return { min: 20, max: 40 };
  if (hypertrophy >= 4) return { min: 8, max: 12 };
  return { min: 5, max: 8 };
}

function regionId(region: string): MuscleDef['regionId'] {
  const value = snake(region);
  if (value === 'upper_body') return 'upper_body';
  if (value === 'lower_body') return 'lower_body';
  if (value === 'core' || value === 'trunk') return 'core';
  return 'full_body';
}

function groupId(name: string): string {
  const value = snake(name);
  if (value === 'quadriceps') return 'quads';
  if (value === 'lower_back') return 'back';
  return value;
}

function grouped(records: Record<string, string>[], key: string): Map<string, Record<string, string>[]> {
  const map = new Map<string, Record<string, string>[]>();
  for (const row of records) {
    const id = row[key] ?? '';
    const list = map.get(id) ?? [];
    list.push(row);
    map.set(id, list);
  }
  return map;
}

export function catalogFromCsvFiles(files: Record<string, string>): CompiledGymKb {
  const exercises = parseCsv(files['exercises.csv'] ?? '');
  const muscles = parseCsv(files['muscles.csv'] ?? '');
  const equipment = parseCsv(files['equipment.csv'] ?? '');
  const patterns = parseCsv(files['movement_patterns.csv'] ?? '');
  const aliases = parseCsv(files['exercise_aliases.csv'] ?? '');
  const muscleLinks = parseCsv(files['exercise_muscles.csv'] ?? '');
  const equipmentLinks = parseCsv(files['exercise_equipment.csv'] ?? '');
  const rules = parseCsv(files['training_rules.csv'] ?? '');

  const aliasByExercise = grouped(aliases, 'exercise_id');
  const musclesByExercise = grouped(muscleLinks, 'exercise_id');
  const gearByExercise = grouped(equipmentLinks, 'exercise_id');
  const muscleName = new Map(muscles.map((row) => [row.muscle_id ?? '', row.name ?? row.muscle_id ?? '']));

  const muscleDefs: MuscleDef[] = muscles.map((row) => ({
    id: row.muscle_id ?? '',
    groupId: groupId(row.muscle_group ?? row.name ?? ''),
    regionId: regionId(row.muscle_group === row.name ? 'full_body' : row.muscle_group ?? ''),
    name: row.name ?? row.muscle_id ?? '',
  }));

  const equipmentDefs: EquipmentDef[] = equipment.map((row) => ({
    id: snake(row.equipment_id ?? ''),
    name: row.name ?? row.equipment_id ?? '',
    category: row.equipment_category ?? '',
  }));

  const patternDefs: MovementPatternDef[] = patterns.map((row) => ({
    id: snake(row.movement_pattern_id ?? ''),
    name: row.name ?? row.movement_pattern_id ?? '',
  }));

  const catalog: CatalogExercise[] = exercises.map((row) => {
    const id = row.exercise_id ?? '';
    const pattern = snake(row.movement_pattern_id ?? '');
    const tracking = snake(row.tracking_mode_id ?? 'weight_reps');
    const hypertrophy = score(row.hypertrophy_suitability_1_5);
    const reps = defaultReps(tracking, hypertrophy);
    const required = (gearByExercise.get(id) ?? [])
      .filter((link) => (link.requirement ?? 'REQUIRED').toUpperCase() === 'REQUIRED')
      .map((link) => snake(link.equipment_id ?? ''))
      .filter(Boolean);
    const optional = (gearByExercise.get(id) ?? [])
      .filter((link) => (link.requirement ?? '').toUpperCase() === 'OPTIONAL')
      .map((link) => snake(link.equipment_id ?? ''))
      .filter(Boolean);
    const links = musclesByExercise.get(id) ?? [];
    const secondary = links
      .filter((link) => (link.role ?? '').toUpperCase() === 'SECONDARY')
      .map((link) => muscleName.get(link.muscle_id ?? '') ?? link.muscle_id ?? '')
      .filter(Boolean);
    const stabilizers = links
      .filter((link) => (link.role ?? '').toUpperCase() === 'STABILIZER')
      .map((link) => muscleName.get(link.muscle_id ?? '') ?? link.muscle_id ?? '')
      .filter(Boolean);
    const aliasList = (aliasByExercise.get(id) ?? []).map((link) => link.alias ?? '').filter(Boolean);
    return {
      slug: id,
      name: row.canonical_name ?? id,
      nameTl: aliasList,
      aliases: aliasList,
      familyId: snake(row.exercise_family ?? id),
      variantOf: row.variant_of ? row.variant_of : null,
      primaryMuscle: row.primary_muscle_group ?? 'Core',
      secondaryMuscles: secondary,
      stabilizerMuscles: stabilizers,
      movement: mechanicOf(row.mechanic ?? 'Compound'),
      movementPattern: pattern,
      force: snake(row.force ?? 'push'),
      laterality: snake(row.laterality ?? 'bilateral') as CatalogExercise['laterality'],
      plane: snake(row.movement_plane ?? 'sagittal').replace('multi_planar', 'multi'),
      position: snake(row.position ?? 'standing'),
      group: splitOf(pattern, row.primary_muscle_group ?? '', row.body_region ?? ''),
      equipment: required[0] ?? 'bodyweight',
      requiredEquipment: required,
      optionalEquipment: optional,
      trackingMode: tracking,
      difficulty: snake(row.difficulty ?? 'beginner') as CatalogExercise['difficulty'],
      skillDemand: score(row.skill_demand_1_5),
      hypertrophy,
      strength: score(row.strength_suitability_1_5),
      power: score(row.power_suitability_1_5),
      defaultRepMin: reps.min,
      defaultRepMax: reps.max,
      aiSelectionAllowed: flag(row.ai_selection_allowed),
      beginnerAllowed: flag(row.beginner_allowed),
      exerciseClass: snake(row.exercise_class ?? 'resistance'),
    };
  });

  return {
    version: 1,
    muscles: muscleDefs,
    equipment: equipmentDefs,
    patterns: patternDefs,
    exercises: catalog,
    rules: rules.map((row) => ({
      id: row.rule_id ?? '',
      condition: row.condition ?? '',
      action: row.action ?? '',
    })),
  };
}
