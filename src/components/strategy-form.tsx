"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, X, GripVertical, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"

const formSchema = z.object({
  name: z.string().min(2, { message: "Minimal 2 karakter." }),
  description: z.string().optional(),
  type: z.enum(["SMC", "ICT", "Price Action", "Indicator", "Manual"]),
  initialBalance: z.number().min(1),
  riskPerTrade: z.number().min(0.1).max(100),
})
type FormValues = z.infer<typeof formSchema>

// Template konfirmasi berdasarkan tipe strategi
const CONFIRMATION_TEMPLATES: Record<string, string[]> = {
  SMC: ["Market Structure (BOS/CHoCH)", "Order Block identified", "Fair Value Gap (FVG)", "Liquidity Sweep", "Session Timing", "Risk:Reward ≥ 1:2"],
  ICT: ["Market Structure Shift", "Order Block / Breaker", "FVG / IFVG", "Liquidity Pool", "Optimal Trade Entry", "Killzone Timing"],
  "Price Action": ["Support/Resistance level", "Candlestick pattern", "Trend confirmation", "Volume confirmation"],
  Indicator: ["Signal confirmed", "Filter condition met", "Trend alignment"],
  Manual: ["Entry rule verified"],
}

export function StrategyForm({ onSuccess }: { onSuccess?: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Daftar konfirmasi yang bisa di-edit user
  const [confirmations, setConfirmations] = useState<string[]>(CONFIRMATION_TEMPLATES.SMC)
  const [newConf, setNewConf] = useState("")

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", description: "", type: "SMC", initialBalance: 1000, riskPerTrade: 1 },
  })

  // Saat type berubah, load template konfirmasi
  function handleTypeChange(type: string) {
    form.setValue("type", type as any)
    setConfirmations(CONFIRMATION_TEMPLATES[type] || ["Entry rule verified"])
  }

  function addConfirmation() {
    if (newConf.trim()) { setConfirmations([...confirmations, newConf.trim()]); setNewConf("") }
  }
  function removeConfirmation(index: number) {
    setConfirmations(confirmations.filter((_, i) => i !== index))
  }

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('strategies').insert({
        name: values.name,
        description: values.description || "",
        parameters: { type: values.type, riskPerTrade: values.riskPerTrade, confirmations },
        risk_config: { initialBalance: values.initialBalance }
      })
      if (error) throw error
      form.reset(); setConfirmations(CONFIRMATION_TEMPLATES.SMC); onSuccess?.()
    } catch (err: any) { alert("Error: " + err.message) }
    finally { setIsSubmitting(false) }
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-lg">Create Strategy</CardTitle>
        <CardDescription>Definisikan rules dan konfirmasi trading Anda.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Name + Type */}
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Nama Strategi</FormLabel><FormControl>
                  <Input placeholder="SMC Gold Scalper" {...field} className="bg-zinc-950 border-zinc-800" />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem><FormLabel>Tipe</FormLabel>
                  <Select onValueChange={(v) => handleTypeChange(v || "SMC")} value={form.watch("type") || "SMC"}>
                    <FormControl><SelectTrigger className="bg-zinc-950 border-zinc-800"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent className="bg-zinc-950 border-zinc-800">
                      {["SMC", "ICT", "Price Action", "Indicator", "Manual"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Description */}
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Deskripsi</FormLabel><FormControl>
                <Textarea placeholder="Jelaskan rules strategi ini secara singkat..." {...field} className="bg-zinc-950 border-zinc-800 min-h-[60px] resize-none" />
              </FormControl><FormMessage /></FormItem>
            )} />

            {/* Confirmation Rules */}
            <div className="space-y-3 bg-zinc-950/50 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-indigo-400" />
                <span className="text-sm font-black">Confirmation Rules</span>
                <span className="text-[9px] text-zinc-600 ml-auto">{confirmations.length} rules</span>
              </div>
              <p className="text-[10px] text-zinc-600">Daftar konfirmasi yang harus dicentang sebelum entry. Bisa di-edit sesuai kebutuhan.</p>
              <div className="space-y-1.5">
                {confirmations.map((conf, i) => (
                  <div key={i} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 group">
                    <span className="text-[10px] text-zinc-600 font-mono w-4">{i + 1}.</span>
                    <span className="text-xs text-zinc-300 flex-1">{conf}</span>
                    <button type="button" onClick={() => removeConfirmation(i)} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-400 transition-all">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={newConf} onChange={(e) => setNewConf(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addConfirmation() } }}
                  placeholder="Tambah konfirmasi baru..." className="bg-zinc-900 border-zinc-800 h-8 text-xs flex-1" />
                <Button type="button" size="sm" variant="outline" onClick={addConfirmation} className="h-8 border-zinc-700 text-xs"><Plus className="h-3 w-3 mr-1" /> Add</Button>
              </div>
            </div>

            {/* Balance + Risk */}
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="initialBalance" render={({ field }) => (
                <FormItem><FormLabel>Balance Awal ($)</FormLabel><FormControl>
                  <Input type="number" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} className="bg-zinc-950 border-zinc-800" />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="riskPerTrade" render={({ field }) => (
                <FormItem><FormLabel>Risk Per Trade (%)</FormLabel><FormControl>
                  <Input type="number" step="0.1" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} className="bg-zinc-950 border-zinc-800" />
                </FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 font-bold" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Strategy"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
