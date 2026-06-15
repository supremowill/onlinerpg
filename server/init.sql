-- Survival 3D - Database Schema (Updated for player accounts)

-- Players accounts table
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    coins INTEGER DEFAULT 0,
    inventory JSONB DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_players_username ON players(username);

-- Ranking table (matches what RankingService expects)
CREATE TABLE IF NOT EXISTS ranking (
    id SERIAL PRIMARY KEY,
    player_name VARCHAR(50) NOT NULL,
    score INTEGER DEFAULT 0,
    survival_time_seconds INTEGER DEFAULT 0,
    collapse_level INTEGER DEFAULT 0,
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    assists INTEGER DEFAULT 0,
    room_id VARCHAR(255),
    players_in_room INTEGER DEFAULT 0,
    build_color VARCHAR(20) DEFAULT 'red',
    build_floor1 INTEGER DEFAULT 0,
    build_floor2 INTEGER DEFAULT 0,
    build_floor3 INTEGER DEFAULT 0,
    build_floor4 INTEGER DEFAULT 0,
    build_floor5 INTEGER DEFAULT 0,
    death_report JSONB,
    damage_analysis JSONB,
    damage_dealt_analysis JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ranking_score ON ranking(score DESC);
CREATE INDEX IF NOT EXISTS idx_ranking_created_at ON ranking(created_at DESC);

-- Match history for tracking player results
CREATE TABLE IF NOT EXISTS match_history (
    id SERIAL PRIMARY KEY,
    room_id VARCHAR(36) NOT NULL,
    total_players INTEGER NOT NULL,
    total_time_seconds REAL NOT NULL,
    collapse_level INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_room ON match_history(room_id);

-- P2P Market offers table
CREATE TABLE IF NOT EXISTS market_offers (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER NOT NULL,
    seller_name VARCHAR(50) NOT NULL,
    item_id VARCHAR(50) NOT NULL,
    price INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_seller ON market_offers(seller_id);

-- Weekly ranking awards history
CREATE TABLE IF NOT EXISTS weekly_awards (
    id SERIAL PRIMARY KEY,
    week_id VARCHAR(40) UNIQUE NOT NULL,
    week_start TIMESTAMP WITH TIME ZONE NOT NULL,
    week_end TIMESTAMP WITH TIME ZONE NOT NULL,
    winner_player_id INTEGER,
    winner_name VARCHAR(50),
    avg_score NUMERIC(12, 1),
    top10_sum INTEGER,
    best_score INTEGER,
    total_valid_matches INTEGER,
    best_score_at TIMESTAMP WITH TIME ZONE,
    item_id VARCHAR(80),
    item_name VARCHAR(120),
    item_rarity VARCHAR(30),
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    news_entry_id VARCHAR(60),
    news_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_awards_week ON weekly_awards(week_start DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_awards_status ON weekly_awards(status);

