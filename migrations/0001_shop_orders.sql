CREATE TABLE IF NOT EXISTS shop_orders (
  session_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL,
  price_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount > 0),
  currency TEXT NOT NULL,
  delivery_key TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','paid')),
  event_id TEXT,
  created_at INTEGER NOT NULL,
  paid_at INTEGER
);
