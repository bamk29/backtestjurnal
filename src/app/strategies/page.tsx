"use client"

import { useState, useEffect } from "react"
import {
  Zap, ArrowUpRight, Plus, Search, ListChecks, Target, Hash,
  TrendingUp, Activity, BarChart3, DollarSign, Calendar
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"
import { StrategyForm } from "@/components/strategy-form"
import Link from "next/link"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<any[]>([])
  const [strategyStats, setStrategyStats] = useState<Record<string, any>>({})
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    // Ambil semua strategi
    const { data: strats } = await supabase.from('strategies').select('*').order('created_at', { ascending: false })
    if (!strats) return
    setStrategies(strats)

    // Ambil stats per strategi dari backtests
    const { data: backtests } = await supabase.from('backtests')
      .select('strategy_id, total_trades, win_rate, net_profit, test_year, symbol, timeframe')
      .eq('status', 'manual')

    if (backtests) {
      const grouped: Record<string, any> = {}
      backtests.forEach(bt => {
        const sid = bt.strategy_id
        if (!grouped[sid]) grouped[sid] = { sessions: 0, totalTrades: 0, totalProfit: 0, winRates: [], years: new Set(), pairs: new Set() }
        grouped[sid].sessions++
        grouped[sid].totalTrades += bt.total_trades || 0
        grouped[sid].totalProfit += bt.net_profit || 0
        if (bt.win_rate) grouped[sid].winRates.push(bt.win_rate)
        if (bt.test_year) grouped[sid].years.add(bt.test_year)
        if (bt.symbol) grouped[sid].pairs.add(bt.symbol)
      })
      // Hitung avg WR
      Object.keys(grouped).forEach(k => {
        const g = grouped[k]
        g.avgWR = g.winRates.length > 0 ? g.winRates.reduce((s: number, r: number) => s + r, 0) / g.winRates.length : 0
        g.years = Array.from(g.years).sort().reverse()
        g.pairs = Array.from(g.pairs)
      })
      setStrategyStats(grouped)
    }
  }

  // Filter strategi berdasarkan pencarian
  const filtered = strategies.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.parameters?.type || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Strategies</h1>
          <p className="text-sm text-zinc-500">Kelola dan analisis performa setiap strategi trading Anda.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger>
            <Button className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 font-black text-sm h-10 px-6 rounded-xl shadow-lg shadow-indigo-500/15">
              <Plus className="h-4 w-4 mr-2" /> New Strategy
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl bg-zinc-950 border-zinc-800 text-zinc-50">
            <DialogHeader><DialogTitle>Create Strategy</DialogTitle></DialogHeader>
            <StrategyForm onSuccess={() => { setDialogOpen(false); fetchData() }} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-zinc-900 border-zinc-800 h-10 rounded-xl text-sm" placeholder="Cari strategi..." />
      </div>

      {/* Strategy Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(s => {
          const st = strategyStats[s.id] || { sessions: 0, totalTrades: 0, totalProfit: 0, avgWR: 0, years: [], pairs: [] }
          const confs = s.parameters?.confirmations || []
          return (
            <Link key={s.id} href={`/strategies/${s.id}`}>
              <Card className="bg-zinc-900/50 border-zinc-800/50 hover:border-indigo-500/30 transition-all group cursor-pointer h-full">
                <CardContent className="p-5 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/15 flex items-center justify-center text-indigo-400 group-hover:from-indigo-500/30 group-hover:to-violet-500/30 transition-all">
                        <Zap className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-sm">{s.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className="text-[8px] h-4 py-0 border-zinc-800 text-zinc-500">{s.parameters?.type}</Badge>
                          {confs.length > 0 && (
                            <Badge variant="outline" className="text-[8px] h-4 py-0 border-indigo-500/20 text-indigo-400">
                              <ListChecks className="h-2.5 w-2.5 mr-0.5" /> {confs.length} rules
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-zinc-700 group-hover:text-indigo-400 transition-colors" />
                  </div>

                  {/* Description */}
                  {s.description && (
                    <p className="text-[10px] text-zinc-600 line-clamp-2">{s.description}</p>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Sessions", value: st.sessions, icon: Activity },
                      { label: "Trades", value: st.totalTrades, icon: Hash },
                      { label: "Win Rate", value: `${st.avgWR.toFixed(1)}%`, icon: Target, color: st.avgWR >= 50 ? "text-emerald-400" : st.avgWR > 0 ? "text-rose-400" : "text-zinc-500" },
                      { label: "P/L", value: `${st.totalProfit >= 0 ? '+' : ''}$${st.totalProfit.toFixed(0)}`, icon: DollarSign, color: st.totalProfit >= 0 ? "text-emerald-400" : "text-rose-400" },
                    ].map((m, i) => (
                      <div key={i} className="bg-zinc-950/50 rounded-lg px-2 py-1.5 text-center">
                        <p className="text-[7px] font-black text-zinc-700 uppercase">{m.label}</p>
                        <p className={`text-xs font-black tabular-nums ${m.color || 'text-zinc-300'}`}>{m.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Pairs & Years */}
                  {(st.pairs.length > 0 || st.years.length > 0) && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {st.pairs.slice(0, 3).map((p: string) => (
                        <Badge key={p} className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[7px] h-4 py-0">{p}</Badge>
                      ))}
                      {st.pairs.length > 3 && <Badge variant="outline" className="border-zinc-800 text-zinc-600 text-[7px] h-4 py-0">+{st.pairs.length - 3}</Badge>}
                      {st.years.slice(0, 3).map((y: string) => (
                        <Badge key={y} variant="outline" className="border-zinc-800 text-zinc-600 text-[7px] h-4 py-0">
                          <Calendar className="h-2 w-2 mr-0.5" /> {y}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-600 gap-3">
          <Zap className="h-8 w-8 opacity-20" />
          <p className="text-sm font-bold">{search ? "Tidak ditemukan" : "Belum ada strategi"}</p>
          <p className="text-xs text-zinc-700">Buat strategi pertama Anda untuk mulai backtesting.</p>
        </div>
      )}
    </div>
  )
}
