-- Hand-authored rollback for drizzle/0002_transaction_description.sql.
-- Run ONLY after production runs a build that does not read `description`.
-- Permanently discards every note entered since the deploy.
-- Additive migration: no other table, column, index or default is touched.
ALTER TABLE transactions DROP COLUMN IF EXISTS description;
-- Lets the migrator re-apply 0002 later. The value is the `when` of the
-- 0002 entry in drizzle/meta/_journal.json (drizzle-orm stores it as created_at
-- in drizzle.__drizzle_migrations).
DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1795466097898;
