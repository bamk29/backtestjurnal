-- Migration: Upgrade backtests & trades untuk Manual Backtesting Journal
-- Menambahkan konteks sesi, metrik eksekusi, dan data konfirmasi

-- 1. Kolom konteks sesi pada backtests
ALTER TABLE backtests ADD COLUMN IF NOT EXISTS symbol TEXT;
ALTER TABLE backtests ADD COLUMN IF NOT EXISTS timeframe TEXT;
ALTER TABLE backtests ADD COLUMN IF NOT EXISTS test_year TEXT;
ALTER TABLE backtests ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE backtests ADD COLUMN IF NOT EXISTS session_summary TEXT;
ALTER TABLE backtests ADD COLUMN IF NOT EXISTS obstacles TEXT;
ALTER TABLE backtests ADD COLUMN IF NOT EXISTS avg_win NUMERIC DEFAULT 0;
ALTER TABLE backtests ADD COLUMN IF NOT EXISTS avg_loss NUMERIC DEFAULT 0;

-- 2. Kolom data per trade
ALTER TABLE trades ADD COLUMN IF NOT EXISTS confirmations_met JSONB;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS entry_reason TEXT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS execution_factor TEXT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS setup_type TEXT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS market_session TEXT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS trade_direction TEXT;
