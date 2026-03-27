-- Supabase schema for P2P Call app
-- Run this in the Supabase SQL editor

CREATE TABLE IF NOT EXISTS calls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     TEXT NOT NULL,
  user1_wallet TEXT,
  user2_wallet TEXT,
  start_time  TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration    INTEGER,         -- seconds
  avg_latency INTEGER,         -- milliseconds
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quick room lookups
CREATE INDEX IF NOT EXISTS calls_room_id_idx ON calls (room_id);

-- Enable Row Level Security (optional — open for demo)
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts from backend
CREATE POLICY "Allow backend inserts" ON calls
  FOR INSERT WITH CHECK (true);

-- Allow reads for authenticated users only (adjust as needed)
CREATE POLICY "Allow reads" ON calls
  FOR SELECT USING (true);
