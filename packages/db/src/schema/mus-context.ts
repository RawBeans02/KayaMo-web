import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, serverUpdatedAt, updatedAt } from './columns';

export const MUS_CONTEXT_DOMAINS = [
  'goals_planning',
  'physical_self',
  'memory',
  'faith',
  'identity',
] as const;
export type MusContextDomain = (typeof MUS_CONTEXT_DOMAINS)[number];

export const musContextPermissions = pgTable(
  'mus_context_permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    domain: text('domain').notNull(),
    allowed: boolean('allowed').notNull().default(false),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
  },
  (table) => [
    uniqueIndex('mus_context_permissions_user_domain_uidx').on(
      table.user_id,
      table.domain,
    ),
    index('mus_context_permissions_server_updated_at_idx').on(table.server_updated_at),
    check(
      'mus_context_permissions_domain_check',
      sql`${table.domain} in ('goals_planning', 'physical_self', 'memory', 'faith', 'identity')`,
    ),
  ],
);
