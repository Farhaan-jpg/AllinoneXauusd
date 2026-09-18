-- Cloudflare D1 Database Schema for Gold Intelligence Terminal
-- Designed for lightweight persistence strictly within Free limits (5GB storage, 5M reads/day)

CREATE TABLE IF NOT EXISTS user_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  default_timeframe TEXT NOT NULL DEFAULT '5m',
  sound_enabled INTEGER NOT NULL DEFAULT 1,
  telegram_chat_id TEXT,
  telegram_bot_token TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL, -- 'PRICE_LEVEL', 'STRUCTURE_BREAK', 'ZONE_ENTER', 'VOLUME_SPIKE'
  target_value TEXT NOT NULL,
  condition TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  last_triggered INTEGER
);

CREATE TABLE IF NOT EXISTS alert_events (
  id TEXT PRIMARY KEY,
  rule_id TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  level TEXT NOT NULL, -- 'info', 'warning', 'critical'
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (rule_id) REFERENCES alerts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS zones (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'Pullback Zone', 'Reversal Zone'
  price_min REAL NOT NULL,
  price_max REAL NOT NULL,
  strength TEXT NOT NULL, -- 'HIGH', 'MEDIUM', 'LOW'
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'TESTED', 'INVALIDATED'
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_status (
  provider_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  last_updated INTEGER NOT NULL,
  details TEXT
);
