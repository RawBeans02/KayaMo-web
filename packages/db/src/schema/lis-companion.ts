import { sql } from 'drizzle-orm';
import { check, pgTable, smallint, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, emptyTextArray, serverUpdatedAt, updatedAt } from './columns';

export const LIS_LANGUAGE_REGISTERS = ['english', 'taglish', 'match_me'] as const;
export type LisLanguageRegister = (typeof LIS_LANGUAGE_REGISTERS)[number];

/** Every dial is 0 / 1 / 2: low, balanced, high. */
export const LIS_DIALS = [
  'encouragement',
  'accountability',
  'humor',
  'proactivity',
] as const;
export type LisDial = (typeof LIS_DIALS)[number];

export const lisCompanionProfile = pgTable(
  'lis_companion_profile',
  {
    user_id: uuid('user_id').primaryKey(),
    display_name: text('display_name'),
    pronouns: text('pronouns'),
    language_register: text('language_register').notNull().default('match_me'),
    encouragement: smallint('encouragement').notNull().default(1),
    accountability: smallint('accountability').notNull().default(1),
    humor: smallint('humor').notNull().default(1),
    proactivity: smallint('proactivity').notNull().default(1),
    about_me: text('about_me'),
    avoid_topics: text('avoid_topics').array().notNull().default(emptyTextArray),
    provenance: text('provenance').notNull().default('user'),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
  },
  (table) => [
    check(
      'lis_companion_profile_register_check',
      sql`${table.language_register} in ('english', 'taglish', 'match_me')`,
    ),
    check(
      'lis_companion_profile_dials_check',
      sql`${table.encouragement} between 0 and 2 and ${table.accountability} between 0 and 2 and ${table.humor} between 0 and 2 and ${table.proactivity} between 0 and 2`,
    ),
    check('lis_companion_profile_avoid_count', sql`cardinality(${table.avoid_topics}) <= 10`),
  ],
);
