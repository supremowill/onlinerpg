-- Survival 3D - Database Schema

CREATE TABLE IF NOT EXISTS ranking (
    id SERIAL PRIMARY KEY,
    player_name VARCHAR(15) NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    survival_time_seconds REAL NOT NULL DEFAULT 0,
    collapse_level INTEGER NOT NULL DEFAULT 0,
    kills INTEGER NOT NULL DEFAULT 0,
    room_id VARCHAR(36),
    players_in_room INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ranking_score ON ranking(score DESC);
CREATE INDEX idx_ranking_created_at ON ranking(created_at DESC);

-- Match history for tracking room results
CREATE TABLE IF NOT EXISTS match_history (
    id SERIAL PRIMARY KEY,
    room_id VARCHAR(36) NOT NULL,
    total_players INTEGER NOT NULL,
    total_time_seconds REAL NOT NULL,
    collapse_level INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_match_room ON match_history(room_id);

-- Players accounts table
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    username VARCHAR(15) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_players_username ON players(username);
