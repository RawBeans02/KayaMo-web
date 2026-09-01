import type { LocalGoal, LocalPlanningProject, LocalTask, LocalTaskMeta, LocalTimeBlock } from './db';
import { listLocalGoals } from './journey';
import { listLocalOpenTasks, listLocalOverdueTasks, listLocalTasksForDate } from './planning';
import {
  listBlockedTaskIds,
  listLocalProjects,
  listLocalTaskMetas,
  listLocalTimeBlocks,
  listLocalTimeBlocksRange,
} from './schedule';

export type PlanningSnapshot = {
  todayTasks: LocalTask[];
  tomorrowTasks: LocalTask[];
  overdue: LocalTask[];
  later: LocalTask[];
  inbox: LocalTask[];
  goals: LocalGoal[];
  projects: LocalPlanningProject[];
  blocks: LocalTimeBlock[];
  weekBlocks: LocalTimeBlock[];
  metas: LocalTaskMeta[];
  blockedIds: string[];
};

export async function getPlanningSnapshot(params: {
  userId: string;
  date: string;
  today: string;
  tomorrow: string;
  nowIso: string;
  weekStart: string;
  weekEnd: string;
}): Promise<PlanningSnapshot> {
  const [todayTasks, tomorrowTasks, overdue, open, goals, projects, blocks, weekBlocks, metas] =
    await Promise.all([
      listLocalTasksForDate(params.userId, params.date),
      listLocalTasksForDate(params.userId, params.tomorrow),
      listLocalOverdueTasks(params.userId, params.today, params.nowIso),
      listLocalOpenTasks(params.userId),
      listLocalGoals(params.userId),
      listLocalProjects(params.userId),
      listLocalTimeBlocks(params.userId, params.date),
      listLocalTimeBlocksRange(params.userId, params.weekStart, params.weekEnd),
      listLocalTaskMetas(params.userId),
    ]);
  const overdueIds = new Set(overdue.map((row) => row.id));
  const openIds = new Set(open.map((row) => row.id));
  const blocked = await listBlockedTaskIds(params.userId, openIds);
  return {
    todayTasks,
    tomorrowTasks,
    overdue,
    later: open.filter(
      (row) => row.scheduled_for && row.scheduled_for > params.tomorrow && !overdueIds.has(row.id),
    ),
    inbox: open.filter((row) => !row.scheduled_for && !overdueIds.has(row.id)),
    goals: goals.filter((row) => row.status === 'active'),
    projects,
    blocks,
    weekBlocks,
    metas,
    blockedIds: [...blocked],
  };
}
