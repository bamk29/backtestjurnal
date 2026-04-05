"use client"

import { useState } from "react"
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import Papa from "papaparse"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

export function CSVImporter() {
  const [isUploading, setIsUploading] = useState(false)
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error', message?: string }>({ type: 'idle' })

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setStatus({ type: 'idle' })

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const { data } = results
          if (data.length === 0) throw new Error("CSV is empty")

          const firstRow = data[0] as any
          const required = ['open', 'high', 'low', 'close']
          const missing = required.filter(col => !Object.keys(firstRow).some(k => k.toLowerCase() === col))

          if (missing.length > 0) {
            throw new Error(`Missing required OHLC columns: ${missing.join(', ')}`)
          }

          // Dynamic Symbol Detection: Use file name if possible, or default to XAUUSD
          const fileName = file.name.split('.')[0].toUpperCase()
          const detectedSymbol = fileName.match(/(XAUUSD|BTCUSDT|EURUSD|GBPUSD)/) ? fileName : "XAUUSD"

          const { data: symbolData } = await supabase.from('symbols').select('id').eq('name', detectedSymbol).single()
          let symbolId = symbolData?.id

          if (!symbolId) {
            const { data: newSymbol } = await supabase.from('symbols').insert({ name: detectedSymbol, category: 'Forex' }).select().single()
            symbolId = newSymbol?.id
          }

          const formattedData = data.map((row: any) => {
            // Robust Date Parsing
            const rawDate = row.timestamp || row.Date || row.time || row.Gmt_time
            let date = new Date(rawDate)
            
            // Handle DD.MM.YYYY format common in some platforms
            if (isNaN(date.getTime()) && typeof rawDate === 'string' && rawDate.includes('.')) {
              const parts = rawDate.split(' ')[0].split('.')
              if (parts.length === 3) {
                 date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
              }
            }

            if (isNaN(date.getTime())) {
              console.warn("Invalid date skipped:", rawDate)
              return null
            }

            return {
              symbol_id: symbolId,
              timeframe: '1h',
              timestamp: date.toISOString(),
              open: parseFloat(row.open || row.Open || 0),
              high: parseFloat(row.high || row.High || 0),
              low: parseFloat(row.low || row.Low || 0),
              close: parseFloat(row.close || row.Close || 0),
              volume: parseFloat(row.volume || row.Volume || 0)
            }
          }).filter(Boolean)

          if (formattedData.length === 0) throw new Error("No valid records found in CSV")

          // Batch insert in chunks to avoid Supabase limits
          const chunkSize = 1000
          for (let i = 0; i < formattedData.length; i += chunkSize) {
            const chunk = formattedData.slice(i, i + chunkSize)
            const { error } = await supabase.from('ohlc_data').upsert(chunk, { onConflict: 'symbol_id,timeframe,timestamp' })
            if (error) throw error
          }
          
          setStatus({ type: 'success', message: `Successfully imported ${formattedData.length} records for ${detectedSymbol}.` })
        } catch (err: any) {
          setStatus({ type: 'error', message: err.message })
        } finally {
          setIsUploading(false)
        }
      }
    })
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-xl p-8 hover:border-indigo-500/50 transition-all group cursor-pointer relative">
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileUpload} 
            className="absolute inset-0 opacity-0 cursor-pointer"
            disabled={isUploading}
          />
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
              <p className="text-sm font-medium">Processing CSV Data...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-indigo-500/10 group-hover:text-indigo-400 transition-all">
                <Upload className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium">Click or drag CSV to import data</p>
              <p className="text-xs text-zinc-500">Supports XAUUSD, EURUSD, etc.</p>
            </div>
          )}
        </div>

        {status.type !== 'idle' && (
          <div className={`mt-4 p-3 rounded-lg flex items-center gap-3 text-sm ${
            status.type === 'success' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
          }`}>
            {status.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {status.message}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
