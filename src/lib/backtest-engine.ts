export interface Trade {
  id: string;
  type: 'long' | 'short';
  entryTime: Date;
  exitTime?: Date;
  entryPrice: number;
  exitPrice?: number;
  profit?: number;
  profitPct?: number;
  status: 'open' | 'closed';
  reason?: string;
}

export interface OHLC {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface BacktestResult {
  totalTrades: number;
  winRate: number;
  netProfit: number;
  maxDrawdown: number;
  profitFactor: number;
  trades: Trade[];
  equityCurve: { timestamp: string; balance: number }[];
}

export class BacktestEngine {
  private balance: number;
  private initialBalance: number;
  private trades: Trade[] = [];
  private equityCurve: { timestamp: string; balance: number }[] = [];
  private maxBalance: number;
  private maxDrawdown: number = 0;

  constructor(initialBalance: number = 1000) {
    this.initialBalance = initialBalance;
    this.balance = initialBalance;
    this.maxBalance = initialBalance;
  }

  run(data: OHLC[], strategyParams: any): BacktestResult {
    this.trades = [];
    this.balance = this.initialBalance;
    this.maxBalance = this.initialBalance;
    this.maxDrawdown = 0;
    this.equityCurve = [{ timestamp: data[0].timestamp, balance: this.initialBalance }];

    let currentPosition: Trade | null = null;
    const riskPct = strategyParams.riskPerTrade || 1; // Default 1%
    const type = strategyParams.type || 'SMC';

    for (let i = 2; i < data.length; i++) {
       const current = data[i];
       const prev = data[i-1];
       const prev2 = data[i-2];

       // Professional Logic Placeholder (SMC/ICT)
       // SMC: BOS (Break of Structure) + Retracement
       const isBOSLong = current.close > prev.high && prev.high > prev2.high;
       const isBOSShort = current.close < prev.low && prev.low < prev2.low;

       if (!currentPosition) {
         if (isBOSLong && type === 'SMC') {
           const riskAmount = this.balance * (riskPct / 100);
           currentPosition = {
             id: Math.random().toString(36).substr(2, 9),
             type: 'long',
             entryTime: new Date(current.timestamp),
             entryPrice: current.close,
             status: 'open',
             reason: 'BOS Long'
           };
         } else if (isBOSShort && type === 'SMC') {
           currentPosition = {
             id: Math.random().toString(36).substr(2, 9),
             type: 'short',
             entryTime: new Date(current.timestamp),
             entryPrice: current.close,
             status: 'open',
             reason: 'BOS Short'
           };
         }
       } else {
         // Exit Logic: Trend Reversal or Fixed RR
         const isReversal = currentPosition.type === 'long' ? current.close < prev.low : current.close > prev.high;
         
         if (isReversal) {
           currentPosition.exitTime = new Date(current.timestamp);
           currentPosition.exitPrice = current.close;
           currentPosition.status = 'closed';
           
           const profit = currentPosition.type === 'long' 
             ? currentPosition.exitPrice - currentPosition.entryPrice 
             : currentPosition.entryPrice - currentPosition.exitPrice;
           
           // Use Risk % calculation for Pro analysis
           const tradeReturn = (profit / currentPosition.entryPrice);
           const pnl = this.balance * tradeReturn * (riskPct / 1); // Simple multiplier for demonstration
           
           currentPosition.profit = pnl;
           currentPosition.profitPct = tradeReturn * 100;
           
           this.balance += pnl;
           this.trades.push({ ...currentPosition });
           
           // Max Drawdown Calculation
           if (this.balance > this.maxBalance) {
             this.maxBalance = this.balance;
           }
           const drawdown = (this.maxBalance - this.balance) / this.maxBalance * 100;
           if (drawdown > this.maxDrawdown) {
             this.maxDrawdown = drawdown;
           }

           this.equityCurve.push({ timestamp: current.timestamp, balance: this.balance });
           currentPosition = null;
         }
       }
    }

    return this.calculateMetrics();
  }

  private calculateMetrics(): BacktestResult {
    const wins = this.trades.filter(t => (t.profit || 0) > 0).length;
    const losses = this.trades.filter(t => (t.profit || 0) <= 0).length;
    
    const grossProfit = this.trades.filter(t => (t.profit || 0) > 0).reduce((sum, t) => sum + (t.profit || 0), 0);
    const grossLoss = Math.abs(this.trades.filter(t => (t.profit || 0) <= 0).reduce((sum, t) => sum + (t.profit || 0), 0));
    
    const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;
    const netProfit = this.balance - this.initialBalance;
    
    return {
      totalTrades: this.trades.length,
      winRate: this.trades.length > 0 ? (wins / this.trades.length) * 100 : 0,
      netProfit,
      maxDrawdown: this.maxDrawdown,
      profitFactor,
      trades: this.trades,
      equityCurve: this.equityCurve
    };
  }
}
