/**
 * Konstanta untuk seluruh aplikasi Manual Backtesting
 * Single source of truth untuk pairs, timeframes, setup types, dll.
 */

// Daftar instrumen trading (grouped)
export const INSTRUMENT_GROUPS = [
  {
    label: "Metals",
    items: [
      { value: "XAUUSD", label: "XAUUSD", desc: "Gold" },
      { value: "XAGUSD", label: "XAGUSD", desc: "Silver" },
    ]
  },
  {
    label: "Major Pairs",
    items: [
      { value: "EURUSD", label: "EURUSD", desc: "Euro/Dollar" },
      { value: "GBPUSD", label: "GBPUSD", desc: "Pound/Dollar" },
      { value: "USDJPY", label: "USDJPY", desc: "Dollar/Yen" },
      { value: "USDCHF", label: "USDCHF", desc: "Dollar/Franc" },
      { value: "AUDUSD", label: "AUDUSD", desc: "Aussie/Dollar" },
      { value: "NZDUSD", label: "NZDUSD", desc: "Kiwi/Dollar" },
      { value: "USDCAD", label: "USDCAD", desc: "Dollar/Loonie" },
    ]
  },
  {
    label: "Cross Pairs",
    items: [
      { value: "GBPJPY", label: "GBPJPY", desc: "Pound/Yen" },
      { value: "EURJPY", label: "EURJPY", desc: "Euro/Yen" },
      { value: "EURGBP", label: "EURGBP", desc: "Euro/Pound" },
      { value: "AUDJPY", label: "AUDJPY", desc: "Aussie/Yen" },
      { value: "CADJPY", label: "CADJPY", desc: "Loonie/Yen" },
      { value: "CHFJPY", label: "CHFJPY", desc: "Franc/Yen" },
      { value: "EURAUD", label: "EURAUD", desc: "Euro/Aussie" },
      { value: "GBPAUD", label: "GBPAUD", desc: "Pound/Aussie" },
      { value: "GBPCAD", label: "GBPCAD", desc: "Pound/Loonie" },
      { value: "EURNZD", label: "EURNZD", desc: "Euro/Kiwi" },
      { value: "GBPNZD", label: "GBPNZD", desc: "Pound/Kiwi" },
    ]
  },
  {
    label: "Indices",
    items: [
      { value: "NAS100", label: "NAS100", desc: "Nasdaq 100" },
      { value: "US30", label: "US30", desc: "Dow Jones" },
      { value: "SPX500", label: "SPX500", desc: "S&P 500" },
    ]
  },
  {
    label: "Crypto",
    items: [
      { value: "BTCUSD", label: "BTCUSD", desc: "Bitcoin" },
      { value: "ETHUSD", label: "ETHUSD", desc: "Ethereum" },
    ]
  },
] as const

// Flat list untuk lookup cepat
export const ALL_PAIRS = INSTRUMENT_GROUPS.flatMap(g => g.items)

// Timeframes
export const TIMEFRAMES = [
  { value: "M1", label: "M1", desc: "1 Minute" },
  { value: "M5", label: "M5", desc: "5 Minutes" },
  { value: "M15", label: "M15", desc: "15 Minutes" },
  { value: "M30", label: "M30", desc: "30 Minutes" },
  { value: "H1", label: "H1", desc: "1 Hour" },
  { value: "H4", label: "H4", desc: "4 Hours" },
  { value: "D1", label: "D1", desc: "Daily" },
  { value: "W1", label: "W1", desc: "Weekly" },
  { value: "MN", label: "MN", desc: "Monthly" },
] as const

// Setup Types
export const SETUP_TYPES = [
  { value: "reversal", label: "Reversal", emoji: "🔄" },
  { value: "continuation", label: "Continuation", emoji: "➡️" },
  { value: "breakout", label: "Breakout", emoji: "💥" },
  { value: "retest", label: "Retest", emoji: "🔁" },
  { value: "pullback", label: "Pullback", emoji: "↩️" },
  { value: "scalp", label: "Scalp", emoji: "⚡" },
  { value: "swing", label: "Swing", emoji: "🌊" },
] as const

// Market Sessions
export const MARKET_SESSIONS = [
  { value: "asian", label: "Asian", emoji: "🌏", time: "00:00–08:00 GMT" },
  { value: "london", label: "London", emoji: "🇬🇧", time: "08:00–16:00 GMT" },
  { value: "new_york", label: "New York", emoji: "🇺🇸", time: "13:00–21:00 GMT" },
  { value: "overlap", label: "LDN/NY Overlap", emoji: "🔥", time: "13:00–16:00 GMT" },
] as const

// Execution Factors (kondisi psikologis/teknis)
export const EXECUTION_FACTORS = [
  { value: "rules", label: "Sesuai Rules", emoji: "✅", color: "text-emerald-500" },
  { value: "fomo", label: "FOMO", emoji: "😤", color: "text-amber-500" },
  { value: "revenge", label: "Revenge Trade", emoji: "🔥", color: "text-rose-500" },
  { value: "overleverage", label: "Over-leverage", emoji: "⚠️", color: "text-rose-500" },
  { value: "news", label: "News Impact", emoji: "📰", color: "text-blue-500" },
  { value: "early_entry", label: "Early Entry", emoji: "⏩", color: "text-amber-500" },
  { value: "late_entry", label: "Late Entry", emoji: "⏰", color: "text-amber-500" },
  { value: "perfect", label: "Perfect Execution", emoji: "🎯", color: "text-indigo-500" },
] as const

// Helper: Generate year list
export function getYearList(): string[] {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: currentYear - 2009 }, (_, i) => (currentYear - i).toString())
}
