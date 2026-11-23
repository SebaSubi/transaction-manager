-- Hand-authored rollback for drizzle/0001_amounts_to_cents.sql.
--
-- Run ONLY after production runs a build that reads amounts as whole pesos.
-- Divides every money column by 100, rounding to the nearest peso (cents are
-- permanently lost), then narrows the columns back to integer. The
-- `amount <= gross` check survives because rounding is monotonic.
BEGIN;
UPDATE budgets SET amount = ROUND(amount / 100.0);
UPDATE transactions SET amount = ROUND(amount / 100.0), gross = ROUND(gross / 100.0);
ALTER TABLE budgets ALTER COLUMN amount SET DATA TYPE integer;
ALTER TABLE transactions ALTER COLUMN amount SET DATA TYPE integer;
ALTER TABLE transactions ALTER COLUMN gross SET DATA TYPE integer;
-- Lets the migrator re-apply 0001 later. The value is the `when` of the
-- 0001 entry in drizzle/meta/_journal.json (drizzle-orm stores it as created_at
-- in drizzle.__drizzle_migrations).
DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1795465904750;
COMMIT;
