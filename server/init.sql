-- Survival 3D - Database Schema (Updated for player accounts)

-- Players accounts table
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_players_username ON players(username);

-- Ranking table (references players table)
CREATE TABLE IF NOT EXISTS ranking (
    player_id INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    max_kills INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Match history for tracking player results
CREATE TABLE IF NOT EXISTS match_history (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    result VARCHAR(10) CHECK (result IN ('win', 'loss')),
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    duration INTEGER,
    played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ranking_wins ON ranking(wins DESC);
CREATE INDEX IF NOT EXISTS idx_match_history_player ON match_history(player_id);
