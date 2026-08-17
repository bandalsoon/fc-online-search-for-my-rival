CREATE TABLE IF NOT EXISTS rivalry_matches (
  match_id TEXT PRIMARY KEY,
  match_date TEXT NOT NULL,
  match_type INTEGER NOT NULL,
  home_ouid TEXT NOT NULL,
  rival_ouid TEXT NOT NULL,
  raw_detail TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  last_verified_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rivalry_pair_date
ON rivalry_matches(home_ouid, rival_ouid, match_date DESC);

