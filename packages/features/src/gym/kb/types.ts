import type { Difficulty, Laterality, Mechanic, MuscleRole, RelationshipKind, SplitGroup } from './enums';

export type MuscleDef = {
  id: string;
  groupId: string;
  regionId: 'upper_body' | 'lower_body' | 'core' | 'full_body';
  name: string;
};

export type EquipmentDef = {
  id: string;
  name: string;
  category: string;
};

export type MovementPatternDef = {
  id: string;
  name: string;
};

export type MuscleLink = {
  exerciseId: string;
  muscleId: string;
  role: MuscleRole;
};

export type Relationship = {
  fromId: string;
  toId: string;
  kind: RelationshipKind;
  score: number;
};

export type TrainingRule = {
  id: string;
  condition: string;
  action: string;
};

export type CatalogExercise = {
  slug: string;
  name: string;
  nameTl: string[];
  aliases: string[];
  familyId: string;
  variantOf: string | null;
  primaryMuscle: string;
  secondaryMuscles: string[];
  stabilizerMuscles: string[];
  movement: Mechanic;
  movementPattern: string;
  force: string;
  laterality: Laterality;
  plane: string;
  position: string;
  group: SplitGroup;
  equipment: string;
  requiredEquipment: string[];
  optionalEquipment: string[];
  trackingMode: string;
  difficulty: Difficulty;
  skillDemand: number;
  hypertrophy: number;
  strength: number;
  power: number;
  defaultRepMin: number;
  defaultRepMax: number;
  aiSelectionAllowed: boolean;
  beginnerAllowed: boolean;
  exerciseClass: string;
};

export type GymKnowledgeBase = {
  version: 1;
  muscles: MuscleDef[];
  equipment: EquipmentDef[];
  patterns: MovementPatternDef[];
  exercises: CatalogExercise[];
  relationships: Relationship[];
  rules: TrainingRule[];
};
