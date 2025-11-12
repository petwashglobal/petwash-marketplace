-- Walk Slot Holds Table (Uber-style payment flow)
-- CRITICAL: slot_id with unique constraint prevents double-booking
CREATE TABLE IF NOT EXISTS walk_slot_holds (
  hold_id VARCHAR(255) PRIMARY KEY,
  slot_id VARCHAR(255) NOT NULL, -- CRITICAL: Required for double-booking prevention
  user_id VARCHAR(255) NOT NULL,
  walker_id VARCHAR(255),
  expires_at TIMESTAMP NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  consumed_at TIMESTAMP
);

-- CRITICAL: Unique constraint on slot_id for active holds (prevents double-booking)
CREATE UNIQUE INDEX IF NOT EXISTS idx_walk_holds_unique_active_slot 
  ON walk_slot_holds(slot_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_walk_holds_expires ON walk_slot_holds(expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_walk_holds_user ON walk_slot_holds(user_id);
CREATE INDEX IF NOT EXISTS idx_walk_holds_status ON walk_slot_holds(status);
