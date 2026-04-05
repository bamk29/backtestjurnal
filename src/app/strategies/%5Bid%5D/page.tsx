"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams } from "next/navigation"
import {
  BarChart3, ChevronLeft, History, LayoutDashboard, Target, TrendingUp,
  FileText, AlertCircle, Loader2, ListChecks, Activity, Hash,
  Clock, Flame, DollarSign, Filter
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { getStrategyPerformance } from "@/lib/actions"
import { PerformanceChart } from "@/components/performance-chart"
import { ALL_PAIRS, TIMEFRAMES, EXECUTION_FACTORS, getYearList } from "@/lib/constants"
import Link from "next/link"

export default function StrategyDetailPage() {
  const { id } = useParams()
  const [strategy, setStrategy] = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [trades, setTrades] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [filterYear, setFilterYear] = useState<string>("all")
  const [filterPair, setFilterPair] = useState<string>("all")
  const [filterTF, setFilterTF] = useState<string>("all")

  const years = getYearList()

  useEffect(() => { fetchData() }, [id, filterYear, filterPair, filterTF])

  async function fetchData() {
    setIsLoading(true)
    const { data: strat } = await supabase.from('strategies').select('*').eq('id', id).single()
    if (strat) setStrategy(strat)

    const filters: any = {}
    if (filterYear !== 'all') filters.year = filterYear
    if (filterPair !== 'all') filters.symbol = filterPair
    if (filterTF !== 'all') filters.timeframe = filterTF

    const result = await getStrategyPerformance(id as string, filters)
    setSessions(result.sessions)
    setTrades(result.trades)
    setIsLoading(false)
  }

  // ===== COMPUTED STATS =====
  const stats = useMemo(() => {
    if (trades.length === 0) return { total: 0, winRate: 0, netPL: 0, avgWin: 0, avgLoss: 0, rr: 0, pf: 0, streak: 0, streakType: null as string | null }
    const profits = trades.map(t => t.profit_loss || 0)
    const wins = profits.filter(p => p > 0)
    const losses = profits.filter(p => p < 0)
    const netPL = profits.reduce((s, p) => s + p, 0)
    const winRate = (wins.length / profits.length) * 100
    const avgWin = wins.length > 0 ? wins.reduce((s, p) => s + p, 0) / wins.length : 0
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, p) => s + p, 0) / losses.length) : 0
    const rr = avgLoss > 0 ? avgWin / avgLoss : 0
    const totalWin = wins.reduce((s, p) => s + p, 0)
    const totalLoss = Math.abs(losses.reduce((s, p) => s + p, 0))
    const pf = totalLoss > 0 ? totalWin / totalLoss : 0
    return { total: profits.length, winRate, netPL, avgWin, avgLoss, rr, pf, streak: 0, streakType: null }
  }, [trades])

  // ===== CONFIRMATION ANALYSIS =====
  const confirmationAnalysis = useMemo(() => {
    const confs = strategy?.parameters?.confirmations || []
    if (confs.length === 0 || trades.length === 0) return null

    // Group trades by confirmation count
    const byCount: Record<number, { trades: number; wins: number; totalPL: number }> = {}
    // Per-confirmation skip analysis
    const skipOnLoss: number[] = new Array(confs.length).fill(0)
    let totalLosses = 0

    trades.forEach(t => {
      const met = t.confirmations_met as boolean[] | null
      if (!met) return
      const count = met.filter(Boolean).length
      if (!byCount[count]) byCount[count] = { trades: 0, wins: 0, totalPL: 0 }
      byCount[count].trades++
      if ((t.profit_loss || 0) > 0) byCount[count].wins++
      byCount[count].totalPL += (t.profit_loss || 0)

      if ((t.profit_loss || 0) < 0) {
        totalLosses++
        met.forEach((v, i) => { if (!v) skipOnLoss[i]++ })
      }
    })

    // Sort by count descending
    const countRows = Object.entries(byCount)
      .map(([k, v]) => ({ count: parseInt(k), total: confs.length, ...v, winRate: (v.wins / v.trades) * 100, avgPL: v.totalPL / v.trades }))
      .sort((a, b) => b.count - a.count)

    // Most skipped on loss
    const mostSkipped = confs.map((name: string, i: number) => ({
      name, skipPct: totalLosses > 0 ? (skipOnLoss[i] / totalLosses) * 100 : 0
    })).sort((a: any, b: any) => b.skipPct - a.skipPct).filter((x: any) => x.skipPct > 0)

    return { countRows, mostSkipped, totalConfs: confs.length }
  }, [trades, strategy])

  // ===== EXECUTION FACTOR ANALYSIS =====
  const factorAnalysis = useMemo(() => {
    const withFactor = trades.filter(t => t.execution_factor)
    if (withFactor.length === 0) return []
    const groups: Record<string, { trades: number; wins: number }> = {}
    withFactor.forEach(t => {
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

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-[1400px] mx-auto w-full animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/" className="hover:text-indigo-400 flex items-center gap-1"><LayoutDashboard className="h-3 w-3" /> Dashboard</Link>
        <ChevronLeft className="h-3 w-3 rotate-180" />
        <span className="text-zinc-300 font-bold">{strategy?.name || "..."}</span>
      </div>

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight">{strategy?.name || "Loading..."}</h1>
            <Badge className="bg-indigo-600/10 text-indigo-400 border-indigo-500/20 text-[9px]">{strategy?.parameters?.type}</Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-1 max-w-xl">{strategy?.description || "—"}</p>
          {confirmations.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 text-[10px] text-zinc-600"><ListChecks className="h-3 w-3 text-indigo-400" /> {confirmations.length} confirmation rules</div>
          )}
        </div>
        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="h-8 w-24 bg-zinc-900 border-zinc-800 text-xs font-bold"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-zinc-950 border-zinc-800">
              <SelectItem value="all">All Years</SelectItem>
              {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterPair} onValueChange={setFilterPair}>
            <SelectTrigger className="h-8 w-28 bg-zinc-900 border-zinc-800 text-xs font-bold"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-zinc-950 border-zinc-800">
              <SelectItem value="all">All Pairs</SelectItem>
              {ALL_PAIRS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterTF} onValueChange={setFilterTF}>
            <SelectTrigger className="h-8 w-20 bg-zinc-900 border-zinc-800 text-xs font-bold"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-zinc-950 border-zinc-800">
              <SelectItem value="all">All TF</SelectItem>
              {TIMEFRAMES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* STATS BAR */}
      <div className="grid grid-cols-3 lg:grid-cols-7 gap-2">
        {[
          { label: "Total", value: stats.total, color: "text-white" },
          { label: "Win Rate", value: `${stats.winRate.toFixed(1)}%`, color: stats.winRate >= 50 ? "text-emerald-400" : "text-rose-400" },
          { label: "Net P/L", value: `$${stats.netPL.toFixed(2)}`, color: stats.netPL >= 0 ? "text-emerald-400" : "text-rose-400" },
          { label: "Avg Win", value: `+$${stats.avgWin.toFixed(2)}`, color: "text-emerald-400" },
          { label: "Avg Loss", value: `-$${stats.avgLoss.toFixed(2)}`, color: "text-rose-400" },
          { label: "R:R", value: `${stats.rr.toFixed(2)}:1`, color: stats.rr >= 1 ? "text-emerald-400" : "text-rose-400" },
          { label: "Profit Factor", value: stats.pf.toFixed(2), color: stats.pf >= 1 ? "text-emerald-400" : "text-rose-400" },
        ].map((s, i) => (
          <div key={i} className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg px-3 py-2.5">
            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-wider">{s.label}</p>
            <p className={`text-lg font-black ${s.color} tabular-nums`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-8 space-y-6">
          {/* CONFIRMATION ANALYSIS */}
          {confirmationAnalysis && confirmationAnalysis.countRows.length > 0 && (
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-base font-black flex items-center gap-2"><ListChecks className="h-4 w-4 text-indigo-400" /> Confirmation Analysis</CardTitle>
                <CardDescription className="text-xs">Korelasi jumlah konfirmasi dengan win rate — bukti pentingnya disiplin.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-zinc-800">
                          <th className="text-left py-2 text-[9px] font-black text-zinc-600 uppercase">Confirmed</th>
                          <th className="text-right py-2 text-[9px] font-black text-zinc-600 uppercase">Trades</th>
                          <th className="text-right py-2 text-[9px] font-black text-zinc-600 uppercase">Win Rate</th>
                          <th className="text-right py-2 text-[9px] font-black text-zinc-600 uppercase">Avg P/L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {confirmationAnalysis.countRows.map(row => (
                          <tr key={row.count} className="border-b border-zinc-800/30 hover:bg-zinc-800/10">
                            <td className="py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="flex gap-0.5">
                                  {Array.from({ length: row.total }).map((_, i) => (
                                    <div key={i} className={`h-2 w-2 rounded-sm ${i < row.count ? 'bg-emerald-500' : 'bg-zinc-800'}`} />
                                  ))}
                                </div>
                                <span className="font-bold">{row.count}/{row.total}</span>
                              </div>
                            </td>
                            <td className="text-right font-bold">{row.trades}</td>
                            <td className={`text-right font-black ${row.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>{row.winRate.toFixed(1)}%</td>
                            <td className={`text-right font-black ${row.avgPL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{row.avgPL >= 0 ? '+' : ''}{row.avgPL.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Most skipped on loss */}
                  {confirmationAnalysis.mostSkipped.length > 0 && (
                    <div className="bg-rose-500/5 border border-rose-500/15 rounded-xl p-3">
                      <p className="text-[9px] font-black text-rose-400 uppercase mb-2">⚠ Paling Sering Di-skip Saat LOSS</p>
                      <div className="space-y-1.5">
                        {confirmationAnalysis.mostSkipped.slice(0, 3).map((item: any, i: number) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-xs text-zinc-400">{item.name}</span>
                            <span className="text-xs font-black text-rose-400">{item.skipPct.toFixed(0)}% skip rate</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* EXECUTION FACTOR BREAKDOWN */}
          {factorAnalysis.length > 0 && (
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-base font-black flex items-center gap-2"><Activity className="h-4 w-4 text-indigo-400" /> Execution Factor Analysis</CardTitle>
                <CardDescription className="text-xs">Bagaimana kondisi psikologis mempengaruhi hasil trading.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {factorAnalysis.map((f, i) => (
                    <div key={i} className="flex items-center justify-between bg-zinc-950/40 border border-zinc-800/50 rounded-lg px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{f.info?.emoji || '—'}</span>
                        <span className="text-xs font-bold">{f.info?.label || f.factor}</span>
                        <span className="text-[9px] text-zinc-600">{f.trades} trades</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${f.winRate >= 50 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(f.winRate, 100)}%` }} />
                        </div>
                        <span className={`text-xs font-black w-12 text-right ${f.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>{f.winRate.toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* TRADE HISTORY */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-base font-black flex items-center gap-2"><History className="h-4 w-4 text-indigo-400" /> Trade History</CardTitle>
              <CardDescription className="text-xs">{trades.length} trades</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 text-indigo-500 animate-spin" /></div>
              ) : trades.length > 0 ? (
                <div className="divide-y divide-zinc-800/30 max-h-[500px] overflow-y-auto">
                  {trades.map((t, i) => {
                    const isWin = (t.profit_loss || 0) > 0
                    const confs = t.confirmations_met as boolean[] | null
                    const confStr = confs ? `${confs.filter(Boolean).length}/${confs.length}` : null
                    return (
                      <div key={t.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-zinc-800/10 transition-colors">
                        <div className={`h-1.5 w-1.5 rounded-full ${isWin ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] font-black ${isWin ? 'text-emerald-500' : 'text-rose-500'}`}>{isWin ? 'WIN' : 'LOSS'}</span>
                            <span className={`text-[9px] font-bold ${t.trade_direction === 'long' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.trade_direction === 'long' ? 'BUY' : 'SELL'}</span>
                            {confStr && <Badge variant="outline" className="text-[7px] h-3.5 py-0 border-zinc-800 text-zinc-500">{confStr}</Badge>}
                            {t.setup_type && <Badge variant="outline" className="text-[7px] h-3.5 py-0 border-zinc-800 text-zinc-500">{t.setup_type}</Badge>}
                            {t.execution_factor && t.execution_factor !== 'rules' && (
                              <Badge className="text-[7px] h-3.5 py-0 bg-amber-500/10 text-amber-400 border-amber-500/20">
                                {EXECUTION_FACTORS.find(f => f.value === t.execution_factor)?.emoji} {t.execution_factor}
                              </Badge>
                            )}
                          </div>
                          {(t.entry_reason || t.notes) && <p className="text-[9px] text-zinc-600 truncate mt-0.5">{t.entry_reason || t.notes}</p>}
                          <span className="text-[8px] text-zinc-700 font-mono">{new Date(t.entry_time).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                        <span className={`text-xs font-black tabular-nums ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isWin ? '+' : ''}{(t.profit_loss || 0).toFixed(2)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-16 text-zinc-600 text-xs">Tidak ada data trade untuk filter ini.</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Session Journal */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-base font-black flex items-center gap-2"><FileText className="h-4 w-4 text-indigo-400" /> Session Journal</CardTitle>
              <CardDescription className="text-xs">{sessions.length} sessions</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-zinc-800/30 max-h-[400px] overflow-y-auto">
                {sessions.length > 0 ? sessions.map(s => (
                  <div key={s.id} className="px-4 py-3 hover:bg-zinc-800/10 transition-colors">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[8px] h-4 py-0">{s.symbol}</Badge>
                      <Badge variant="outline" className="border-zinc-800 text-zinc-500 text-[8px] h-4 py-0">{s.timeframe}</Badge>
                      <Badge variant="outline" className="border-zinc-800 text-zinc-500 text-[8px] h-4 py-0">{s.test_year}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">{s.total_trades || 0} trades • {(s.win_rate || 0).toFixed(1)}% WR</span>
                      <span className={`text-xs font-black ${(s.net_profit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {(s.net_profit || 0) >= 0 ? '+' : ''}${(s.net_profit || 0).toFixed(2)}
                      </span>
                    </div>
                    {s.description && <p className="text-[9px] text-zinc-600 mt-1 italic">"{s.description}"</p>}
                    {s.session_summary && (
                      <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-2 mt-2">
                        <p className="text-[9px] text-zinc-500">{s.session_summary}</p>
                      </div>
                    )}
                    {s.obstacles && (
                      <div className="bg-rose-500/5 border border-rose-500/15 rounded-lg p-2 mt-1.5">
                        <p className="text-[9px] text-rose-400">{s.obstacles}</p>
                      </div>
                    )}
                  </div>
                )) : (
                  <div className="px-4 py-12 text-center text-zinc-600 text-xs">Belum ada sesi.</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Strategy Confirmations Reference */}
          {confirmations.length > 0 && (
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-base font-black flex items-center gap-2"><ListChecks className="h-4 w-4 text-indigo-400" /> Confirmation Rules</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {confirmations.map((conf: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-zinc-400">
                      <span className="text-[9px] text-zinc-600 font-mono w-4">{i + 1}.</span>
                      {conf}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
