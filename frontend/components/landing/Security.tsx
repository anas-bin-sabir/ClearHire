"use client";

import { useEffect, useRef, useState } from "react";

const EXPLANATION =
  "This candidate is a 98% match. They have 4 years of verified Python experience with 6 completed FastAPI projects in your budget range ($65/hr). Fraud score: 0.04 — extremely low risk. A* rank score: 0.92/1.00. Neo4j graph confirms 3 shared-domain project completions.";

export default function Security() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [typed, setTyped] = useState("");
  const [cursor, setCursor] = useState(true);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) setStarted(true); },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setTyped(EXPLANATION.slice(0, i));
      if (i >= EXPLANATION.length) clearInterval(iv);
    }, 28);
    return () => clearInterval(iv);
  }, [started]);

  useEffect(() => {
    const iv = setInterval(() => setCursor((c) => !c), 500);
    return () => clearInterval(iv);
  }, []);

  return (
    <section id="security" ref={sectionRef} className="py-28 bg-slate-50 dark:bg-navy-800 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1 text-xs font-mono uppercase tracking-widest text-mint-400 bg-mint-400/10 rounded-full border border-mint-400/20 mb-4">
            Explainable AI
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-navy-900 dark:text-white mb-4">
            AI that{" "}
            <span className="gradient-text">explains itself</span>
          </h2>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
            Every recommendation comes with a human-readable justification. No black boxes.
          </p>
        </div>

        {/* Split screen */}
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Left — freelancer profile card */}
          <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-100 dark:border-white/5 p-6 shadow-xl">
            {/* Profile header */}
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100 dark:border-white/5">
              <div className="w-14 h-14 rounded-full bg-hero-gradient flex items-center justify-center text-white font-bold text-lg">
                AR
              </div>
              <div>
                <p className="font-bold text-navy-900 dark:text-white">Ahmed Raza</p>
                <p className="text-sm text-slate-500">Senior Python Developer</p>
                <div className="flex items-center gap-1 mt-1">
                  {[1,2,3,4,5].map((s) => (
                    <span key={s} className="text-yellow-400 text-xs">★</span>
                  ))}
                  <span className="text-xs text-slate-400 ml-1">4.9 (84 reviews)</span>
                </div>
              </div>
              {/* Rank badge */}
              <div className="ml-auto text-center">
                <div className="text-2xl font-extrabold gradient-text-electric">0.92</div>
                <div className="text-[10px] text-slate-400">A* Score</div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: "Hourly Rate", val: "$65", color: "#4F6EF7" },
                { label: "Fraud Score", val: "0.04", color: "#00D4A4" },
                { label: "Experience", val: "4 yrs", color: "#7c3aed" },
              ].map((s) => (
                <div key={s.label} className="bg-slate-50 dark:bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold" style={{ color: s.color }}>{s.val}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Skills */}
            <div className="flex flex-wrap gap-2 mb-6">
              {["Python", "FastAPI", "PostgreSQL", "Docker", "Neo4j", "Redis"].map((sk) => (
                <span key={sk} className="text-xs px-2.5 py-1 rounded-full bg-electric-400/10 text-electric-400 border border-electric-400/20">
                  {sk}
                </span>
              ))}
            </div>

            {/* Fraud gauge */}
            <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>Fraud Risk</span>
                <span className="text-mint-400 font-semibold">LOW RISK · 0.04</span>
              </div>
              <div className="h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div className="h-full w-[4%] bg-mint-400 rounded-full" />
              </div>
            </div>
          </div>

          {/* Right — AI justification window */}
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-electric-400/10 via-violet/10 to-mint-400/10 rounded-3xl blur-2xl" />

            <div className="relative bg-navy-900 rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-black/20">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                <span className="ml-3 text-xs font-mono text-white/40">ClearHire · AI Justification Engine</span>
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-mint-400 animate-pulse" />
                  <span className="text-[10px] font-mono text-mint-400">LIVE</span>
                </span>
              </div>

              <div className="p-6">
                {/* Query */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-6 h-6 rounded-full bg-electric-400/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-electric-400 text-xs">?</span>
                  </div>
                  <p className="text-sm text-white/60 font-mono">Why this candidate?</p>
                </div>

                {/* AI response */}
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-hero-gradient flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">AI</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-300 font-mono leading-relaxed">
                      {typed}
                      <span className={`inline-block w-0.5 h-4 bg-electric-400 ml-0.5 align-middle ${cursor ? "opacity-100" : "opacity-0"}`} />
                    </p>
                  </div>
                </div>

                {/* Evidence chips */}
                {typed.length > 80 && (
                  <div className="mt-6 flex flex-wrap gap-2">
                    {[
                      { label: "✓ Budget match",     color: "#00D4A4" },
                      { label: "✓ Skill coverage",   color: "#4F6EF7" },
                      { label: "✓ Low fraud risk",   color: "#00D4A4" },
                      { label: "✓ History verified", color: "#7c3aed" },
                    ].map((chip) => (
                      <span
                        key={chip.label}
                        className="text-[11px] font-mono px-2.5 py-1 rounded-full border"
                        style={{ color: chip.color, borderColor: `${chip.color}40`, background: `${chip.color}10` }}
                      >
                        {chip.label}
                      </span>
                    ))}
                  </div>
                )}

                {/* Bottom confidence bar */}
                <div className="mt-6 pt-4 border-t border-white/5">
                  <div className="flex justify-between text-xs font-mono text-white/40 mb-2">
                    <span>Overall confidence</span>
                    <span className="text-mint-400">HIGH · 98%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full w-[98%] shimmer-bar rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
