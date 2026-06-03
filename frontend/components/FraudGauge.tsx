"use client";
import { useEffect, useRef } from "react";

interface FraudGaugeProps {
  score?: number;
  size?: number;
  thickness?: number;
  showLabel?: boolean;
  animated?: boolean;
}

export default function FraudGauge({
  score = 0,
  size = 160,
  thickness = 10,
  showLabel = true,
  animated = true,
}: FraudGaugeProps) {
  const circleRef = useRef<SVGCircleElement>(null);
  const pct = Math.round(score * 100);

  const colorVar = pct < 30 ? "var(--color-success)" : pct < 70 ? "var(--color-warning)" : "var(--color-danger)";
  const glowRgb = pct < 30 ? "var(--color-success-rgb)" : pct < 70 ? "var(--color-warning-rgb)" : "var(--color-danger-rgb)";
  const label = pct < 30 ? "Low Risk" : pct < 70 ? "Moderate" : "High Risk";

  const r = (size - thickness * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const targetOffset = circumference - (pct / 100) * circumference;

  useEffect(() => {
    if (!circleRef.current) return;
    if (!animated) {
      circleRef.current.style.strokeDashoffset = `${targetOffset}`;
      return;
    }
    circleRef.current.style.strokeDashoffset = `${circumference}`;
    const start = performance.now();
    const duration = 1100;

    const raf = requestAnimationFrame(function step(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = circumference - eased * (circumference - targetOffset);
      if (circleRef.current) circleRef.current.style.strokeDashoffset = `${current}`;
      if (t < 1) requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [score, circumference, targetOffset, animated]);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Outer glow */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          boxShadow: `0 0 ${size * 0.2}px rgba(${glowRgb}, 0.35)`,
          borderRadius: "50%",
          transition: "box-shadow 0.8s ease",
        }}
      />

      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={`rgba(var(--border-base), 0.05)`}
          strokeWidth={thickness}
        />
        {/* Progress */}
        <circle
          ref={circleRef}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={colorVar}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          style={{ transition: "stroke 0.5s ease", filter: `drop-shadow(0 0 6px ${colorVar})` }}
        />
      </svg>

      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            className="font-mono font-bold leading-none"
            style={{ fontSize: size * 0.18, color: colorVar }}
          >
            {pct}%
          </span>
          <span
            className="font-mono uppercase tracking-widest mt-1"
            style={{ fontSize: size * 0.075, color: "var(--text-subtle)" }}
          >
            {label}
          </span>
        </div>
      )}
    </div>
  );
}
