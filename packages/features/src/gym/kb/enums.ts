export const BODY_REGIONS = ['upper_body', 'lower_body', 'core', 'full_body'] as const;
export type BodyRegionId = (typeof BODY_REGIONS)[number];

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'lats',
  'traps',
  'shoulders',
  'rear_delts',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'calves',
  'core',
] as const;
export type MuscleGroupId = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_ROLES = ['primary', 'secondary', 'stabilizer'] as const;
export type MuscleRole = (typeof MUSCLE_ROLES)[number];

export const MECHANICS = ['compound', 'isolated'] as const;
export type Mechanic = (typeof MECHANICS)[number];

export const FORCES = ['push', 'pull', 'static', 'dynamic'] as const;
export type Force = (typeof FORCES)[number];

export const LATERALITIES = ['bilateral', 'unilateral', 'alternating'] as const;
export type Laterality = (typeof LATERALITIES)[number];

export const PLANES = ['sagittal', 'frontal', 'transverse', 'multi'] as const;
export type Plane = (typeof PLANES)[number];

export const POSITIONS = [
  'standing',
  'seated',
  'supine',
  'prone',
  'kneeling',
  'half_kneeling',
  'quadruped',
  'hanging',
  'supported',
] as const;
export type Position = (typeof POSITIONS)[number];

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const TRACKING_MODES = [
  'weight_reps',
  'bodyweight_reps',
  'assisted_reps',
  'weighted_bodyweight_reps',
  'duration',
  'distance',
  'distance_time',
  'load_distance',
  'reps_only',
] as const;
export type TrackingMode = (typeof TRACKING_MODES)[number];

export const SPLIT_GROUPS = ['push', 'pull', 'legs', 'core'] as const;
export type SplitGroup = (typeof SPLIT_GROUPS)[number];

export const EXERCISE_CLASSES = [
  'resistance',
  'core_stability',
  'carry',
  'plyometric',
  'mobility',
] as const;
export type ExerciseClass = (typeof EXERCISE_CLASSES)[number];

export const MOVEMENT_PATTERNS = [
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'squat',
  'hip_hinge',
  'lunge',
  'hip_extension',
  'knee_extension',
  'knee_flexion',
  'elbow_flexion',
  'elbow_extension',
  'shoulder_abduction',
  'shoulder_flexion',
  'plantar_flexion',
  'hip_abduction',
  'hip_adduction',
  'shrug',
  'anti_extension',
  'anti_rotation',
  'anti_lateral_flexion',
  'spinal_flexion',
  'carry',
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

export const RELATIONSHIP_KINDS = ['best', 'acceptable', 'different_purpose', 'variation'] as const;
export type RelationshipKind = (typeof RELATIONSHIP_KINDS)[number];

export const TRAINING_CATEGORIES = [
  'RESISTANCE',
  'CARDIO',
  'POWER',
  'PLYOMETRIC',
  'MOBILITY',
  'FLEXIBILITY',
  'BALANCE',
  'CORE',
  'FUNCTIONAL',
  'CONDITIONING',
  'RECOVERY',
  'ASSESSMENT',
] as const;

export const WORKOUT_FORMATS = [
  'traditional_sets',
  'circuit',
  'superset',
  'tri_set',
  'giant_set',
  'emom',
  'amrap',
  'intervals',
] as const;
