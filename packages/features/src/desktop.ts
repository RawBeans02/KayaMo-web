/**
 * The web app's entry into @kayamo/features. Root code imports from here and
 * never from the main barrel: that barrel re-exports the phone screens
 * (HomeScreen, MusHabitat, DayStrip and their 4,817-line stylesheet), and a
 * client import of it pulls all of that into every route's graph even when
 * nothing renders it. A test under src/lib pins the rule.
 */
// Shell plumbing the root app composes.
export { SyncStatusBar } from './sync/sync-status-bar';
export { configureApiClient } from './api/api-origin';
export { installDemoCatalog } from './food/demo-catalog';
export { LOCAL_DEV_EMAIL } from './auth/local-dev';
export { LoginForm } from './auth/login-form';

export {
  DESK_LOCALES,
  readDeskLocale,
  setDeskLocale,
  toggleDeskLocale,
  useDeskLocale,
} from './i18n/desk-locale';
export { CommandLog } from './food/command-log';
export { OPEN_LOG_EVENT, PREFILL_LOG_EVENT, prefillLogPalette } from './food/command-log-model';
export { ConversationalLog } from './food/conversational-log';
export { TodayTable } from './food/today-table';
export { FoodsTable } from './food/foods-table';
export { VerifyTable } from './food/verify-table';
export { DeskHome } from './desk/desk-home';
export { BotanicalIcon, type BotanicalIconName } from './botanical/icons';
export { BotanicalHome } from './botanical/home';
export { BotanicalGoals } from './botanical/goals';
export { BotanicalLife } from './botanical/life';
export { BotanicalGrove } from './botanical/grove';
export { GymDesk } from './desk/gym-desk';
export { TodosDesk } from './desk/todos-desk';
export { MusDesk } from './desk/mus-desk';
export { MusRail } from './desk/mus-rail';
export { GymSessionProvider } from './desk/gym-session-provider';
export { GymRestBar } from './desk/gym-rest';
