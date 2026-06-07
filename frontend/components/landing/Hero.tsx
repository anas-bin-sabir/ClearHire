"use client";

import { ArrowRight } from "lucide-react";

function LivePulse() {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-mint-400/10 border border-mint-400/20 text-xs font-mono text-mint-400">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mint-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-mint-400" />
      </span>
      Live · avg latency 1.8s
    </div>
  );
}

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-white dark:bg-navy-900 transition-colors duration-300 overflow-hidden">
      {/* Background soft glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-electric-400/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-mint-400/5 rounded-full blur-3xl pointer-events-none" />

      {/* Content */}
      <div className="relative max-w-4xl mx-auto px-6 w-full flex flex-col items-center text-center gap-8 pt-32 pb-16">
        <div className="flex flex-col items-center gap-6 max-w-3xl">
          <LivePulse />

          <h1 className="text-5xl md:text-6xl font-extrabold leading-[1.1] tracking-tight text-navy-900 dark:text-white">
            ClearHire:
            <br />
            <span className="gradient-text">Elite Freelancers,</span>
            <br />
            AI-Verified.
          </h1>

          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
            Stop gambling on hires. Use our AI-powered verification and matching
            engine to build trustworthy project teams{" "}
            <span className="text-electric-400 font-semibold">instantly.</span>
          </p>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <a
              href="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 bg-mint-400 hover:bg-mint-500 text-navy-900 font-bold rounded-xl transition-all duration-200 hover:scale-[1.03] active:scale-95 shadow-lg shadow-mint-400/25"
            >
              Start Verification
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#features"
              className="inline-flex items-center gap-2 px-6 py-3 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all duration-200"
            >
              See How It Works
            </a>
          </div>
        </div>

        {/* Trust metrics */}
        <div className="flex flex-wrap justify-center gap-8 md:gap-16 pt-8 mt-4 border-t border-slate-100 dark:border-white/5 w-full max-w-2xl">
          {[
            { val: "98.3%", label: "Fraud detection accuracy" },
            { val: "<1.8s", label: "Avg. match latency" },
            { val: "10k+", label: "Verified freelancers" },
          ].map((m) => (
            <div key={m.label} className="text-center">
              <p className="text-3xl font-extrabold gradient-text-electric">{m.val}</p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-slate-400 dark:text-slate-600">
        <span className="text-[10px] uppercase tracking-widest">Scroll</span>
        <div className="w-px h-8 bg-gradient-to-b from-slate-300 to-transparent dark:from-slate-700 animate-pulse2" />
      </div>
    </section>
  );
}
