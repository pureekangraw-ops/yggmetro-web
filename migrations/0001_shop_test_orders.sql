CREATE TABLE IF NOT EXISTS shop_test_orders (
  id TEXT PRIMARY KEY,
  access_token_sha256 TEXT NOT NULL UNIQUE,
  fixture_sku TEXT NOT NULL CHECK (fixture_sku = 'stripe-test-digital-fixture'),
  amount INTEGER NOT NULL CHECK (amount = 100),
  currency TEXT NOT NULL CHECK (currency = 'usd'),
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'cancelled', 'failed')),
  stripe_payment_status TEXT,
  stripe_checkout_session_id TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT,
  delivered_at TEXT
);

CREATE TABLE IF NOT EXISTS shop_test_stripe_events (
  stripe_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  order_id TEXT NOT NULL REFERENCES shop_test_orders(id),
  received_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shop_test_orders_status_created
  ON shop_test_orders(status, created_at);
