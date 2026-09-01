'use client';

import type { ActionLevel, IntegrationId } from '@kayamo/core';
import {
  getLocalActionGrants,
  getLocalCompass,
  getLocalCompanionProgression,
  getLocalDailyLoopPreferences,
  getLocalDailyPlan,
  getLocalFutureSelf,
  getLocalSocialPrefs,
  listLocalBusyBlocks,
  listLocalCircles,
  listLocalCompanionEvents,
  listLocalCompanionPresenceDates,
  listLocalDailyPlans,
  listLocalFocusHistory,
  listLocalFocusSessions,
  listLocalGoals,
  listLocalGoalMilestones,
  listLocalInboxItems,
  listLocalLifeStory,
  listLocalOpenTasks,
  listLocalPersonalRules,
  listLocalRoutineCompletions,
  listLocalRoutines,
  listLocalScripture,
  listLocalTasksForDate,
  listLocalWeightLogs,
  listLocalWorkoutHistory,
  recoverClosedOfflineDb,
  addLogicalCalendarDays,
  type LocalBusyBlock,
  type LocalCircle,
  type LocalCompanionEvent,
  type LocalCompass,
  type LocalDailyLoopPreference,
  type LocalDailyPlan,
  type LocalFocusSession,
  type LocalFutureSelf,
  type LocalGoal,
  type LocalGoalMilestone,
  type LocalInboxItem,
  type LocalLifeStoryEntry,
  type LocalPersonalRule,
  type LocalRoutine,
  type LocalRoutineCompletion,
  type LocalScripturePassage,
  type LocalTask,
  type LocalWeightLog,
  type LocalWorkout,
} from '@kayamo/offline';
import { useCallback, useEffect, useState } from 'react';

const EMPTY_PROGRESS = {
  totalPoints: 0,
  stageKey: 'seed',
  acceptedEventKeys: [] as string[],
};

/**
 * Loads the Dexie-backed day snapshot used by the PWA shell. Chrome, sheets,
 * and tab state stay in the app; this hook owns domain rows and refresh.
 */
export function useLocalAppSnapshot(userId: string, logicalDate: string) {
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [routines, setRoutines] = useState<LocalRoutine[]>([]);
  const [allRoutines, setAllRoutines] = useState<LocalRoutine[]>([]);
  const [routineCompletions, setRoutineCompletions] = useState<LocalRoutineCompletion[]>([]);
  const [plan, setPlan] = useState<LocalDailyPlan | null>(null);
  const [focusSessions, setFocusSessions] = useState<LocalFocusSession[]>([]);
  const [goals, setGoals] = useState<LocalGoal[]>([]);
  const [goalMilestones, setGoalMilestones] = useState<LocalGoalMilestone[]>([]);
  const [inboxItems, setInboxItems] = useState<LocalInboxItem[]>([]);
  const [futureSelf, setFutureSelf] = useState<LocalFutureSelf | null>(null);
  const [compass, setCompass] = useState<LocalCompass | null>(null);
  const [openTasks, setOpenTasks] = useState<LocalTask[]>([]);
  const [dailyPlans, setDailyPlans] = useState<LocalDailyPlan[]>([]);
  const [focusHistory, setFocusHistory] = useState<LocalFocusSession[]>([]);
  const [companionEvents, setCompanionEvents] = useState<LocalCompanionEvent[]>([]);
  const [personalRules, setPersonalRules] = useState<LocalPersonalRule[]>([]);
  const [yesterdayNote, setYesterdayNote] = useState<string | null>(null);
  const [busyBlocks, setBusyBlocks] = useState<LocalBusyBlock[]>([]);
  const [actionGrants, setActionGrants] = useState<Partial<Record<IntegrationId, ActionLevel>>>({});
  const [storyEntries, setStoryEntries] = useState<LocalLifeStoryEntry[]>([]);
  const [circles, setCircles] = useState<LocalCircle[]>([]);
  const [socialEnabled, setSocialEnabled] = useState(false);
  const [workouts, setWorkouts] = useState<LocalWorkout[]>([]);
  const [weights, setWeights] = useState<LocalWeightLog[]>([]);
  const [preferences, setPreferences] = useState<LocalDailyLoopPreference | null>(null);
  const [scripture, setScripture] = useState<LocalScripturePassage[]>([]);
  const [progress, setProgress] = useState(EMPTY_PROGRESS);
  const [presenceDates, setPresenceDates] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const weekday = new Date(`${logicalDate}T12:00:00`).getDay();
    const yesterday = addLogicalCalendarDays(logicalDate, -1);
    await recoverClosedOfflineDb(async () => {
      const [
        nextTasks,
        nextRoutines,
        nextAllRoutines,
        completions,
        nextPlan,
        sessions,
        nextGoals,
        nextWorkouts,
        nextWeights,
        prefs,
        nextProgress,
        nextPresence,
        nextInbox,
        nextSelf,
        nextCompass,
        nextOpen,
        priorPlan,
        nextDailyPlans,
        nextFocusHistory,
        nextCompanionEvents,
        nextRules,
        nextBlocks,
        nextGrants,
        nextStory,
        nextCircles,
        nextSocial,
      ] = await Promise.all([
        listLocalTasksForDate(userId, logicalDate),
        listLocalRoutines(userId, weekday),
        listLocalRoutines(userId),
        listLocalRoutineCompletions(userId, logicalDate),
        getLocalDailyPlan(userId, logicalDate),
        listLocalFocusSessions(userId, logicalDate),
        listLocalGoals(userId),
        listLocalWorkoutHistory(userId),
        listLocalWeightLogs(userId),
        getLocalDailyLoopPreferences(userId),
        getLocalCompanionProgression(userId),
        listLocalCompanionPresenceDates(userId),
        listLocalInboxItems(userId),
        getLocalFutureSelf(userId),
        getLocalCompass(userId),
        listLocalOpenTasks(userId),
        getLocalDailyPlan(userId, yesterday),
        listLocalDailyPlans(userId),
        listLocalFocusHistory(userId),
        listLocalCompanionEvents(userId),
        listLocalPersonalRules(userId),
        listLocalBusyBlocks(userId),
        getLocalActionGrants(userId),
        listLocalLifeStory(userId),
        listLocalCircles(userId),
        getLocalSocialPrefs(userId),
      ]);
      const nextMilestones = (
        await Promise.all(nextGoals.map((goal) => listLocalGoalMilestones(userId, goal.id)))
      ).flat();
      setTasks(nextTasks);
      setRoutines(nextRoutines);
      setAllRoutines(nextAllRoutines);
      setRoutineCompletions(completions);
      setPlan(nextPlan);
      setFocusSessions(sessions);
      setGoals(nextGoals);
      setGoalMilestones(nextMilestones);
      setWorkouts(nextWorkouts);
      setWeights(nextWeights);
      setPreferences(prefs);
      setProgress(nextProgress);
      setPresenceDates(nextPresence);
      setInboxItems(nextInbox);
      setFutureSelf(nextSelf);
      setCompass(nextCompass);
      setOpenTasks(nextOpen);
      setDailyPlans(nextDailyPlans);
      setFocusHistory(nextFocusHistory);
      setCompanionEvents(nextCompanionEvents);
      setPersonalRules(nextRules);
      setBusyBlocks(nextBlocks);
      setActionGrants(nextGrants);
      setStoryEntries(nextStory);
      setCircles(nextCircles);
      setSocialEnabled(nextSocial.enabled);
      setYesterdayNote(priorPlan?.tomorrow_note ?? null);
      setScripture(await listLocalScripture({ faithEnabled: prefs?.faith_enabled ?? false }));
    });
  }, [logicalDate, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    tasks,
    routines,
    allRoutines,
    routineCompletions,
    plan,
    setPlan,
    focusSessions,
    setFocusSessions,
    goals,
    goalMilestones,
    inboxItems,
    futureSelf,
    compass,
    openTasks,
    dailyPlans,
    focusHistory,
    companionEvents,
    personalRules,
    yesterdayNote,
    busyBlocks,
    actionGrants,
    setActionGrants,
    storyEntries,
    circles,
    socialEnabled,
    setSocialEnabled,
    workouts,
    weights,
    preferences,
    setPreferences,
    scripture,
    setScripture,
    progress,
    presenceDates,
    refresh,
  };
}
