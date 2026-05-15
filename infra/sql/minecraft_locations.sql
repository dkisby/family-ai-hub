-- Minecraft Location Memory System
-- Single table with world_id (Option B)
-- Run this once against your PostgreSQL database to set up the schema.

CREATE TABLE IF NOT EXISTS minecraft_locations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id    VARCHAR     NOT NULL,
  name        VARCHAR,
  category    VARCHAR     NOT NULL CHECK (category IN ('shelter','bed','house','village','cave','poi','noi')),
  x           INTEGER     NOT NULL,
  y           INTEGER     NOT NULL,
  z           INTEGER     NOT NULL,
  dimension   VARCHAR     NOT NULL DEFAULT 'overworld'
                          CHECK (dimension IN ('overworld','nether','end')),
  comment     TEXT        NOT NULL,
  created_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_minecraft_locations_world_id  ON minecraft_locations (world_id);
CREATE INDEX IF NOT EXISTS idx_minecraft_locations_category  ON minecraft_locations (category);
CREATE INDEX IF NOT EXISTS idx_minecraft_locations_xz        ON minecraft_locations (x, z);
