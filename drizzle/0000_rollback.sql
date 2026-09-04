-- Hand-authored rollback for drizzle/0000_friendly_zzzax.sql.
--
-- drizzle-kit does not generate down migrations. This is the first
-- migration against an empty Neon database, so rollback is lossless
-- (design §8, Rollback Plan). From change 2 onward this rollback path is
-- void; only expand-contract applies once real household data exists.
DROP TABLE card_order, budgets, transactions, categories, members;
DROP TYPE transaction_type, category_kind;
