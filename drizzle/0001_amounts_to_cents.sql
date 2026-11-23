ALTER TABLE "budgets" ALTER COLUMN "amount" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "amount" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "gross" SET DATA TYPE bigint;--> statement-breakpoint
-- Hand-edited: existing whole-peso values become integer cents (x100).
-- Columns are widened to bigint first so x100 cannot overflow int4.
UPDATE "budgets" SET "amount" = "amount" * 100;--> statement-breakpoint
UPDATE "transactions" SET "amount" = "amount" * 100, "gross" = "gross" * 100;
