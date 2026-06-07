"use client";

import { useReveal } from "@/lib/useReveal";
import { Star, ShieldAlert, Puzzle } from "lucide-react";

const features = [
  {
    icon: Star,
    tag: "A* Search",
    title: "Intelligent Matching",
    desc: "Find the perfect candidate using intelligent A* search algorithms that weigh skill gaps, fraud scores, rate deviation, and semantic embedding similarity — all in under 2 seconds.",
    accent: "#4F6EF7",
    glow: "rgba(79,110,247,0.15)",
    stats: [
      { val: "384-dim", label: "embedding space" },
      { val: "O(√N)", label: "search complexity" },
    ],
  },
  {
    icon: ShieldAlert,
    tag: "Bayesian AI",
    title: "Fraud Detection",
    desc: "Bayesian-powered risk scoring eliminates low-trust profiles before they waste your time. Five independent evidence signals combine into a single probabilistic risk score with confidence level.",
    accent: "#7c3aed",
    glow: "rgba(124,58,237,0.15)",
    stats: [
      { val: "98.3%", label: "detection accuracy" },
      { val: "5 signals", label: "per profile" },
    ],
  },
  {
    icon: Puzzle,
    tag: "CSP Solver",
    title: "Team Builder",
    desc: "Automatically satisfy budget, skill, and deadline constraints simultaneously. The backtracking CSP solver with AC-3 arc consistency assembles optimal teams — no spreadsheets needed.",
    accent: "#00D4A4",
    glow: "rgba(0,212,164,0.15)",
    stats: [
      { val: "5 constraints", label: "enforced at once" },
      { val: "AC-3 + MRV", label: "optimization" },
    ],
  },
];

export default function Features() {
  const { ref, visible } = useReveal();

  return (
    <section id="features" className="py-28 bg-slate-50 dark:bg-navy-800 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div ref={ref} className={`text-center mb-16 reveal ${visible ? "visible" : ""}`}>
          <span className="inline-block px-3 py-1 text-xs font-mono uppercase tracking-widest text-electric-400 bg-electric-400/10 rounded-full border border-electric-400/20 mb-4">
            Core AI Engine
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-navy-900 dark:text-white mb-4">
            Why{" "}
            <span className="gradient-text">ClearHire</span>?
          </h2>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
            Three classical AI algorithms, unified into one production-grade hiring engine.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <FeatureCard key={f.tag} feature={f} delay={i * 150} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  feature,
  delay,
}: {
  feature: (typeof features)[0];
  delay: number;
}) {
  const { ref, visible } = useReveal();

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? "visible" : ""} group relative bg-white dark:bg-navy-900 border border-slate-100 dark:border-white/5 rounded-2xl p-6 cursor-default
        transition-all duration-300
        hover:-translate-y-2 hover:shadow-2xl
      `}
      style={{
        transitionDelay: `${delay}ms`,
        // @ts-ignore — CSS custom property
        "--glow": feature.glow,
      }}
    >
      {/* Glow on hover */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: `0 0 40px 0 ${feature.glow}, inset 0 0 0 1px ${feature.accent}30` }}
      />

      {/* Tag */}
      <span
        className="inline-block text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-full mb-4"
        style={{
          color: feature.accent,
          background: feature.glow,
          border: `1px solid ${feature.accent}40`,
        }}
      >
        {feature.tag}
      </span>

      {/* Icon */}
      <div className="mb-4">
        <feature.icon className="h-8 w-8" style={{ color: feature.accent }} />
      </div>

      <h3 className="text-xl font-bold text-navy-900 dark:text-white mb-3">{feature.title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">{feature.desc}</p>

      {/* Stats */}
      <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-white/5">
        {feature.stats.map((s) => (
          <div key={s.label}>
            <p className="text-sm font-bold" style={{ color: feature.accent }}>
              {s.val}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
