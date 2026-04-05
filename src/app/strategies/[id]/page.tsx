"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams } from "next/navigation"
import {
  BarChart3, ChevronLeft, History, LayoutDashboard, Target, TrendingUp,
  FileText, AlertCircle, Loader2, ListChecks, Activity, Hash, Play,
  Clock, Flame, DollarSign, Filter, Calendar, ChevronRight, ArrowUpRight,
  ArrowLeft, X
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AreaChart, Area, BarChart as RechartsBarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from "recharts"
import { supabase } from "@/lib/supabase"
import { getStrategyPerformance } from "@/lib/actions"
import { ALL_PAIRS, TIMEFRAMES, EXECUTION_FACTORS } from "@/lib/constants"
import Link from "next/link"

/* ===== Tipe untuk Year Summary ===== */
interface YearPairSummary {
  pair: string
  sessions: number
  trades: number
  wins: number
  profit: number
  winRate: number
}

export default function StrategyDetailPage() {
  const { id } = useParams()
  const [strategy, setStrategy] = useState<any>(null)
  const [allSessions, setAllSessions] = useState<any[]>([])
  const [trades, setTrades] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [availableYears, setAvailableYears] = useState<string[]>([])

  // Drill-down: null = overview semua data, year = lihat pair per tahun, year+pair = analisis detail
  const [selectedYear, setSelectedYear] = useState<string | null>(null)
  const [selectedPair, setSelectedPair] = useState<string | null>(null)
  const [filterTF, setFilterTF] = useState<string>("all")
  const [activeTab, setActiveTab] = useState<'overview' | 'trades' | 'journal'>('overview')

  // Data per-tahun (untuk menampilkan pair cards)
  const [yearSessions, setYearSessions] = useState<any[]>([])

  useEffect(() => { fetchStrategy() }, [id])

  // Fetch data sesuai level drill-down
  useEffect(() => {
    fetchPerformance()
  }, [id, selectedYear, selectedPair, filterTF])

  async function fetchStrategy() {
    const { data } = await supabase.from('strategies').select('*').eq('id', id).single()
    if (data) setStrategy(data)
    // Ambil tahun-tahun yang punya data
    const { data: sessions } = await supabase.from('backtests').select('test_year, symbol, total_trades, net_profit, win_rate')
      .eq('strategy_id', id).eq('status', 'manual').not('test_year', 'is', null)
    if (sessions) {
      const years = [...new Set(sessions.map((s: any) => s.test_year).filter(Boolean))] as string[]
      setAvailableYears(years.sort().reverse())
    }
  }

  async function fetchPerformance() {
    setIsLoading(true)
    const filters: any = {}
    if (selectedYear) filters.year = selectedYear
    if (selectedPair) filters.symbol = selectedPair
    if (filterTF !== 'all') filters.timeframe = filterTF
    const result = await getStrategyPerformance(id as string, filters)
    setAllSessions(result.sessions)
    setTrades(result.trades)

    // Jika tahun dipilih, ambil data sesi per pair untuk tahun itu
    if (selectedYear && !selectedPair) {
      const { data: ySessions } = await supabase.from('backtests')
        .select('*')
        .eq('strategy_id', id).eq('status', 'manual').eq('test_year', selectedYear)
      setYearSessions(ySessions || [])
    }
    setIsLoading(false)
  }

  /* ===== COMPUTED: Pair summary cards untuk tahun terpilih ===== */
  const yearPairSummary = useMemo<YearPairSummary[]>(() => {
    if (!selectedYear || selectedPair || yearSessions.length === 0) return []
    const groups: Record<string, YearPairSummary> = {}
    yearSessions.forEach((s: any) => {
      const p = s.symbol || 'Unknown'
      if (!groups[p]) groups[p] = { pair: p, sessions: 0, trades: 0, wins: 0, profit: 0, winRate: 0 }
      groups[p].sessions++
      groups[p].trades += s.total_trades || 0
      groups[p].profit += s.net_profit || 0
      // Hitung wins dari win_rate
      if (s.total_trades && s.win_rate) groups[p].wins += Math.round((s.win_rate / 100) * s.total_trades)
    })
    return Object.values(groups).map(g => ({
      ...g,
      winRate: g.trades > 0 ? (g.wins / g.trades) * 100 : 0
    })).sort((a, b) => b.profit - a.profit)
  }, [selectedYear, selectedPair, yearSessions])

  /* ===== COMPUTED: Stats dari trades ===== */
  const stats = useMemo(() => {
    if (trades.length === 0) return { total: 0, wins: 0, losses: 0, winRate: 0, netPL: 0, avgWin: 0, avgLoss: 0, rr: 0, pf: 0, maxConsLoss: 0 }
    const profits = trades.map((t: any) => t.profit_loss || 0)
    const wins = profits.filter((p: number) => p > 0)
    const losses = profits.filter((p: number) => p < 0)
    const netPL = profits.reduce((s: number, p: number) => s + p, 0)
    const winRate = (wins.length / profits.length) * 100
    const avgWin = wins.length > 0 ? wins.reduce((s: number, p: number) => s + p, 0) / wins.length : 0
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s: number, p: number) => s + p, 0) / losses.length) : 0
    const rr = avgLoss > 0 ? avgWin / avgLoss : 0
    const totalW = wins.reduce((s: number, p: number) => s + p, 0)
    const totalL = Math.abs(losses.reduce((s: number, p: number) => s + p, 0))
    const pf = totalL > 0 ? totalW / totalL : totalW > 0 ? 999 : 0
    let maxCL = 0, curCL = 0
    profits.forEach((p: number) => { if (p < 0) { curCL++; maxCL = Math.max(maxCL, curCL) } else curCL = 0 })
    return { total: profits.length, wins: wins.length, losses: losses.length, winRate, netPL, avgWin, avgLoss, rr, pf, maxConsLoss: maxCL }
  }, [trades])

  /* ===== COMPUTED: Equity curve ===== */
  const equityCurve = useMemo(() => {
    if (trades.length === 0) return []
    let balance = 1000
    const sorted = [...trades].reverse()
    return sorted.map((t: any, i: number) => {
      balance += (t.profit_loss || 0)
      return { trade: i + 1, balance: parseFloat(balance.toFixed(2)), profit: t.profit_loss || 0 }
    })
  }, [trades])

  /* ===== COMPUTED: P/L distribution ===== */
  const tradeDistribution = useMemo(() => {
    if (trades.length === 0) return []
    return [...trades].reverse().map((t: any, i: number) => ({
      trade: i + 1, value: t.profit_loss || 0, fill: (t.profit_loss || 0) >= 0 ? '#10b981' : '#f43f5e'
    }))
  }, [trades])

  /* ===== COMPUTED: Donut ===== */
  const winLossDonut = useMemo(() => {
    if (stats.total === 0) return []
    return [
      { name: 'Win', value: stats.wins, fill: '#10b981' },
      { name: 'Loss', value: stats.losses, fill: '#f43f5e' },
    ]
  }, [stats])

  /* ===== COMPUTED: Confirmation Analysis ===== */
  const confirmationAnalysis = useMemo(() => {
    const confs = strategy?.parameters?.confirmations || []
    if (confs.length === 0 || trades.length === 0) return null
    const byCount: Record<number, { trades: number; wins: number; totalPL: number }> = {}
    const skipOnLoss: number[] = new Array(confs.length).fill(0)
    let totalLosses = 0
    trades.forEach((t: any) => {
      const met = t.confirmations_met as boolean[] | null
      if (!met) return
      const count = met.filter(Boolean).length
      if (!byCount[count]) byCount[count] = { trades: 0, wins: 0, totalPL: 0 }
      byCount[count].trades++
      if ((t.profit_loss || 0) > 0) byCount[count].wins++
      byCount[count].totalPL += (t.profit_loss || 0)
      if ((t.profit_loss || 0) < 0) {
        totalLosses++
        met.forEach((v: boolean, i: number) => { if (!v) skipOnLoss[i]++ })
      }
    })
    const countRows = Object.entries(byCount)
      .map(([k, v]) => ({ count: parseInt(k), total: confs.length, ...v, winRate: (v.wins / v.trades) * 100, avgPL: v.totalPL / v.trades }))
      .sort((a, b) => b.count - a.count)
    const mostSkipped = confs.map((name: string, i: number) => ({
      name, skipPct: totalLosses > 0 ? (skipOnLoss[i] / totalLosses) * 100 : 0
    })).sort((a: any, b: any) => b.skipPct - a.skipPct).filter((x: any) => x.skipPct > 0)
    const chartData = countRows.map(r => ({ name: `${r.count}/${r.total}`, winRate: parseFloat(r.winRate.toFixed(1)), trades: r.trades }))
    return { countRows, mostSkipped, totalConfs: confs.length, chartData }
  }, [trades, strategy])

  /* ===== COMPUTED: Execution Factor ===== */
  const factorAnalysis = useMemo(() => {
    const withFactor = trades.filter((t: any) => t.execution_factor)
    if (withFactor.length === 0) return []
    const groups: Record<string, { trades: number; wins: number }> = {}
    withFactor.forEach((t: any) => {
      const f = t.execution_factor
      if (!groups[f]) groups[f] = { trades: 0, wins: 0 }
      groups[f].trades++
      if ((t.profit_loss || 0) > 0) groups[f].wins++
    })
    return Object.entries(groups).map(([k, v]) => ({
      factor: k, ...v, winRate: (v.wins / v.trades) * 100,
      info: EXECUTION_FACTORS.find(f => f.value === k)
    })).sort((a, b) => b.trades - a.trades)
  }, [trades])

  const confirmations = strategy?.parameters?.confirmations || []

  /* ===== Custom Tooltip ===== */
  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 shadow-2xl">
        <p className="text-[10px] font-bold text-zinc-400">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-xs font-black" style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</p>
        ))}
      </div>
    )
  }

  /* ===== Breadcrumb builder ===== */
  const breadcrumb = () => {
    const items: { label: string; onClick?: () => void }[] = [
      { label: 'Strategies', onClick: undefined },
      { label: strategy?.name || '...', onClick: () => { setSelectedYear(null); setSelectedPair(null); setActiveTab('overview') } },
    ]
    if (selectedYear) items.push({ label: selectedYear, onClick: () => { setSelectedPair(null); setActiveTab('overview') } })
    if (selectedPair) items.push({ label: selectedPair })
    return items
  }

  /* ===== Handler: klik tahun ===== */
  const handleYearClick = (year: string) => {
    if (selectedYear === year && !selectedPair) {
      // Toggle off
      setSelectedYear(null)
    } else {
      setSelectedYear(year)
      setSelectedPair(null)
      setActiveTab('overview')
    }
  }

  /* ===== Handler: klik pair ===== */
  const handlePairClick = (pair: string) => {
    setSelectedPair(pair)
    setActiveTab('overview')
  }

  /* ===== Judul konteks saat ini ===== */
  const contextTitle = selectedPair
    ? `${selectedPair} — ${selectedYear}`
    : selectedYear
    ? `Tahun ${selectedYear}`
    : 'All Time Performance'

  return (
    <div className="flex flex-col gap-5 p-6 lg:p-8 max-w-[1440px] mx-auto w-full animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/" className="hover:text-indigo-400 flex items-center gap-1"><LayoutDashboard className="h-3 w-3" /> Dashboard</Link>
        <ChevronRight className="h-3 w-3 text-zinc-700" />
        <Link href="/strategies" className="hover:text-indigo-400">Strategies</Link>
        {breadcrumb().slice(1).map((item, i) => (
          <span key={i} className="flex items-center gap-2">
            <ChevronRight className="h-3 w-3 text-zinc-700" />
            {item.onClick ? (
              <button onClick={item.onClick} className="hover:text-indigo-400 transition-colors">{item.label}</button>
            ) : (
              <span className="text-zinc-300 font-bold">{item.label}</span>
            )}
          </span>
        ))}
      </div>

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {(selectedYear || selectedPair) && (
              <button onClick={() => { if (selectedPair) setSelectedPair(null); else setSelectedYear(null) }}
                className="h-7 w-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors">
                <ArrowLeft className="h-3.5 w-3.5 text-zinc-400" />
              </button>
            )}
            <h1 className="text-2xl font-black tracking-tight">{strategy?.name || "Loading..."}</h1>
            <Badge className="bg-indigo-600/10 text-indigo-400 border-indigo-500/20 text-[9px] font-black">{strategy?.parameters?.type}</Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            {selectedPair ? `Analisis detail ${selectedPair} di tahun ${selectedYear}` :
              selectedYear ? `History dan pair yang diuji tahun ${selectedYear}` :
              (strategy?.description || "—")}
          </p>
          {confirmations.length > 0 && !selectedYear && (
            <div className="flex items-center gap-1 mt-1.5 text-[10px] text-zinc-600"><ListChecks className="h-3 w-3 text-indigo-400" /> {confirmations.length} confirmation rules</div>
          )}
        </div>
        <Link href="/manual-backtest">
          <Button size="sm" className="bg-gradient-to-r from-indigo-600 to-violet-600 font-black text-xs h-9 rounded-xl">
            <Play className="h-3 w-3 mr-1" /> Test Strategy
          </Button>
        </Link>
      </div>

      {/* ===== YEAR TIMELINE — selalu tampil ===== */}
      {availableYears.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[9px] font-black text-zinc-600 uppercase shrink-0 flex items-center gap-1"><Calendar className="h-3 w-3" /> History:</span>
          <button onClick={() => { setSelectedYear(null); setSelectedPair(null); setActiveTab('overview') }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${!selectedYear ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 scale-105' : 'bg-zinc-900/80 text-zinc-500 border border-zinc-800 hover:border-indigo-500/30 hover:text-zinc-300'}`}>
            📊 All Time
          </button>
          {availableYears.map(year => (
            <button key={year} onClick={() => handleYearClick(year)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5 ${selectedYear === year ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 scale-105' : 'bg-zinc-900/80 text-zinc-500 border border-zinc-800 hover:border-indigo-500/30 hover:text-zinc-300'}`}>
              <Calendar className="h-3.5 w-3.5" /> {year}
            </button>
          ))}
          {/* TF filter hanya saat ada konteks detail */}
          {(selectedYear && selectedPair) && (
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <Select value={filterTF} onValueChange={(v) => v && setFilterTF(v)}>
                <SelectTrigger className="h-7 w-20 bg-zinc-900 border-zinc-800 text-[10px] font-bold"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800"><SelectItem value="all">All TF</SelectItem>
                  {TIMEFRAMES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-32"><Loader2 className="h-8 w-8 text-indigo-500 animate-spin" /></div>
      ) : (
        <>
          {/* ===== LEVEL 1: YEAR SELECTED → tampilkan pair cards ===== */}
          {selectedYear && !selectedPair && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Year summary stats */}
              <div className="grid grid-cols-5 gap-2 mb-5">
                {[
                  { label: "Total Trades", value: stats.total },
                  { label: "Win Rate", value: `${stats.winRate.toFixed(1)}%`, color: stats.winRate >= 50 ? "text-emerald-400" : "text-rose-400" },
                  { label: "Net P/L", value: `$${stats.netPL.toFixed(2)}`, color: stats.netPL >= 0 ? "text-emerald-400" : "text-rose-400" },
                  { label: "Sessions", value: allSessions.length },
                  { label: "Pairs Tested", value: yearPairSummary.length, color: "text-indigo-400" },
                ].map((s, i) => (
                  <div key={i} className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg px-3 py-2.5">
                    <p className="text-[8px] font-black text-zinc-600 uppercase tracking-wider">{s.label}</p>
                    <p className={`text-lg font-black tabular-nums ${s.color || 'text-white'}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Pair Cards Grid */}
              <div className="mb-4">
                <h3 className="text-sm font-black flex items-center gap-2 mb-3"><Target className="h-4 w-4 text-indigo-400" /> Pair yang Diuji di Tahun {selectedYear}</h3>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {yearPairSummary.map(ps => (
                    <button key={ps.pair} onClick={() => handlePairClick(ps.pair)} className="text-left">
                      <Card className="bg-zinc-900/50 border-zinc-800/50 hover:border-indigo-500/40 transition-all group cursor-pointer">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-black text-xs ${ps.profit >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                                {ps.pair.substring(0, 3)}
                              </div>
                              <div>
                                <h4 className="font-black text-sm">{ps.pair}</h4>
                                <p className="text-[9px] text-zinc-600">{ps.sessions} sesi · {ps.trades} trades</p>
                              </div>
                            </div>
                            <ArrowUpRight className="h-4 w-4 text-zinc-700 group-hover:text-indigo-400 transition-colors" />
                          </div>
                          {/* Mini stats */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-zinc-950/50 rounded-lg px-2 py-1.5 text-center">
                              <p className="text-[7px] font-black text-zinc-700 uppercase">Win Rate</p>
                              <p className={`text-sm font-black ${ps.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>{ps.winRate.toFixed(1)}%</p>
                            </div>
                            <div className="bg-zinc-950/50 rounded-lg px-2 py-1.5 text-center">
                              <p className="text-[7px] font-black text-zinc-700 uppercase">Wins</p>
                              <p className="text-sm font-black text-emerald-400">{ps.wins}</p>
                            </div>
                            <div className="bg-zinc-950/50 rounded-lg px-2 py-1.5 text-center">
                              <p className="text-[7px] font-black text-zinc-700 uppercase">P/L</p>
                              <p className={`text-sm font-black ${ps.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{ps.profit >= 0 ? '+' : ''}${ps.profit.toFixed(2)}</p>
                            </div>
                          </div>
                          {/* Win rate bar */}
                          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${ps.winRate >= 50 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(ps.winRate, 100)}%` }} />
                          </div>
                        </CardContent>
                      </Card>
                    </button>
                  ))}
                </div>
                {yearPairSummary.length === 0 && (
                  <div className="text-center py-12 text-zinc-600 text-xs">Belum ada data pair untuk tahun {selectedYear}.</div>
                )}
              </div>

              {/* Quick equity curve untuk tahun ini */}
              {equityCurve.length > 0 && (
                <Card className="bg-zinc-900/40 border-zinc-800/50 mt-2">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-black flex items-center gap-2"><TrendingUp className="h-4 w-4 text-indigo-400" /> Equity Curve — {selectedYear}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={equityCurve}>
                          <defs><linearGradient id="eqGradY" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                          <XAxis dataKey="trade" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                          <Tooltip content={<ChartTooltip />} />
                          <Area type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#eqGradY)" name="Balance" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ===== LEVEL 2: YEAR + PAIR SELECTED → tampilkan full analysis ===== */}
          {/* ===== LEVEL 0: ALL TIME (no year selected) → tampilkan full analysis juga ===== */}
          {(!selectedYear || selectedPair) && trades.length > 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Context badge */}
              {selectedPair && (
                <div className="flex items-center gap-2 mb-4">
                  <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-sm font-black px-3 py-1">{selectedPair}</Badge>
                  <Badge variant="outline" className="border-zinc-800 text-zinc-400 text-xs font-bold px-2 py-1"><Calendar className="h-3 w-3 mr-1" /> {selectedYear}</Badge>
                  <button onClick={() => setSelectedPair(null)} className="h-6 w-6 rounded-md bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center ml-1">
                    <X className="h-3 w-3 text-zinc-500" />
                  </button>
                </div>
              )}

              {/* STATS GRID */}
              <div className="grid grid-cols-5 lg:grid-cols-10 gap-2 mb-5">
                {[
                  { label: "Total", value: stats.total },
                  { label: "Wins", value: stats.wins, color: "text-emerald-400" },
                  { label: "Losses", value: stats.losses, color: "text-rose-400" },
                  { label: "Win Rate", value: `${stats.winRate.toFixed(1)}%`, color: stats.winRate >= 50 ? "text-emerald-400" : "text-rose-400" },
                  { label: "Net P/L", value: `$${stats.netPL.toFixed(2)}`, color: stats.netPL >= 0 ? "text-emerald-400" : "text-rose-400" },
                  { label: "Avg Win", value: `+$${stats.avgWin.toFixed(2)}`, color: "text-emerald-400" },
                  { label: "Avg Loss", value: `-$${stats.avgLoss.toFixed(2)}`, color: "text-rose-400" },
                  { label: "R:R", value: `${stats.rr.toFixed(2)}`, color: stats.rr >= 1 ? "text-emerald-400" : "text-rose-400" },
                  { label: "PF", value: stats.pf > 100 ? '∞' : stats.pf.toFixed(2), color: stats.pf >= 1 ? "text-emerald-400" : "text-rose-400" },
                  { label: "Max CL", value: stats.maxConsLoss, color: "text-rose-400" },
                ].map((s, i) => (
                  <div key={i} className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg px-2 py-2">
                    <p className="text-[7px] font-black text-zinc-600 uppercase tracking-wider">{s.label}</p>
                    <p className={`text-sm font-black tabular-nums ${s.color || 'text-white'}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* TAB BAR */}
              <div className="flex items-center gap-1 border-b border-zinc-800/50 pb-0 mb-5">
                {[
                  { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
                  { id: 'trades' as const, label: `Trades (${trades.length})`, icon: History },
                  { id: 'journal' as const, label: `Sessions (${allSessions.length})`, icon: FileText },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2.5 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all ${activeTab === tab.id ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-zinc-600 hover:text-zinc-400'}`}>
                    <tab.icon className="h-3.5 w-3.5" /> {tab.label}
                  </button>
                ))}
              </div>

              {/* ===== OVERVIEW ===== */}
              {activeTab === 'overview' && (
                <div className="grid gap-5 lg:grid-cols-12">
                  <div className="lg:col-span-8 space-y-5">
                    {/* Equity Curve */}
                    <Card className="bg-zinc-900/40 border-zinc-800/50">
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-black flex items-center gap-2"><TrendingUp className="h-4 w-4 text-indigo-400" /> Equity Curve</CardTitle></CardHeader>
                      <CardContent><div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={equityCurve}>
                            <defs><linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                            <XAxis dataKey="trade" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                            <Tooltip content={<ChartTooltip />} />
                            <Area type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#eqGrad)" name="Balance" animationDuration={1200} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div></CardContent>
                    </Card>

                    {/* P/L Distribution */}
                    <Card className="bg-zinc-900/40 border-zinc-800/50">
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-black flex items-center gap-2"><BarChart3 className="h-4 w-4 text-indigo-400" /> P/L per Trade</CardTitle></CardHeader>
                      <CardContent><div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsBarChart data={tradeDistribution}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                            <XAxis dataKey="trade" stroke="#52525b" fontSize={9} tickLine={false} axisLine={false} />
                            <YAxis stroke="#52525b" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                            <Tooltip content={<ChartTooltip />} />
                            <Bar dataKey="value" radius={[2, 2, 0, 0]} name="P/L" animationDuration={1000}>
                              {tradeDistribution.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                            </Bar>
                          </RechartsBarChart>
                        </ResponsiveContainer>
                      </div></CardContent>
                    </Card>

                    {/* Confirmation Analysis */}
                    {confirmationAnalysis && confirmationAnalysis.countRows.length > 0 && (
                      <Card className="bg-zinc-900/40 border-zinc-800/50">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-black flex items-center gap-2"><ListChecks className="h-4 w-4 text-indigo-400" /> Confirmation Analysis</CardTitle>
                          <CardDescription className="text-[10px]">Korelasi jumlah konfirmasi dengan win rate</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="h-[180px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <RechartsBarChart data={confirmationAnalysis.chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                                <Tooltip content={<ChartTooltip />} />
                                <Bar dataKey="winRate" radius={[4, 4, 0, 0]} name="Win Rate" animationDuration={1000}>
                                  {confirmationAnalysis.chartData.map((entry: any, index: number) => <Cell key={index} fill={entry.winRate >= 50 ? '#10b981' : '#f43f5e'} />)}
                                </Bar>
                              </RechartsBarChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead><tr className="border-b border-zinc-800">
                                <th className="text-left py-2 text-[8px] font-black text-zinc-600 uppercase">Confirmed</th>
                                <th className="text-right py-2 text-[8px] font-black text-zinc-600 uppercase">Trades</th>
                                <th className="text-right py-2 text-[8px] font-black text-zinc-600 uppercase">Win Rate</th>
                                <th className="text-right py-2 text-[8px] font-black text-zinc-600 uppercase">Avg P/L</th>
                              </tr></thead>
                              <tbody>{confirmationAnalysis.countRows.map(row => (
                                <tr key={row.count} className="border-b border-zinc-800/30">
                                  <td className="py-2"><div className="flex items-center gap-2">
                                    <div className="flex gap-0.5">{Array.from({ length: row.total }).map((_, i) => <div key={i} className={`h-2 w-2 rounded-sm ${i < row.count ? 'bg-emerald-500' : 'bg-zinc-800'}`} />)}</div>
                                    <span className="font-bold">{row.count}/{row.total}</span>
                                  </div></td>
                                  <td className="text-right font-bold">{row.trades}</td>
                                  <td className={`text-right font-black ${row.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>{row.winRate.toFixed(1)}%</td>
                                  <td className={`text-right font-black ${row.avgPL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{row.avgPL >= 0 ? '+' : ''}{row.avgPL.toFixed(2)}</td>
                                </tr>
                              ))}</tbody>
                            </table>
                          </div>
                          {confirmationAnalysis.mostSkipped.length > 0 && (
                            <div className="bg-rose-500/5 border border-rose-500/15 rounded-xl p-3">
                              <p className="text-[9px] font-black text-rose-400 uppercase mb-2">⚠ Paling Sering Di-skip Saat LOSS</p>
                              {confirmationAnalysis.mostSkipped.slice(0, 3).map((item: any, i: number) => (
                                <div key={i} className="flex items-center justify-between py-0.5">
                                  <span className="text-[10px] text-zinc-400">{item.name}</span>
                                  <span className="text-[10px] font-black text-rose-400">{item.skipPct.toFixed(0)}%</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* RIGHT SIDEBAR */}
                  <div className="lg:col-span-4 space-y-5">
                    {/* Win/Loss Donut */}
                    <Card className="bg-zinc-900/40 border-zinc-800/50">
                      <CardHeader className="pb-0"><CardTitle className="text-sm font-black">Win vs Loss</CardTitle></CardHeader>
                      <CardContent>
                        <div className="h-[180px] flex items-center justify-center">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={winLossDonut} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={3} animationDuration={1000}>
                                {winLossDonut.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                              </Pie>
                              <Tooltip content={<ChartTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex justify-center gap-6 -mt-2">
                          <div className="text-center"><p className="text-lg font-black text-emerald-400">{stats.wins}</p><p className="text-[8px] text-zinc-600 font-bold uppercase">Wins</p></div>
                          <div className="text-center"><p className="text-lg font-black text-rose-400">{stats.losses}</p><p className="text-[8px] text-zinc-600 font-bold uppercase">Losses</p></div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Execution Factors */}
                    {factorAnalysis.length > 0 && (
                      <Card className="bg-zinc-900/40 border-zinc-800/50">
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-black flex items-center gap-2"><Activity className="h-4 w-4 text-indigo-400" /> Execution Factors</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                          {factorAnalysis.map((f, i) => (
                            <div key={i} className="flex items-center justify-between bg-zinc-950/40 border border-zinc-800/50 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{f.info?.emoji || '—'}</span>
                                <div><span className="text-[10px] font-bold">{f.info?.label || f.factor}</span><p className="text-[8px] text-zinc-600">{f.trades} trades</p></div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${f.winRate >= 50 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(f.winRate, 100)}%` }} />
                                </div>
                                <span className={`text-[10px] font-black w-10 text-right ${f.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>{f.winRate.toFixed(0)}%</span>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* Rules ref — only on all-time */}
                    {!selectedYear && confirmations.length > 0 && (
                      <Card className="bg-zinc-900/40 border-zinc-800/50">
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-black flex items-center gap-2"><ListChecks className="h-4 w-4 text-indigo-400" /> Rules</CardTitle></CardHeader>
                        <CardContent><div className="space-y-1">{confirmations.map((c: string, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-[10px] text-zinc-400"><span className="text-zinc-600 font-mono w-4">{i + 1}.</span>{c}</div>
                        ))}</div></CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              )}

              {/* ===== TRADES TAB ===== */}
              {activeTab === 'trades' && (
                <Card className="bg-zinc-900/40 border-zinc-800/50">
                  <CardContent className="p-0">
                    <div className="max-h-[600px] overflow-y-auto divide-y divide-zinc-800/30">
                      {trades.map((t: any, i: number) => {
                        const isWin = (t.profit_loss || 0) > 0
                        const confs = t.confirmations_met as boolean[] | null
                        const confStr = confs ? `${confs.filter(Boolean).length}/${confs.length}` : null
                        const num = trades.length - i
                        return (
                          <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-800/10 transition-colors">
                            <span className="text-[9px] text-zinc-700 font-mono w-6 text-right">#{num}</span>
                            <div className={`h-2 w-2 rounded-full ${isWin ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge className={`text-[8px] h-4 py-0 ${isWin ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>{isWin ? 'WIN' : 'LOSS'}</Badge>
                                <Badge variant="outline" className={`text-[8px] h-4 py-0 ${t.trade_direction === 'long' ? 'border-emerald-500/20 text-emerald-500' : 'border-rose-500/20 text-rose-500'}`}>{t.trade_direction === 'long' ? 'BUY' : 'SELL'}</Badge>
                                {confStr && <Badge variant="outline" className="text-[7px] h-3.5 py-0 border-zinc-800 text-zinc-500">{confStr} ✓</Badge>}
                                {t.setup_type && <Badge variant="outline" className="text-[7px] h-3.5 py-0 border-zinc-800 text-zinc-500">{t.setup_type}</Badge>}
                                {t.market_session && <Badge variant="outline" className="text-[7px] h-3.5 py-0 border-zinc-800 text-zinc-500">{t.market_session}</Badge>}
                                {t.execution_factor && t.execution_factor !== 'rules' && (
                                  <Badge className="text-[7px] h-3.5 py-0 bg-amber-500/10 text-amber-400 border-amber-500/20">
                                    {EXECUTION_FACTORS.find(f => f.value === t.execution_factor)?.emoji} {t.execution_factor}
                                  </Badge>
                                )}
                              </div>
                              {t.entry_reason && <p className="text-[9px] text-zinc-500 mt-0.5">{t.entry_reason}</p>}
                              {t.notes && <p className="text-[9px] text-zinc-600 mt-0.5 italic">"{t.notes}"</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-xs font-black tabular-nums ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>{isWin ? '+' : ''}{(t.profit_loss || 0).toFixed(2)}</p>
                              <p className="text-[8px] text-zinc-700">{new Date(t.entry_time).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ===== JOURNAL TAB ===== */}
              {activeTab === 'journal' && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {allSessions.map((s: any) => (
                    <Card key={s.id} className="bg-zinc-900/40 border-zinc-800/50 hover:border-zinc-700 transition-all">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[8px] h-4 py-0">{s.symbol}</Badge>
                          <Badge variant="outline" className="border-zinc-800 text-zinc-500 text-[8px] h-4 py-0">{s.timeframe}</Badge>
                          <Badge variant="outline" className="border-zinc-800 text-zinc-500 text-[8px] h-4 py-0"><Calendar className="h-2 w-2 mr-0.5" /> {s.test_year}</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-zinc-950/50 rounded-lg px-2 py-1.5 text-center">
                            <p className="text-[7px] font-black text-zinc-700 uppercase">Trades</p><p className="text-sm font-black">{s.total_trades || 0}</p>
                          </div>
                          <div className="bg-zinc-950/50 rounded-lg px-2 py-1.5 text-center">
                            <p className="text-[7px] font-black text-zinc-700 uppercase">Win Rate</p>
                            <p className={`text-sm font-black ${(s.win_rate || 0) >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>{(s.win_rate || 0).toFixed(1)}%</p>
                          </div>
                          <div className="bg-zinc-950/50 rounded-lg px-2 py-1.5 text-center">
                            <p className="text-[7px] font-black text-zinc-700 uppercase">P/L</p>
                            <p className={`text-sm font-black ${(s.net_profit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{(s.net_profit || 0) >= 0 ? '+' : ''}${(s.net_profit || 0).toFixed(2)}</p>
                          </div>
                        </div>
                        {s.description && <p className="text-[10px] text-zinc-500 italic">"{s.description}"</p>}
                        {s.session_summary && (
                          <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-lg p-2.5">
                            <p className="text-[8px] font-black text-indigo-400 uppercase mb-1">Kesimpulan</p>
                            <p className="text-[10px] text-zinc-400">{s.session_summary}</p>
                          </div>
                        )}
                        {s.obstacles && (
                          <div className="bg-rose-500/5 border border-rose-500/15 rounded-lg p-2.5">
                            <p className="text-[8px] font-black text-rose-400 uppercase mb-1">Kendala</p>
                            <p className="text-[10px] text-zinc-400">{s.obstacles}</p>
                          </div>
                        )}
                        <p className="text-[8px] text-zinc-700">{new Date(s.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                      </CardContent>
                    </Card>
                  ))}
                  {allSessions.length === 0 && <div className="col-span-full text-center py-16 text-zinc-600 text-xs">Tidak ada sesi.</div>}
                </div>
              )}
            </div>
          )}

          {/* State: tidak ada data */}
          {(!selectedYear || selectedPair) && trades.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-32 gap-3 text-zinc-600 animate-in fade-in">
              <AlertCircle className="h-8 w-8 opacity-20" />
              <p className="text-sm font-bold">Belum ada data trade{selectedPair ? ` untuk ${selectedPair}` : ''}</p>
              <Link href="/manual-backtest"><Button size="sm" variant="outline" className="text-xs border-zinc-700">Start Backtesting</Button></Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
