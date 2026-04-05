import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Antigravity Backtest Pro",
  description: "Professional Manual Trading Backtesting & Journaling Platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} dark bg-zinc-950 text-zinc-50 antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <div className="relative flex min-h-screen flex-col">
            {/* Navigation Bar */}
            <header className="sticky top-0 z-50 w-full border-b border-zinc-800/50 bg-zinc-950/90 backdrop-blur-xl">
              <div className="max-w-[1440px] mx-auto flex h-14 items-center justify-between px-6">
                <Link href="/" className="flex items-center gap-2 group">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center font-black text-white text-xs shadow-lg shadow-indigo-500/20">
                    A
                  </div>
                  <span className="text-sm font-black tracking-tight">Antigravity <span className="text-indigo-400">Backtest</span></span>
                </Link>
                <nav className="flex items-center gap-1">
                  <Link href="/" className="px-3 py-1.5 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-all">
                    Dashboard
                  </Link>
                  <Link href="/strategies" className="px-3 py-1.5 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-all">
                    Strategies
                  </Link>
                  <Link href="/manual-backtest" className="px-3 py-1.5 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-all">
                    Manual Backtest
                  </Link>
                </nav>
              </div>
            </header>
            <main className="flex-1">{children}</main>
            <footer className="border-t border-zinc-900 py-4 text-center text-[10px] text-zinc-700">
              © 2026 Antigravity Trading Systems
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
