import { sql } from "drizzle-orm";
import {
  char,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// A bare `now()` yields `timestamptz`; casting it to `timestamp` silently
// stores UTC wall-clock and reintroduces the "server now" latent bug at the
// database layer. This explicit zone conversion makes the DB default agree
// with `nowInBuenosAires()` (design §1, cross-cutting column conventions).
const nowInBuenosAiresSql = sql`(now() AT TIME ZONE 'America/Argentina/Buenos_Aires')`;

export const categoryKind = pgEnum("category_kind", ["expense", "income"]);
export const transactionType = pgEnum("transaction_type", ["expense", "income"]);

export const members = pgTable(
  "members",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    // Auth-scoping column, constant default. Not a person — see member_id
    // below for the household member. openspec/config.yaml, design §1.
    userId: text("user_id").notNull().default("household"),
    name: text("name").notNull(),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").notNull().default(nowInBuenosAiresSql),
  },
  (table) => [
    // Two ACTIVE members cannot share a name; archiving "Mati" must not
    // block re-adding "Mati" later.
    uniqueIndex("members_active_name_uq")
      .on(table.userId, table.name)
      .where(sql`${table.archivedAt} IS NULL`),
    // The picker read path.
    index("members_active_idx")
      .on(table.userId)
      .where(sql`${table.archivedAt} IS NULL`),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id").notNull().default("household"),
    name: text("name").notNull(),
    kind: categoryKind("kind").notNull(),
    icon: text("icon").notNull().default("tag"),
    colorIndex: smallint("color_index").notNull(),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").notNull().default(nowInBuenosAiresSql),
  },
  (table) => [
    check("categories_color_index_check", sql`${table.colorIndex} BETWEEN 0 AND 5`),
    uniqueIndex("categories_active_name_uq")
      .on(table.userId, table.kind, table.name)
      .where(sql`${table.archivedAt} IS NULL`),
    // The picker read: `WHERE kind = :type AND archived_at IS NULL`.
    index("categories_active_kind_idx")
      .on(table.userId, table.kind)
      .where(sql`${table.archivedAt} IS NULL`),
  ],
);

export const transactions = pgTable(
  "transactions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id").notNull().default("household"),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    type: transactionType("type").notNull(),
    // Net, whole ARS pesos.
    amount: integer("amount").notNull(),
    // Original (pre-cashback), whole ARS pesos.
    gross: integer("gross").notNull(),
    // Cashback RATE in basis points (0..10000), never money. See design §1
    // for the numeric(5,2)/real/smallint-percent rejection rationale.
    cashbackBps: smallint("cashback_bps").notNull().default(0),
    // Buenos Aires wall-clock; see the module-level timestamp comment.
    date: timestamp("date").notNull(),
    createdAt: timestamp("created_at").notNull().default(nowInBuenosAiresSql),
  },
  (table) => [
    check("transactions_amount_nonnegative_check", sql`${table.amount} >= 0`),
    check("transactions_gross_nonnegative_check", sql`${table.gross} >= 0`),
    check(
      "transactions_cashback_bps_range_check",
      sql`${table.cashbackBps} BETWEEN 0 AND 10000`,
    ),
    // Cashback applies to expenses only (obs #59), enforced in the
    // database, not only in computeNetAmount.
    check(
      "transactions_income_no_cashback_check",
      sql`${table.type} <> 'income' OR ${table.cashbackBps} = 0`,
    ),
    check("transactions_amount_lte_gross_check", sql`${table.amount} <= ${table.gross}`),
    // Serves `WHERE user_id = $1 AND date >= $2 AND date < $3` for the
    // Movimientos list and month totals. Half-open range, no LIKE anywhere.
    index("transactions_month_idx").on(table.userId, table.date),
    // Serves spentForCategory's per-category month scan without touching
    // the table for the filter.
    index("transactions_category_month_idx").on(table.userId, table.categoryId, table.date),
  ],
);

export const budgets = pgTable(
  "budgets",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id").notNull().default("household"),
    // 'YYYY-MM', fixed-width so lexicographic order IS chronological order.
    // Byte-identical to the monthKey already flowing through URL search
    // params and lib/domain/month.ts. Never a `date` column — see design §1.
    month: char("month", { length: 7 }).notNull(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at").notNull().default(nowInBuenosAiresSql),
    updatedAt: timestamp("updated_at").notNull().default(nowInBuenosAiresSql),
  },
  (table) => [
    check("budgets_amount_nonnegative_check", sql`${table.amount} >= 0`),
    check("budgets_month_format_check", sql`${table.month} ~ '^\\d{4}-\\d{2}$'`),
    // Also the read index: its (user_id, month) prefix serves the whole-
    // month fetch, so no additional index is created.
    uniqueIndex("budgets_month_category_uq").on(table.userId, table.month, table.categoryId),
  ],
);

export const cardOrder = pgTable(
  "card_order",
  {
    userId: text("user_id").notNull().default("household"),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    // 0-based.
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.categoryId] }),
    // No unique constraint on position: reorder writes would need a
    // deferrable constraint to pass. Reads use ORDER BY position,
    // category_id so ties stay deterministic.
    index("card_order_position_idx").on(table.userId, table.position),
  ],
);
