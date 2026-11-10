CREATE TABLE IF NOT EXISTS pending_orders (
  order_id TEXT PRIMARY KEY,
  amount TEXT NOT NULL,
  items_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS paid_orders (
  order_id TEXT PRIMARY KEY,
  capture_id TEXT NOT NULL UNIQUE,
  amount TEXT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  items_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_paid_orders_created_at ON paid_orders(created_at);
