"use client"

import { useState, useEffect } from "react"
import {
  TrendingUp, BarChart3, Plus, ArrowUpRight, Zap, Play, Clock, Target,
  ChevronRight, Hash, Flame, ListChecks, Activity
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { getRecentSessions } from "@/lib/actions"
import { StrategyForm } from "@/components/strategy-form"
import Link from "next/link"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"

export default function Dashboard() {
  const [strategies, setStrategies] = useState<any[]>([])
  const [recentSessions, setRecentSessions] = useState<any[]>([])
  const [globalStats, setGlobalStats] = useState({ totalTrades: 0, totalSessions: 0, avgWinRate: 0 })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    // Ambil semua strategi
    const { data: strats } = await supabase.from('strategies').select('*').order('created_at', { ascending: false })
    if (strats) setStrategies(strats)

    // Ambil sesi terakhir
    const sessions = await getRecentSessions(8)
    setRecentSessions(sessions)

    // Hitung global stats dari semua sesi manual
    const { data: allBt } = await supabase.from('backtests').select('total_trades, win_rate').eq('status', 'manual')
    if (allBt && allBt.length > 0) {
      const totalTrades = allBt.reduce((s: number, b: any) => s + (b.total_trades || 0), 0)
      const avgWR = allBt.reduce((s: number, b: any) => s + (b.win_rate || 0), 0) / allBt.length
      setGlobalStats({ totalTrades, totalSessions: allBt.length, avgWinRate: avgWR })
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-[1400px] mx-auto animate-in fade-in duration-700">
      {/* HEADER */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Backtesting Journal</h1>
          <p className="text-sm text-zinc-500">Catat, analisis, dan sempurnakan strategi trading Anda.</p>
        </div>
        <Link href="/manual-backtest">
          <Button className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 font-black text-sm h-10 px-6 group rounded-xl shadow-lg shadow-indigo-500/15">
            <Play className="h-4 w-4 mr-2" /> Start Session <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </Link>
      </div>

      {/* GLOBAL STATS */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Trades", value: globalStats.totalTrades, icon: Hash, color: "text-indigo-400", bg: "bg-indigo-500/5" },
          { label: "Total Sessions", value: globalStats.totalSessions, icon: Activity, color: "text-violet-400", bg: "bg-violet-500/5" },
          { label: "Avg Win Rate", value: `${globalStats.avgWinRate.toFixed(1)}%`, icon: Target, color: globalStats.avgWinRate >= 50 ? "text-emerald-400" : "text-rose-400", bg: globalStats.avgWinRate >= 50 ? "bg-emerald-500/5" : "bg-rose-500/5" },
        ].map((s, i) => (
          <Card key={i} className={`border-zinc-800/50 ${s.bg}`}>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{s.label}</p>
                <p className="text-2xl font-black mt-1">{s.value}</p>
              </div>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center border border-white/5 ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* STRATEGIES */}
        <div className="lg:col-span-3">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-black">Strategies</CardTitle>
                <CardDescription className="text-xs">Daftar strategi yang bisa Anda uji.</CardDescription>
              </div>
              <Dialog>
                <DialogTrigger render={<Button size="sm" variant="outline" className="h-8 text-xs border-zinc-700 font-bold" />}>
                  <Plus className="h-3 w-3 mr-1" /> Baru
                </DialogTrigger>
                <DialogContent className="max-w-xl bg-zinc-950 border-zinc-800 text-zinc-50">
                  <DialogHeader>
                    <DialogTitle>Create Strategy</DialogTitle>
                    <DialogDescription>Definisikan strategi beserta confirmation rules.</DialogDescription>
                  </DialogHeader>
                  <StrategyForm onSuccess={fetchData} />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-zinc-800/40">
                {strategies.length > 0 ? strategies.map(s => {
                  const confs = s.parameters?.confirmations || []
                  return (
                    <Link key={s.id} href={`/strategies/${s.id}`}>
                      <div className="flex items-center justify-between px-5 py-4 hover:bg-zinc-800/20 transition-colors group cursor-pointer">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center text-indigo-400">
                            <Zap className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm">{s.name}</span>
                              <Badge variant="outline" className="text-[8px] h-4 py-0 border-zinc-800 text-zinc-500">{s.parameters?.type}</Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {confs.length > 0 && (
                                <span className="text-[9px] text-zinc-600 flex items-center gap-1">
                                  <ListChecks className="h-3 w-3" /> {confs.length} rules
                                </span>
                              )}
                              <span className="text-[9px] text-zinc-700">{s.description?.slice(0, 50)}{s.description?.length > 50 ? '...' : ''}</span>
                            </div>
                          </div>
                        </div>
                        <ArrowUpRight className="h-4 w-4 text-zinc-700 group-hover:text-indigo-400 transition-colors" />
                      </div>
                    </Link>
                  )
                }) : (
                  <div className="px-5 py-12 text-center text-zinc-600 text-sm">Belum ada strategi. Buat yang pertama!</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RECENT SESSIONS */}
        <div className="lg:col-span-2">
          <Card className="bg-zinc-900/50 border-zinc-800 h-full">
            <CardHeader>
              <CardTitle className="text-base font-black flex items-center gap-2"><Clock className="h-4 w-4 text-indigo-400" /> Recent Sessions</CardTitle>
              <CardDescription className="text-xs">Sesi backtest terakhir.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-zinc-800/40">
                {recentSessions.length > 0 ? recentSessions.map((s, i) => (
                  <div key={s.id} className="px-5 py-3 hover:bg-zinc-800/15 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold">{(s.strategies as any)?.name || '—'}</span>
                          <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[8px] h-4 py-0">{s.symbol}</Badge>
                          <Badge variant="outline" className="border-zinc-800 text-zinc-500 text-[8px] h-4 py-0">{s.timeframe}</Badge>
                          <Badge variant="outline" className="border-zinc-800 text-zinc-500 text-[8px] h-4 py-0">{s.test_year}</Badge>
                        </div>
                        <p className="text-[9px] text-zinc-600 mt-0.5">{s.total_trades || 0} trades • {(s.win_rate || 0).toFixed(1)}% WR</p>
                      </div>
                      <span className={`text-xs font-black tabular-nums ${(s.net_profit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {(s.net_profit || 0) >= 0 ? '+' : ''}{(s.net_profit || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )) : (
                  <div className="px-5 py-12 text-center text-zinc-600 text-xs">Belum ada sesi. Start session untuk mulai!</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
