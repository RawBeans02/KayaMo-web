import type { CompiledTodoKb, PlannerRule } from './types';
import compiledJson from './compiled.json';

const compiled = compiledJson as CompiledTodoKb;

export function buildTodoKnowledgeBase(): CompiledTodoKb {
  return compiled;
}

export function hardPlannerRules(kb: CompiledTodoKb = compiled): PlannerRule[] {
  return kb.plannerRules.filter((row) => row.severity === 'HARD');
}

export function plannerAction(id: string, kb: CompiledTodoKb = compiled) {
  return kb.plannerActions.find((row) => row.id === id) ?? null;
}
