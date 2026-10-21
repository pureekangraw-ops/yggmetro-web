-- Durable intent exists before a provider call. Never retry an old unknown intent as a new purchase.
CREATE TABLE IF NOT EXISTS shop_checkout_attempts (
 request_id TEXT PRIMARY KEY,
 token_hash TEXT NOT NULL,
 parameters TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
