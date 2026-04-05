/**
 * Professional Trade Calculation Utility
 * Handles XAUUSD, Forex (PIP), and JPY pairs.
 */

export type TradeType = 'long' | 'short';

export function calculateProfit(
  symbol: string,
  type: TradeType,
  entry: number,
  exit: number,
  lots: number
): { profit: number; pips: number } {
  const isXAU = symbol.toUpperCase().includes('XAU');
  const isJPY = symbol.toUpperCase().includes('JPY');
  
  const diff = type === 'long' ? exit - entry : entry - exit;
  let pips = 0;
  let profit = 0;

  if (isXAU) {
    // Gold: 1 pip = 0.10 price change. 1 Lot = 100oz.
    // Profit = (Exit - Entry) * 100 * Lots
    pips = diff / 0.1;
    profit = diff * 100 * lots;
  } else if (isJPY) {
    // JPY: 1 pip = 0.01 price change. 1 Lot = 100,000 units.
    pips = diff / 0.01;
    profit = diff * 1000 * lots; // Standard calculation for JPY
  } else {
    // Forex (Standard): 1 pip = 0.0001 price change. 1 Lot = 100,000 units.
    pips = diff / 0.0001;
    profit = diff * 100000 * lots;
  }

  return { 
    profit: Number(profit.toFixed(2)), 
    pips: Number(pips.toFixed(1)) 
  };
}

export function formatSymbolName(name: string): string {
  return name.replace(/[^a-zA-Z]/g, '').toUpperCase();
}
