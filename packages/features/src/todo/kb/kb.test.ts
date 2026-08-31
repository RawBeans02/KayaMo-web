import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildTodoKnowledgeBase, hardPlannerRules, plannerAction } from './assemble';
import {
  catalogFromCsvFiles,
  validateCompiledTodoKb,
  validateCsvPackage,
} from './from-csv';
import { captureProposalSchema, dayPlanProposalSchema, whatNowSchema } from '../planner-schema';

const csvDir = join(dirname(fileURLToPath(import.meta.url)), '../../../../../data/todo/csv');

function loadCsvPackage(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const name of readdirSync(csvDir)) {
    if (!name.endsWith('.csv')) continue;
    files[name] = readFileSync(join(csvDir, name), 'utf8');
  }
  return files;
}

describe('todo knowledge base', () => {
  const files = loadCsvPackage();
  const fromCsv = catalogFromCsvFiles(files);
  const kb = buildTodoKnowledgeBase();

  it('validates unique ids and hard planner rules', () => {
    expect(validateCsvPackage(files)).toEqual([]);
    expect(validateCompiledTodoKb(fromCsv)).toEqual([]);
    expect(validateCompiledTodoKb(kb)).toEqual([]);
    expect(hardPlannerRules(kb).some((row) => row.id === 'NO_SILENT_WRITE')).toBe(true);
  });

  it('keeps tasks untimed and events timed', () => {
    const task = kb.itemKinds.find((row) => row.id === 'TASK');
    const event = kb.itemKinds.find((row) => row.id === 'EVENT');
    expect(task?.hasFixedTime).toBe(false);
    expect(event?.hasFixedTime).toBe(true);
    expect(kb.flexibility.map((row) => row.id)).toEqual(
      expect.arrayContaining(['FIXED', 'FLEXIBLE', 'ANYTIME']),
    );
  });

  it('does not let Mus auto-write any module', () => {
    expect(kb.permissions.every((row) => !row.aiAutoWrite && row.requireApproval)).toBe(true);
    expect(plannerAction('PLAN_MY_DAY', kb)?.requiresApproval).toBe(true);
    expect(plannerAction('WHAT_NOW', kb)?.writesPlan).toBe(false);
    expect(kb.a11.find((row) => row.id === 'A11_01')?.status).toBe('SHIPPED');
  });

  it('parses Plan My Day and capture proposals', () => {
    const plan = dayPlanProposalSchema.parse({
      logicalDate: '2026-09-01',
      mode: 'standard',
      overload: true,
      usableOpenMinutes: 220,
      summary: 'Work does not fit. Keep the draft; move groceries.',
      blocks: [
        {
          kind: 'EVENT',
          title: 'Class',
          start: '09:00',
          end: '11:00',
          flexibility: 'FIXED',
          sourceTable: 'events',
          sourceId: '11111111-1111-4111-8111-111111111111',
          durationMin: 120,
          why: 'Fixed commitment',
        },
        {
          kind: 'TASK',
          title: 'Research draft',
          start: '11:30',
          end: '13:00',
          flexibility: 'FLEXIBLE',
          sourceTable: 'tasks',
          sourceId: '22222222-2222-4222-8222-222222222222',
          durationMin: 90,
          why: 'Due tonight and blocks tomorrow',
        },
      ],
      deferrals: [
        {
          title: 'Groceries',
          sourceId: null,
          toHorizon: 'TOMORROW',
          reason: 'Rain window and not enough open time',
        },
      ],
      questions: ['Save this plan?'],
    });
    expect(plan.overload).toBe(true);

    const now = whatNowSchema.parse({
      availableMinutes: 25,
      location: 'SCHOOL',
      energy: 'LOW',
      options: [
        {
          title: 'Email professor',
          durationMin: 8,
          why: 'Fits the window and needs internet',
          sourceId: null,
        },
      ],
    });
    expect(now.options).toHaveLength(1);

    const dump = captureProposalSchema.parse({
      items: [
        {
          kind: 'TASK',
          title: 'Submit form',
          dueHint: 'tomorrow',
          preferredWindow: 'ANY',
          durationMin: null,
          location: 'SCHOOL',
          category: 'ACADEMIC',
          constraint: null,
          confidence: 0.8,
        },
        {
          kind: 'INBOX',
          title: 'Message Jerry about Francis',
          dueHint: null,
          preferredWindow: null,
          durationMin: null,
          location: null,
          category: 'COMMUNICATION',
          constraint: null,
          confidence: 0.6,
        },
      ],
      questions: ['Do you know when you will be at school?'],
    });
    expect(dump.items).toHaveLength(2);
  });
});
