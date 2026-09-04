CREATE TYPE "public"."category_kind" AS ENUM('expense', 'income');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('expense', 'income');--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "budgets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text DEFAULT 'household' NOT NULL,
	"month" char(7) NOT NULL,
	"category_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires') NOT NULL,
	CONSTRAINT "budgets_amount_nonnegative_check" CHECK ("budgets"."amount" >= 0),
	CONSTRAINT "budgets_month_format_check" CHECK ("budgets"."month" ~ '^\d{4}-\d{2}$')
);
--> statement-breakpoint
CREATE TABLE "card_order" (
	"user_id" text DEFAULT 'household' NOT NULL,
	"category_id" integer NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "card_order_user_id_category_id_pk" PRIMARY KEY("user_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text DEFAULT 'household' NOT NULL,
	"name" text NOT NULL,
	"kind" "category_kind" NOT NULL,
	"icon" text DEFAULT 'tag' NOT NULL,
	"color_index" smallint NOT NULL,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires') NOT NULL,
	CONSTRAINT "categories_color_index_check" CHECK ("categories"."color_index" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "members_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text DEFAULT 'household' NOT NULL,
	"name" text NOT NULL,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text DEFAULT 'household' NOT NULL,
	"member_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"type" "transaction_type" NOT NULL,
	"amount" integer NOT NULL,
	"gross" integer NOT NULL,
	"cashback_bps" smallint DEFAULT 0 NOT NULL,
	"date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires') NOT NULL,
	CONSTRAINT "transactions_amount_nonnegative_check" CHECK ("transactions"."amount" >= 0),
	CONSTRAINT "transactions_gross_nonnegative_check" CHECK ("transactions"."gross" >= 0),
	CONSTRAINT "transactions_cashback_bps_range_check" CHECK ("transactions"."cashback_bps" BETWEEN 0 AND 10000),
	CONSTRAINT "transactions_income_no_cashback_check" CHECK ("transactions"."type" <> 'income' OR "transactions"."cashback_bps" = 0),
	CONSTRAINT "transactions_amount_lte_gross_check" CHECK ("transactions"."amount" <= "transactions"."gross")
);
--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_order" ADD CONSTRAINT "card_order_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "budgets_month_category_uq" ON "budgets" USING btree ("user_id","month","category_id");--> statement-breakpoint
CREATE INDEX "card_order_position_idx" ON "card_order" USING btree ("user_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_active_name_uq" ON "categories" USING btree ("user_id","kind","name") WHERE "categories"."archived_at" IS NULL;--> statement-breakpoint
CREATE INDEX "categories_active_kind_idx" ON "categories" USING btree ("user_id","kind") WHERE "categories"."archived_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "members_active_name_uq" ON "members" USING btree ("user_id","name") WHERE "members"."archived_at" IS NULL;--> statement-breakpoint
CREATE INDEX "members_active_idx" ON "members" USING btree ("user_id") WHERE "members"."archived_at" IS NULL;--> statement-breakpoint
CREATE INDEX "transactions_month_idx" ON "transactions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "transactions_category_month_idx" ON "transactions" USING btree ("user_id","category_id","date");