export type ItemKind = {
  id: string;
  name: string;
  hasFixedTime: boolean;
  appearsOnToday: boolean;
  notes: string;
};

export type Flexibility = {
  id: string;
  name: string;
  aiMaySuggestMove: boolean;
  aiMayAutoMove: boolean;
  notes: string;
};

export type PlannerRule = {
  id: string;
  severity: 'HARD' | 'SOFT';
  appliesTo: string;
  statement: string;
};

export type Permission = {
  id: string;
  aiReadDefault: boolean;
  aiSuggestDefault: boolean;
  aiAutoWrite: boolean;
  requireApproval: boolean;
  notes: string;
};

export type DataModelRow = {
  id: string;
  status: string;
  sync: string;
  mapsTo: string;
  notes: string;
};

export type A11Row = {
  id: string;
  name: string;
  status: string;
  notes: string;
};

export type CompiledTodoKb = {
  version: 1;
  itemKinds: ItemKind[];
  flexibility: Flexibility[];
  energy: Array<{ id: string; name: string }>;
  focus: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string; requiresTravel: boolean }>;
  horizons: Array<{ id: string; name: string; dashboardDefault: boolean }>;
  plannerActions: Array<{
    id: string;
    name: string;
    writesPlan: boolean;
    requiresApproval: boolean;
    notes: string;
  }>;
  plannerRules: PlannerRule[];
  permissions: Permission[];
  dataModel: DataModelRow[];
  dashboardModules: Array<{ id: string; name: string; surface: string; v1: boolean }>;
  a11: A11Row[];
  capturePatterns: Array<{ id: string; phrase: string; mapsTo: string; notes: string }>;
  constraints: Array<{ id: string; name: string; notes: string }>;
};
