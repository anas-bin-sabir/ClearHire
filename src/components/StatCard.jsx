"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

function useCountUp(target, duration = 1200, delay = 0) {
  const [value, setValue] = useState(0);
  const raf = useRef(null);

  useEffect(() => {
    const numeric = parseFloat(String(target).replace(/[^0-9.]/g, ""));
    if (isNaN(numeric)) {
      setValue(target);
      return;
    }

    let start = null;
    const timeout = setTimeout(() => {
      const step = (timestamp) => {
        if (!start) start = timestamp;
        const progress = Math.min((timestamp - start) / duration, 1);
        // easeOutExpo
        const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const current = Math.floor(eased * numeric);
        setValue(current);
        if (progress < 1) raf.current = requestAnimationFrame(step);
        else setValue(numeric);
      };
      raf.current = requestAnimationFrame(step);
    }, delay);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(raf.current);
    };
  }, [target, duration, delay]);

  return value;
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  color = "text-cyan-400",
  delay = 0,
  suffix = "",
  trend,
}) {
  const count = useCountUp(value, 1400, delay);

  const colorMap = {
    "text-cyan-400": {
      glow: "rgba(0,212,255,0.08)",
      border: "rgba(0,212,255,0.12)",
      bg: "rgba(0,212,255,0.08)",
    },
    "text-violet-400": {
      glow: "rgba(124,58,237,0.08)",
      border: "rgba(124,58,237,0.12)",
      bg: "rgba(124,58,237,0.08)",
    },
    "text-red-400": {
      glow: "rgba(239,68,68,0.08)",
      border: "rgba(239,68,68,0.12)",
      bg: "rgba(239,68,68,0.08)",
    },
    "text-emerald-400": {
      glow: "rgba(16,185,129,0.08)",
      border: "rgba(16,185,129,0.12)",
      bg: "rgba(16,185,129,0.08)",
    },
    "text-yellow-400": {
      glow: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.12)",
      bg: "rgba(245,158,11,0.08)",
    },
  };
  const theme = colorMap[color] ?? colorMap["text-cyan-400"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000, duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      style={{
        background: "rgba(17,24,39,0.7)",
        border: `1px solid ${theme.border}`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
      className="p-5 rounded-2xl group cursor-default relative overflow-hidden"
    >
      {/* subtle corner glow */}
      <div
        className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-60 pointer-events-none"
        style={{ background: theme.glow, transform: "translate(30%, -30%)" }}
      />

      {/* Icon */}
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${color} group-hover:scale-110 transition-transform duration-200`}
        style={{ background: theme.bg }}
      >
        <Icon size={20} />
      </div>

      {/* Value */}
      <div
        className={`text-3xl font-mono font-bold tracking-tight mb-1 ${color}`}
      >
        {count.toLocaleString()}
        {suffix}
      </div>

      {/* Label */}
      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>

      {/* Trend */}
      {trend && (
        <div
          className={`mt-2 text-[10px] font-mono ${trend.startsWith("+") ? "text-emerald-400" : "text-red-400"}`}
        >
          {trend} this week
        </div>
      )}
    </motion.div>
  );
}
