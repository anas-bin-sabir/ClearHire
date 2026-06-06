"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { fraudThresholds } from "@/lib/theme";

type StatVariant = "primary" | "success" | "warning" | "danger";

const variantIconBg: Record<StatVariant, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger:  "bg-danger/10  text-danger",
};

const variantValue: Record<StatVariant, string> = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger:  "text-danger",
};

const variantBar: Record<StatVariant, string> = {
  primary: "bg-primary/25",
  success: "bg-success/25",
  warning: "bg-warning/25",
  danger:  "bg-danger/25",
};

function useCountUp(target: string | number, duration = 1200, delay = 0): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const numeric = parseFloat(String(target).replace(/[^0-9.]/g, ""));
    if (isNaN(numeric)) { setValue(Number(target)); return; }
    let start: number | null = null;
    const timeout = setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.floor(eased * numeric));
        if (progress < 1) raf.current = requestAnimationFrame(step);
        else setValue(numeric);
      };
      raf.current = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(timeout); if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration, delay]);

  return value;
}

function SparklinePlaceholder({ variant }: { variant: StatVariant }) {
  const heights = [40, 65, 45, 80, 55, 90, 70, 85];
  return (
    <div className="sparkline mt-3" aria-hidden>
      {heights.map((h, i) => (
        <div
          key={i}
          className={`sparkline-bar ${variantBar[variant]}`}
          style={{ height: `${h}%`, opacity: 0.35 + (i / heights.length) * 0.65 }}
        />
      ))}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ size: number; className?: string }>;
  variant?: StatVariant;
  delay?: number;
  suffix?: string;
  trend?: string;
  trendDirection?: "up" | "down" | "neutral";
  showSparkline?: boolean;
}

export default React.memo(function StatCard({
  label,
  value,
  icon: Icon,
  variant = "primary",
  delay = 0,
  suffix = "",
  trend,
  trendDirection = "neutral",
  showSparkline = true,
}: StatCardProps) {
  const count = useCountUp(value, 1200, delay);
  const shouldSkip = useReducedMotion();

  const TrendIcon = trendDirection === "up" ? TrendingUp : trendDirection === "down" ? TrendingDown : Minus;
  const trendColor =
    trendDirection === "up"   ? "text-success bg-success/10" :
    trendDirection === "down" ? "text-danger bg-danger/10"   :
                                "text-muted bg-card-elevated";

  return (
    <motion.div
      initial={shouldSkip ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000, duration: 0.35 }}
      whileHover={shouldSkip ? undefined : { y: -2 }}
      className="bg-card rounded-xl p-5 relative overflow-hidden shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={["w-10 h-10 rounded-lg flex items-center justify-center", variantIconBg[variant]].join(" ")}>
          <Icon size={20} />
        </div>
        {trend && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${trendColor}`}>
            <TrendIcon size={12} />
            {trend}
          </span>
        )}
      </div>

      <div className={`text-3xl font-bold tracking-tight mt-4 ${variantValue[variant]}`}>
        {count.toLocaleString()}{suffix}
      </div>
      <p className="text-sm text-muted mt-1">{label}</p>

      {showSparkline && <SparklinePlaceholder variant={variant} />}
    </motion.div>
  );
});

export { fraudThresholds };
