"use server"

import { supabase } from "./supabase";
import { BacktestEngine, OHLC } from "./backtest-engine";
import { calculateProfit, TradeType } from "./trade-utils";

/* ============================================================
   AUTOMATED BACKTEST (legacy)
   ============================================================ */
export async function runStrategyBacktest(strategyId: string, symbolId: string, timeframe: string) {
  try {
    const { data: ohlcData, error: ohlcError } = await supabase
      .from('ohlc_data').select('*').eq('symbol_id', symbolId).eq('timeframe', timeframe).order('timestamp', { ascending: true });
    if (ohlcError || !ohlcData || ohlcData.length === 0) throw new Error("Failed to fetch OHLC data");
    const { data: strategy, error: stratError } = await supabase.from('strategies').select('*').eq('id', strategyId).single();
    if (stratError || !strategy) throw new Error("Failed to fetch Strategy");
    const initialBalance = strategy.risk_config?.initialBalance || 1000;
    const engine = new BacktestEngine(initialBalance);
    const result = engine.run(ohlcData as any as OHLC[], strategy.parameters);
    const { data: backtest, error: btError } = await supabase.from('backtests').insert({
      strategy_id: strategyId, symbol_id: symbolId, start_date: ohlcData[0].timestamp, end_date: ohlcData[ohlcData.length - 1].timestamp,
      initial_balance: initialBalance, final_balance: result.netProfit + initialBalance, net_profit: result.netProfit,
      total_trades: result.totalTrades, win_rate: result.winRate, max_drawdown: result.maxDrawdown, profit_factor: result.profitFactor, status: 'completed'
    }).select().single();
    if (btError) throw btError;
    const tradeInserts = result.trades.map((t: any) => ({ backtest_id: backtest.id, type: t.type, entry_time: t.entryTime.toISOString(), exit_time: t.exitTime?.toISOString(), entry_price: t.entryPrice, exit_price: t.exitPrice, profit_loss: t.profit, profit_loss_pct: t.profitPct }));
    const equityInserts = result.equityCurve.map((e: any) => ({ backtest_id: backtest.id, timestamp: e.timestamp, balance: e.balance }));
    if (tradeInserts.length > 0) await supabase.from('trades').insert(tradeInserts);
    if (equityInserts.length > 0) await supabase.from('equity_curve').insert(equityInserts);
    return { success: true, backtestId: backtest.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/* ============================================================
   MANUAL BACKTEST: Dapatkan atau buat sesi backtest
   Setiap sesi unik per: strategy × symbol × timeframe × year
   ============================================================ */
async function getOrCreateSession(data: {
  strategyId: string; symbol: string; timeframe: string; testYear: string; description?: string;
}) {
  // Cari sesi yang sudah ada
  let { data: backtest } = await supabase
    .from('backtests').select('*')
    .eq('strategy_id', data.strategyId)
    .eq('status', 'manual')
    .eq('symbol', data.symbol)
    .eq('timeframe', data.timeframe)
    .eq('test_year', data.testYear)
    .single();

  if (!backtest) {
    const { data: newBt, error } = await supabase
      .from('backtests').insert({
        strategy_id: data.strategyId, status: 'manual', symbol: data.symbol,
        timeframe: data.timeframe, test_year: data.testYear,
        description: data.description || '', initial_balance: 1000, net_profit: 0, total_trades: 0, win_rate: 0
      }).select().single();
    if (error) throw error;
    backtest = newBt;
  }
  return backtest;
}

/* ============================================================
   Recalculate aggregat stats setelah trade baru
   ============================================================ */
async function recalcSessionStats(backtestId: string, initialBalance: number) {
  const { data: allTrades } = await supabase
    .from('trades').select('profit_loss').eq('backtest_id', backtestId);
  if (!allTrades || allTrades.length === 0) return;

  const profits = allTrades.map(t => t.profit_loss || 0);
  const wins = profits.filter(p => p > 0);
  const losses = profits.filter(p => p < 0);
  const netProfit = profits.reduce((s, p) => s + p, 0);
  const winRate = (wins.length / allTrades.length) * 100;
  const avgWin = wins.length > 0 ? wins.reduce((s, p) => s + p, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, p) => s + p, 0) / losses.length) : 0;
  const totalWin = wins.reduce((s, p) => s + p, 0);
  const totalLoss = Math.abs(losses.reduce((s, p) => s + p, 0));
  const profitFactor = totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? 999 : 0;

  await supabase.from('backtests').update({
    net_profit: netProfit, total_trades: allTrades.length, win_rate: winRate,
    final_balance: initialBalance + netProfit, avg_win: avgWin, avg_loss: avgLoss, profit_factor: profitFactor
  }).eq('id', backtestId);

  // Equity curve point
  await supabase.from('equity_curve').insert({
    backtest_id: backtestId, timestamp: new Date().toISOString(), balance: initialBalance + netProfit
  });
}

/* ============================================================
   QUICK TRADE (Speed Mode)
   ============================================================ */
export async function saveQuickTrade(data: {
  strategyId: string; symbol: string; timeframe: string; testYear: string;
  result: 'win' | 'loss'; amount: number; direction: 'long' | 'short';
  confirmationsMet?: boolean[]; entryReason?: string; executionFactor?: string;
  setupType?: string; marketSession?: string; obstacles?: string; notes?: string;
  description?: string;
}) {
  try {
    const backtest = await getOrCreateSession({
      strategyId: data.strategyId, symbol: data.symbol,
      timeframe: data.timeframe, testYear: data.testYear, description: data.description
    });

    const profit = data.result === 'win' ? Math.abs(data.amount) : -Math.abs(data.amount);

    const { error: tradeError } = await supabase.from('trades').insert({
      backtest_id: backtest.id, type: data.direction,
      entry_time: new Date().toISOString(), entry_price: 0, exit_price: 0,
      profit_loss: profit, notes: data.notes,
      confirmations_met: data.confirmationsMet || null,
      entry_reason: data.entryReason || null,
      execution_factor: data.executionFactor || null,
      setup_type: data.setupType || null,
      market_session: data.marketSession || null,
      trade_direction: data.direction,
    });
    if (tradeError) throw tradeError;

    await recalcSessionStats(backtest.id, backtest.initial_balance || 1000);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/* ============================================================
   PRO TRADE (Professional Mode — dengan harga)
   ============================================================ */
export async function saveManualTrade(data: {
  strategyId: string; symbol: string; timeframe: string; testYear: string;
  type: TradeType; entry: number; exit: number; lots: number;
  confirmationsMet?: boolean[]; entryReason?: string; executionFactor?: string;
  setupType?: string; marketSession?: string; obstacles?: string;
  notes?: string; imageUrl?: string; description?: string;
}) {
  try {
    const backtest = await getOrCreateSession({
      strategyId: data.strategyId, symbol: data.symbol,
      timeframe: data.timeframe, testYear: data.testYear, description: data.description
    });

    const { profit, pips } = calculateProfit(data.symbol, data.type, data.entry, data.exit, data.lots);

    const { error: tradeError } = await supabase.from('trades').insert({
      backtest_id: backtest.id, type: data.type,
      entry_time: new Date().toISOString(), exit_time: new Date().toISOString(),
      entry_price: data.entry, exit_price: data.exit,
      profit_loss: profit, notes: data.notes, image_url: data.imageUrl,
      confirmations_met: data.confirmationsMet || null,
      entry_reason: data.entryReason || null,
      execution_factor: data.executionFactor || null,
      setup_type: data.setupType || null,
      market_session: data.marketSession || null,
      trade_direction: data.type,
    });
    if (tradeError) throw tradeError;

    await recalcSessionStats(backtest.id, backtest.initial_balance || 1000);
    return { success: true, profit, pips };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/* ============================================================
   END SESSION — Simpan kesimpulan dan kendala
   ============================================================ */
export async function updateSessionSummary(backtestId: string, summary: string, obstacles: string) {
  try {
    await supabase.from('backtests').update({
      session_summary: summary, obstacles: obstacles
    }).eq('id', backtestId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/* ============================================================
   DATA QUERIES
   ============================================================ */

// Ambil performa strategi dengan filter
export async function getStrategyPerformance(strategyId: string, filters?: { year?: string; symbol?: string; timeframe?: string }) {
  try {
    let query = supabase.from('backtests').select('id, symbol, timeframe, test_year, net_profit, total_trades, win_rate, avg_win, avg_loss, profit_factor, description, session_summary, obstacles, created_at')
      .eq('strategy_id', strategyId).eq('status', 'manual');
    if (filters?.year) query = query.eq('test_year', filters.year);
    if (filters?.symbol) query = query.eq('symbol', filters.symbol);
    if (filters?.timeframe) query = query.eq('timeframe', filters.timeframe);

    const { data: sessions } = await query.order('created_at', { ascending: false });
    if (!sessions || sessions.length === 0) return { sessions: [], trades: [] };

    const btIds = sessions.map(s => s.id);
    const { data: trades } = await supabase.from('trades')
      .select('*').in('backtest_id', btIds).order('entry_time', { ascending: false });

    return { sessions, trades: trades || [] };
  } catch (error) {
    return { sessions: [], trades: [] };
  }
}

// Sesi terakhir untuk dashboard feed
export async function getRecentSessions(limit: number = 5) {
  try {
    const { data } = await supabase.from('backtests')
      .select('*, strategies(name)').eq('status', 'manual')
      .order('created_at', { ascending: false }).limit(limit);
    return data || [];
  } catch (error) {
    return [];
  }
}

// Ambil stats terakhir (legacy)
export async function getLatestBacktestStats(strategyId?: string) {
  try {
    let query = supabase.from('backtests').select('*').order('created_at', { ascending: false }).limit(1);
    if (strategyId) query = query.eq('strategy_id', strategyId);
    const { data, error } = await query.single();
    if (error) return null;
    return data;
  } catch { return null; }
}

// Equity curve data
export async function getEquityCurveData(backtestId: string) {
  try {
    const { data } = await supabase.from('equity_curve')
      .select('timestamp, balance').eq('backtest_id', backtestId).order('timestamp', { ascending: true });
    return data || [];
  } catch { return []; }
}
