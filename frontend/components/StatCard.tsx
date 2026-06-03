"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

function useCountUp(target: string | number, duration: number = 1200, delay: number = 0): number {
  const [value, setValue] = useState<number>(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const numeric = parseFloat(String(target).replace(/[^0-9.]/g, ""));
    if (isNaN(numeric)) { setValue(Number(target)); return; }

    let start: number | null = null;
    const timeout = setTimeout(() => {
      const step = (timestamp: number): void => {
        if (!start) start = timestamp;
        const progress = Math.min((timestamp - start) / duration, 1);
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
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration, delay]);

  return value;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ size: number }>;
  color?: string;
  delay?: number;
  suffix?: string;
  trend?: string;
}

/* Map old Tailwind color strings → CSS variable tokens */
const colorTokenMap: Record<string, string> = {
  "text-cyan-400": "var(--color-primary)",
  "text-violet-400": "var(--color-secondary)",
  "text-red-400": "var(--color-danger)",
  "text-emerald-400": "var(--color-success)",
  "text-yellow-400": "var(--color-warning)",
};

function getRgbVar(colorClass: string): string {
  const map: Record<string, string> = {
    "text-cyan-400": "var(--color-primary-rgb)",
    "text-violet-400": "var(--color-secondary-rgb)",
    "text-red-400": "var(--color-danger-rgb)",
    "text-emerald-400": "var(--color-success-rgb)",
    "text-yellow-400": "var(--color-warning-rgb)",
  };
  return map[colorClass] ?? "var(--color-primary-rgb)";
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  color = "text-cyan-400",
  delay = 0,
  suffix = "",
  trend,
}: StatCardProps) {
  const count = useCountUp(value, 1400, delay);
  const colorVar = colorTokenMap[color] ?? "var(--color-primary)";
  const rgbVar = getRgbVar(color);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000, duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      style={{
        background: `rgba(var(--bg-secondary-rgb), 0.7)`,
        border: `1px solid rgba(${rgbVar}, 0.12)`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
      className="p-5 rounded-2xl group cursor-default relative overflow-hidden"
    >
      {/* Corner glow */}
      <div
        className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-60 pointer-events-none"
        style={{ background: `rgba(${rgbVar}, 0.08)`, transform: "translate(30%, -30%)" }}
      />

      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200"
        style={{
          background: `rgba(${rgbVar}, 0.1)`,
          color: colorVar,
        }}
      >
        <Icon size={20} />
      </div>

      {/* Value */}
      <div className="text-3xl font-mono font-bold tracking-tight mb-1" style={{ color: colorVar }}>
        {count.toLocaleString()}{suffix}
      </div>

      {/* Label */}
      <div
        className="text-[10px] font-mono uppercase tracking-[0.18em]"
        style={{ color: "var(--text-subtle)" }}
      >
        {label}
      </div>

      {/* Trend */}
      {trend && (
        <div
          className="mt-2 text-[10px] font-mono"
          style={{ color: trend.startsWith("+") ? "var(--color-success)" : "var(--color-danger)" }}
        >
          {trend} this week
        </div>
      )}
    </motion.div>
  );
}
