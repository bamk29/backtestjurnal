"use client"

import { useState, useEffect, useMemo } from "react"
import {
  ChevronRight, DollarSign, Play, Zap, History, CheckCircle2, XCircle,
  AlertCircle, Target, ArrowLeft, Hash, StickyNote, Flame, Activity,
  ChevronDown, TrendingUp, BarChart3, Clock, Plus, Minus
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"
import { saveManualTrade, saveQuickTrade } from "@/lib/actions"
import { calculateProfit, TradeType } from "@/lib/trade-utils"
import { INSTRUMENT_GROUPS, TIMEFRAMES, SETUP_TYPES, MARKET_SESSIONS, EXECUTION_FACTORS, ALL_PAIRS, getYearList } from "@/lib/constants"

export default function ManualBacktestPage() {
  /* ===== STATE ===== */
  const [step, setStep] = useState<'setup' | 'workspace'>('setup')
  const [session, setSession] = useState({ strategyId: "", symbol: "XAUUSD", timeframe: "M15", year: new Date().getFullYear().toString(), description: "" })
  const [strategies, setStrategies] = useState<any[]>([])
  const [confirmations, setConfirmations] = useState<string[]>([])
  const [isQuickMode, setIsQuickMode] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [trades, setTrades] = useState<any[]>([])
  const [flashResult, setFlashResult] = useState<'win' | 'loss' | null>(null)

  // Speed Mode fields
  const [quickAmount, setQuickAmount] = useState("10")
  const [direction, setDirection] = useState<'long' | 'short'>('long')
  const [checklist, setChecklist] = useState<boolean[]>([])
  const [setupType, setSetupType] = useState("")
  const [marketSession, setMarketSession] = useState("")
  const [execFactor, setExecFactor] = useState("rules")
  const [entryReason, setEntryReason] = useState("")
  const [obstacles, setObstacles] = useState("")
  const [notes, setNotes] = useState("")

  // Pro Mode fields
  const [proForm, setProForm] = useState({ entry: "", exit: "", lots: "0.1", sl: "", tp: "" })

  const years = getYearList()

  /* ===== COMPUTED ===== */
  const confirmedCount = checklist.filter(Boolean).length
  const selectedStrategy = strategies.find(s => s.id === session.strategyId)

  const liveStats = useMemo(() => {
    const profits = trades.map(t => t.profit_loss || 0)
    const wins = profits.filter(p => p > 0)
    const losses = profits.filter(p => p < 0)
    const netPL = profits.reduce((s, p) => s + p, 0)
    const winRate = profits.length > 0 ? (wins.length / profits.length) * 100 : 0
    const avgWin = wins.length > 0 ? wins.reduce((s, p) => s + p, 0) / wins.length : 0
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, p) => s + p, 0) / losses.length) : 0
    const rr = avgLoss > 0 ? avgWin / avgLoss : 0
    const totalWin = wins.reduce((s, p) => s + p, 0)
    const totalLoss = Math.abs(losses.reduce((s, p) => s + p, 0))
    const pf = totalLoss > 0 ? totalWin / totalLoss : 0
    let streak = 0, streakType: 'win' | 'loss' | null = null
    for (const t of trades) {
      const isW = (t.profit_loss || 0) > 0
      if (!streakType) { streakType = isW ? 'win' : 'loss'; streak = 1 }
      else if ((isW && streakType === 'win') || (!isW && streakType === 'loss')) streak++
      else break
    }
    return { total: profits.length, wins: wins.length, losses: losses.length, netPL, winRate, avgWin, avgLoss, rr, pf, streak, streakType }
  }, [trades])

  /* ===== EFFECTS ===== */
  useEffect(() => { fetchStrategies() }, [])
  useEffect(() => {
    if (strategies.length > 0 && !session.strategyId) setSession(p => ({ ...p, strategyId: strategies[0].id }))
  }, [strategies, session.strategyId])
  useEffect(() => {
    // Load konfirmasi dari strategi yang dipilih
    const s = strategies.find(x => x.id === session.strategyId)
    const confs = s?.parameters?.confirmations || []
    setConfirmations(confs)
    setChecklist(new Array(confs.length).fill(false))
  }, [session.strategyId, strategies])
  useEffect(() => {
    if (step === 'workspace' && session.strategyId) fetchTrades()
  }, [step, session.strategyId])

  /* ===== DATA ===== */
  async function fetchStrategies() {
    const { data } = await supabase.from('strategies').select('*').order('created_at', { ascending: false })
    if (data) setStrategies(data)
  }
  async function fetchTrades() {
    const { data: bt } = await supabase.from('backtests').select('id')
      .eq('strategy_id', session.strategyId).eq('status', 'manual')
      .eq('symbol', session.symbol).eq('timeframe', session.timeframe).eq('test_year', session.year).single()
    if (bt) {
      const { data } = await supabase.from('trades').select('*').eq('backtest_id', bt.id).order('entry_time', { ascending: false }).limit(100)
      if (data) setTrades(data)
    } else setTrades([])
  }

  /* ===== HANDLERS ===== */
  function resetTradeForm() {
    setChecklist(new Array(confirmations.length).fill(false))
    setEntryReason(""); setObstacles(""); setNotes("")
  }

  async function handleQuickLog(result: 'win' | 'loss') {
    if (isSubmitting || !quickAmount || parseFloat(quickAmount) <= 0) return
    setIsSubmitting(true); setFlashResult(result)
    const res = await saveQuickTrade({
      strategyId: session.strategyId, symbol: session.symbol, timeframe: session.timeframe, testYear: session.year,
      result, amount: parseFloat(quickAmount), direction, confirmationsMet: checklist,
      entryReason, executionFactor: execFactor, setupType, marketSession, obstacles, notes, description: session.description
    })
    if (res.success) { resetTradeForm(); await fetchTrades() }
    setTimeout(() => setFlashResult(null), 500)
    setIsSubmitting(false)
  }

  async function handleProSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!proForm.entry || !proForm.exit) return
    setIsSubmitting(true)
    const res = await saveManualTrade({
      strategyId: session.strategyId, symbol: session.symbol, timeframe: session.timeframe, testYear: session.year,
      type: direction === 'long' ? 'long' : 'short', entry: parseFloat(proForm.entry), exit: parseFloat(proForm.exit), lots: parseFloat(proForm.lots),
      confirmationsMet: checklist, entryReason, executionFactor: execFactor, setupType, marketSession, obstacles, notes, description: session.description
    })
    if (res.success) { setProForm({ entry: "", exit: "", lots: "0.1", sl: "", tp: "" }); resetTradeForm(); await fetchTrades() }
    setIsSubmitting(false)
  }

  /* =========================================================
     SESSION SETUP SCREEN
     ========================================================= */
  if (step === 'setup') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-500">
        <Card className="w-full max-w-lg bg-zinc-900/60 border-zinc-800/60 backdrop-blur-2xl shadow-2xl">
          <CardHeader className="text-center space-y-3 pb-2">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-2xl shadow-indigo-500/25">
              <Play className="h-7 w-7 text-white ml-0.5" />
            </div>
            <div>
              <CardTitle className="text-xl font-black">New Backtest Session</CardTitle>
              <CardDescription className="text-xs mt-1">Pilih parameter sebelum mulai testing.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {/* Strategy */}
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Strategy</Label>
              <Select value={session.strategyId} onValueChange={(v) => v && setSession({ ...session, strategyId: v })}>
                <SelectTrigger className="h-10 bg-zinc-950 border-zinc-800 font-bold text-sm">
                  <SelectValue>{selectedStrategy?.name || "—"}</SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 shadow-2xl">
                  {strategies.map(s => <SelectItem key={s.id} value={s.id}>{s.name} <span className="text-zinc-500 ml-1">({s.parameters?.type})</span></SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Pair + Timeframe */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Pair</Label>
                <Select value={session.symbol} onValueChange={(v) => v && setSession({ ...session, symbol: v })}>
                  <SelectTrigger className="h-10 bg-zinc-950 border-zinc-800 font-bold text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-950 border-zinc-800 shadow-2xl max-h-[300px]">
                    {INSTRUMENT_GROUPS.map(g => (
                      <div key={g.label}>
                        <div className="px-2 py-1.5 text-[10px] font-black text-zinc-600 uppercase tracking-widest">{g.label}</div>
                        {g.items.map(p => <SelectItem key={p.value} value={p.value}><span className="font-bold">{p.label}</span> <span className="text-zinc-600 text-xs">({p.desc})</span></SelectItem>)}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Timeframe</Label>
                <Select value={session.timeframe} onValueChange={(v) => v && setSession({ ...session, timeframe: v })}>
                  <SelectTrigger className="h-10 bg-zinc-950 border-zinc-800 font-bold text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-950 border-zinc-800 shadow-2xl">
                    {TIMEFRAMES.map(t => <SelectItem key={t.value} value={t.value}><span className="font-bold">{t.label}</span> <span className="text-zinc-600 text-xs">({t.desc})</span></SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Year */}
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Year</Label>
              <Select value={session.year} onValueChange={(v) => v && setSession({ ...session, year: v })}>
                <SelectTrigger className="h-10 bg-zinc-950 border-zinc-800 font-bold text-sm"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 shadow-2xl">{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Deskripsi Sesi (opsional)</Label>
              <Textarea value={session.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSession({ ...session, description: e.target.value })}
                className="bg-zinc-950 border-zinc-800 min-h-[60px] resize-none text-sm rounded-xl" placeholder="Menguji BOS+FVG di London session..." />
            </div>

            <Button onClick={() => { if (session.strategyId) setStep('workspace') }} disabled={!session.strategyId}
              className="w-full h-12 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 font-black text-sm group rounded-xl">
              Start Backtesting <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  /* =========================================================
     ACTIVE WORKSPACE
     ========================================================= */
  const pairInfo = ALL_PAIRS.find(p => p.value === session.symbol)

  return (
    <div className="flex flex-col gap-5 p-5 lg:p-6 max-w-[1440px] mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setStep('setup')} className="h-8 w-8 rounded-lg text-zinc-500 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-black">{selectedStrategy?.name}</h1>
              <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[9px] font-black">{session.symbol}</Badge>
              <Badge variant="outline" className="border-zinc-800 text-zinc-500 text-[9px] font-black">{session.timeframe}</Badge>
              <Badge variant="outline" className="border-zinc-800 text-zinc-500 text-[9px] font-black">{session.year}</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-800 py-1 px-2.5 rounded-lg">
            <span className="text-[9px] font-bold text-zinc-600">PRO</span>
            <Switch checked={isQuickMode} onCheckedChange={setIsQuickMode} className="data-[state=checked]:bg-indigo-600 scale-75" />
            <span className="text-[9px] font-bold text-zinc-600">SPEED</span>
          </div>
        </div>
      </div>

      {/* LIVE STATS */}
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
        {[
          { label: "Total", value: liveStats.total, color: "text-white" },
          { label: "Win Rate", value: `${liveStats.winRate.toFixed(1)}%`, color: liveStats.winRate >= 50 ? "text-emerald-400" : "text-rose-400" },
          { label: "Net P/L", value: `${liveStats.netPL >= 0 ? '+' : ''}${liveStats.netPL.toFixed(2)}`, color: liveStats.netPL >= 0 ? "text-emerald-400" : "text-rose-400" },
          { label: "Avg Win", value: `+${liveStats.avgWin.toFixed(2)}`, color: "text-emerald-400" },
          { label: "Avg Loss", value: `-${liveStats.avgLoss.toFixed(2)}`, color: "text-rose-400" },
          { label: "R:R", value: `${liveStats.rr.toFixed(2)}:1`, color: liveStats.rr >= 1 ? "text-emerald-400" : "text-rose-400" },
          { label: "PF", value: liveStats.pf.toFixed(2), color: liveStats.pf >= 1 ? "text-emerald-400" : "text-rose-400" },
          { label: "Streak", value: `${liveStats.streak}${liveStats.streakType === 'win' ? 'W' : 'L'}`, color: liveStats.streakType === 'win' ? "text-emerald-400" : "text-rose-400" },
        ].map((s, i) => (
          <div key={i} className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg px-2.5 py-2">
            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-wider">{s.label}</p>
            <p className={`text-sm font-black ${s.color} tabular-nums`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* MAIN CONTENT */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* LEFT: Trade Entry */}
        <div className="lg:col-span-2 space-y-4">
          <Card className={`bg-zinc-900/40 border-zinc-800/50 relative overflow-hidden transition-all duration-300 ${flashResult === 'win' ? 'ring-2 ring-emerald-500/40' : flashResult === 'loss' ? 'ring-2 ring-rose-500/40' : ''}`}>
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-emerald-500 via-indigo-500 to-rose-500" />
            <CardContent className="pt-5 space-y-4">

              {/* BUY / SELL Toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setDirection('long')}
                  className={`h-10 rounded-xl font-black text-sm flex items-center justify-center gap-1.5 transition-all ${direction === 'long' ? 'bg-emerald-500/15 border-2 border-emerald-500/50 text-emerald-400' : 'bg-zinc-950 border-2 border-zinc-800 text-zinc-600 hover:border-zinc-700'}`}>
                  <TrendingUp className="h-4 w-4" /> BUY
                </button>
                <button onClick={() => setDirection('short')}
                  className={`h-10 rounded-xl font-black text-sm flex items-center justify-center gap-1.5 transition-all ${direction === 'short' ? 'bg-rose-500/15 border-2 border-rose-500/50 text-rose-400' : 'bg-zinc-950 border-2 border-zinc-800 text-zinc-600 hover:border-zinc-700'}`}>
                  <TrendingUp className="h-4 w-4 rotate-180" /> SELL
                </button>
              </div>

              {/* Confirmation Checklist */}
              {confirmations.length > 0 && (
                <div className="space-y-2 bg-zinc-950/50 border border-zinc-800/50 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-[9px] font-black uppercase text-zinc-500">Confirmation Checklist</Label>
                    <Badge className={`text-[9px] font-black ${confirmedCount === confirmations.length ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                      {confirmedCount}/{confirmations.length}
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    {confirmations.map((conf, i) => (
                      <label key={i} className="flex items-center gap-2.5 cursor-pointer group" onClick={() => { const c = [...checklist]; c[i] = !c[i]; setChecklist(c) }}>
                        <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all ${checklist[i] ? 'bg-emerald-500/20 border-emerald-500' : 'border-zinc-700 group-hover:border-zinc-500'}`}>
                          {checklist[i] && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                        </div>
                        <span className={`text-xs ${checklist[i] ? 'text-zinc-300' : 'text-zinc-500'}`}>{conf}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {isQuickMode ? (
                /* ===== SPEED MODE: Nominal ===== */
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-zinc-500">Nominal (USD)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-400" />
                    <Input type="number" value={quickAmount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuickAmount(e.target.value)}
                      className="pl-8 h-11 bg-zinc-950 border-zinc-800 text-lg font-black rounded-xl" min="0" step="any" />
                  </div>
                  <p className="text-[9px] text-zinc-700">WIN → <span className="text-emerald-500">+${quickAmount || '0'}</span> | LOSE → <span className="text-rose-500">-${quickAmount || '0'}</span></p>
                </div>
              ) : (
                /* ===== PRO MODE: Entry/Exit/Lots ===== */
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-zinc-500">Entry</Label>
                      <Input type="number" step="any" value={proForm.entry} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProForm({ ...proForm, entry: e.target.value })} className="bg-zinc-950 border-zinc-800 h-10 rounded-lg font-mono text-sm" placeholder="0.00" /></div>
                    <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-zinc-500">Exit</Label>
                      <Input type="number" step="any" value={proForm.exit} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProForm({ ...proForm, exit: e.target.value })} className="bg-zinc-950 border-zinc-800 h-10 rounded-lg font-mono text-sm" placeholder="0.00" /></div>
                    <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-zinc-500">Lots</Label>
                      <Input type="number" step="0.01" min="0.01" value={proForm.lots} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProForm({ ...proForm, lots: e.target.value })} className="bg-zinc-950 border-zinc-800 h-10 rounded-lg font-bold text-sm" /></div>
                  </div>
                  {/* Live P/L Preview */}
                  {proForm.entry && proForm.exit && (() => {
                    const { profit, pips } = calculateProfit(session.symbol, direction === 'long' ? 'long' : 'short', parseFloat(proForm.entry), parseFloat(proForm.exit), parseFloat(proForm.lots))
                    return <div className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
                      <span className={`text-base font-black ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{profit >= 0 ? '+' : ''}{profit.toFixed(2)} USD</span>
                      <span className="text-[10px] text-zinc-600 ml-2 font-bold">{pips.toFixed(1)} pips</span>
                    </div>
                  })()}
                </div>
              )}

              {/* SHARED: Setup, Session, Factor, Alasan, Kendala, Catatan */}
              <div className="border-t border-zinc-800/50 pt-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[8px] font-black uppercase text-zinc-600">Setup</Label>
                    <Select value={setupType} onValueChange={(v) => v && setSetupType(v)}>
                      <SelectTrigger className="h-8 bg-zinc-950 border-zinc-800 text-[11px] rounded-lg"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-zinc-800 shadow-2xl">
                        {SETUP_TYPES.map(s => <SelectItem key={s.value} value={s.value}><span>{s.emoji} {s.label}</span></SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[8px] font-black uppercase text-zinc-600">Session</Label>
                    <Select value={marketSession} onValueChange={(v) => v && setMarketSession(v)}>
                      <SelectTrigger className="h-8 bg-zinc-950 border-zinc-800 text-[11px] rounded-lg"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-zinc-800 shadow-2xl">
                        {MARKET_SESSIONS.map(s => <SelectItem key={s.value} value={s.value}><span>{s.emoji} {s.label}</span></SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[8px] font-black uppercase text-zinc-600">Faktor</Label>
                    <Select value={execFactor} onValueChange={(v) => v && setExecFactor(v)}>
                      <SelectTrigger className="h-8 bg-zinc-950 border-zinc-800 text-[11px] rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-zinc-800 shadow-2xl">
                        {EXECUTION_FACTORS.map(f => <SelectItem key={f.value} value={f.value}><span>{f.emoji} {f.label}</span></SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[8px] font-black uppercase text-zinc-600">Alasan Entry</Label>
                  <Input value={entryReason} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEntryReason(e.target.value)} className="bg-zinc-950 border-zinc-800 h-8 text-xs rounded-lg" placeholder="BOS confirmed + FVG entry..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-[8px] font-black uppercase text-zinc-600">Kendala</Label>
                  <Input value={obstacles} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setObstacles(e.target.value)} className="bg-zinc-950 border-zinc-800 h-8 text-xs rounded-lg" placeholder="Spread melebar, news impact..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-[8px] font-black uppercase text-zinc-600">Catatan</Label>
                  <Textarea value={notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                    className="bg-zinc-950 border-zinc-800 min-h-[50px] rounded-lg resize-none text-xs" placeholder="Catatan tambahan..." />
                </div>
              </div>

              {/* ===== SUBMIT: WIN/LOSE (Speed) atau Save Trade (Pro) — paling akhir ===== */}
              <div className="border-t border-zinc-800/50 pt-4">
                {isQuickMode ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button disabled={isSubmitting} onClick={() => handleQuickLog('win')}
                      className="h-16 bg-emerald-500/5 hover:bg-emerald-500/15 border-2 border-emerald-500/20 hover:border-emerald-500/50 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      <span className="text-base font-black text-emerald-500">WIN</span>
                      <span className="text-[10px] text-emerald-600 font-bold">+${quickAmount || '0'}</span>
                    </button>
                    <button disabled={isSubmitting} onClick={() => handleQuickLog('loss')}
                      className="h-16 bg-rose-500/5 hover:bg-rose-500/15 border-2 border-rose-500/20 hover:border-rose-500/50 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer">
                      <XCircle className="h-5 w-5 text-rose-500" />
                      <span className="text-base font-black text-rose-500">LOSE</span>
                      <span className="text-[10px] text-rose-600 font-bold">-${quickAmount || '0'}</span>
                    </button>
                  </div>
                ) : (
                  <Button type="button" onClick={(e: any) => handleProSubmit(e)} disabled={isSubmitting || !proForm.entry || !proForm.exit}
                    className="w-full h-12 bg-gradient-to-r from-indigo-600 to-violet-600 font-black rounded-xl text-sm">
                    {isSubmitting ? 'Saving...' : 'Save Trade'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Trade Log */}
        <div className="lg:col-span-3">
          <Card className="bg-zinc-900/40 border-zinc-800/50 h-full">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-black flex items-center gap-2"><History className="h-4 w-4 text-indigo-400" /> Trade Log</CardTitle>
                <div className="flex items-center gap-1.5 text-[9px] font-black">
                  <span className="text-emerald-500">{liveStats.wins}W</span><span className="text-zinc-700">/</span><span className="text-rose-500">{liveStats.losses}L</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto">
                {trades.length > 0 ? (
                  <div className="divide-y divide-zinc-800/30">
                    {trades.map((t, i) => {
                      const isWin = (t.profit_loss || 0) > 0
                      const num = trades.length - i
                      const confs = t.confirmations_met as boolean[] | null
                      const confCount = confs ? confs.filter(Boolean).length : null
                      const confTotal = confs ? confs.length : null
                      return (
                        <div key={t.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-zinc-800/15 transition-colors">
                          <span className="text-[9px] text-zinc-700 font-mono w-6 text-right">#{num}</span>
                          <div className={`h-1.5 w-1.5 rounded-full ${isWin ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[10px] font-black ${isWin ? 'text-emerald-500' : 'text-rose-500'}`}>{isWin ? 'WIN' : 'LOSS'}</span>
                              <span className={`text-[9px] font-bold ${t.trade_direction === 'long' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.trade_direction === 'long' ? 'BUY' : 'SELL'}</span>
                              {confCount !== null && <Badge variant="outline" className="text-[8px] h-4 py-0 border-zinc-800 text-zinc-500">{confCount}/{confTotal}</Badge>}
                              {t.setup_type && <Badge variant="outline" className="text-[8px] h-4 py-0 border-zinc-800 text-zinc-500">{t.setup_type}</Badge>}
                              {t.execution_factor && t.execution_factor !== 'rules' && (
                                <Badge className="text-[8px] h-4 py-0 bg-amber-500/10 text-amber-400 border-amber-500/20">{EXECUTION_FACTORS.find(f => f.value === t.execution_factor)?.emoji} {t.execution_factor}</Badge>
                              )}
                            </div>
                            {(t.entry_reason || t.notes) && <p className="text-[9px] text-zinc-600 truncate mt-0.5">{t.entry_reason || t.notes}</p>}
                          </div>
                          <span className={`text-xs font-black tabular-nums ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isWin ? '+' : ''}{t.profit_loss?.toFixed(2)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-700 gap-2">
                    <AlertCircle className="h-6 w-6 opacity-20" /><p className="text-[10px] font-bold uppercase">Belum ada trade</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
